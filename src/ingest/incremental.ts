import { hsPostJson } from "../clients/hubspot.js";
import { getDbConnection } from "../utils/dbConnection.js";
import { log } from "../utils/logger.js";

const OBJECTS_INCREMENTAL = [
  "contacts","companies","deals","tickets","products","line_items",
  "calls","emails","meetings","notes","tasks"
];

async function getWatermark(pg:any, name:string) {
  const q = await pg.query(`SELECT last_updated_at FROM meta.sync_state WHERE entity=$1 AND kind='object'`, [name]);
  return q.rowCount ? new Date(q.rows[0].last_updated_at).getTime() : 0;
}
async function setWatermark(pg:any, name:string, ms:number) {
  await pg.query(
    `INSERT INTO meta.sync_state(entity,kind,last_updated_at)
     VALUES($1,'object',to_timestamp($2/1000.0))
     ON CONFLICT (entity,kind) DO UPDATE SET last_updated_at=EXCLUDED.last_updated_at`,
    [name, ms]
  );
}

async function getAllPropertyNames(pg: any, name: string): Promise<string[]> {
  const q = await pg.query(
    `SELECT name FROM meta.properties WHERE object_name=$1 ORDER BY name`,
    [name]
  );
  const propsSet = new Set<string>(q.rows.map((r: any) => r.name as string));
  const required = [
    "hs_lastmodifieddate",
    "email","firstname","lastname",
    "phone","mobilephone",
    "hubspot_owner_id","associatedcompanyid",
    "hs_lastactivitydate","hs_lead_status","createdate"
  ];
  required.forEach(p => propsSet.add(p));
  return Array.from(propsSet);
}

async function incObject(name: string) {
  const pg = getDbConnection();
  const props = await getAllPropertyNames(pg, name).catch(() => ["hs_lastmodifieddate"]);
  const since = await getWatermark(pg, name);
  let after: string | undefined;
  let maxSeen = since;
  let total = 0;

  while (true) {
    const body = {
      filterGroups: [{ filters: [{ propertyName: "hs_lastmodifieddate", operator: "GT", value: since }] }],
      sorts: [{ propertyName: "hs_lastmodifieddate", direction: "ASCENDING" }],
      properties: props,
      limit: 100,
      after
    };
    const data = await hsPostJson(`/crm/v3/objects/${name}/search`, body);

    for (const row of (data.results ?? [])) {
      const id = String(row.id);
      const ts = Number(row.properties?.hs_lastmodifieddate ?? 0)
             || Number(row.properties?.createdate ?? 0)
             || null;
      await pg.query(
        `INSERT INTO raw_hubspot.objects_raw(object_name,hs_object_id,updated_at,payload)
         VALUES($1,$2,COALESCE(to_timestamp(($3::double precision)/1000.0), NOW()),$4)
         ON CONFLICT (object_name,hs_object_id)
         DO UPDATE SET updated_at=EXCLUDED.updated_at, payload=EXCLUDED.payload, ingested_at=NOW()`,
        [name, id, ts, row]
      );
      if (ts !== null && ts > maxSeen) maxSeen = ts;
      total++;
    }

    after = data.paging?.next?.after;
    if (!after) break;
    await new Promise(r => setTimeout(r, 250)); // ~4 req/s
  }

  if (maxSeen > since) await setWatermark(pg, name, maxSeen);
  log.info({ name, total }, "INC ok");
}

export default async function main() {
  for (const name of OBJECTS_INCREMENTAL) {
    try { await incObject(name); }
    catch (e) { console.error("INC error", name, (e as any).message); }
  }
}
if (import.meta.main) main().catch(e => { console.error(e); process.exit(1); });
