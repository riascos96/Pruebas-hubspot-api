import { hsGetJson, hsPostJson } from "../clients/hubspot.js";
import { getDbConnection } from "../utils/dbConnection.js";
import { log } from "../utils/logger.js";
async function getAllPropertyNames(pg, name) {
    const q = await pg.query(`SELECT name FROM meta.properties WHERE object_name=$1 ORDER BY name`, [name]);
    const props = q.rows.map((r) => r.name);
    if (!props.includes("hs_lastmodifieddate"))
        props.push("hs_lastmodifieddate");
    return props;
}
async function ingestObject(name) {
    const pg = getDbConnection();
    const props = await getAllPropertyNames(pg, name).catch(() => ["hs_lastmodifieddate"]);
    let after;
    let count = 0;
    while (true) {
        const page = await hsGetJson(`/crm/v3/objects/${name}`, {
            limit: 100,
            archived: false,
            ...(after ? { after } : {})
        });
        const ids = (page.results ?? []).map((r) => String(r.id));
        if (ids.length) {
            const body = { inputs: ids.map(id => ({ id })), properties: props };
            const data = await hsPostJson(`/crm/v3/objects/${name}/batch/read`, body);
            for (const row of (data.results ?? [])) {
                const id = String(row.id);
                const ts = Number(row.properties?.hs_lastmodifieddate ?? 0)
                    || Number(row.properties?.createdate ?? 0)
                    || (row.updatedAt ? Date.parse(row.updatedAt) : 0)
                    || (row.createdAt ? Date.parse(row.createdAt) : 0)
                    || null;
                await pg.query(`INSERT INTO raw_hubspot.objects_raw(object_name,hs_object_id,updated_at,payload)
           VALUES($1,$2,COALESCE(to_timestamp(($3::double precision)/1000.0), NOW()),$4)
           ON CONFLICT (object_name,hs_object_id)
           DO UPDATE SET updated_at=EXCLUDED.updated_at, payload=EXCLUDED.payload, ingested_at=NOW()`, [name, id, ts, row]);
                count++;
            }
        }
        after = page.paging?.next?.after;
        if (!after)
            break;
    }
    await pg.query(`INSERT INTO meta.sync_state(entity,kind,last_after) VALUES($1,'object',NULL)
     ON CONFLICT (entity,kind) DO UPDATE SET last_after=NULL`, [name]);
    log.info({ name, count }, "FULL(one) ok");
}
export default async function main() {
    const name = (process.argv[2] || "").trim().toLowerCase();
    if (!name) {
        console.error("Uso: fullOne <object_name>  (ej: contacts)");
        process.exit(1);
    }
    await ingestObject(name);
}
if (import.meta.main)
    main().catch(e => { console.error(e); process.exit(1); });
//# sourceMappingURL=fullOne.js.map