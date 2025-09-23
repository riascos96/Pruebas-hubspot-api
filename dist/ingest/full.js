import { hsGetJson } from "../clients/hubspot.js";
import { getDbConnection } from "../utils/dbConnection.js";
import { log } from "../utils/logger.js";
const OBJECTS_ALL = [
    "contacts", "companies", "deals", "tickets", "products", "line_items",
    "calls", "emails", "meetings", "notes", "tasks"
];
async function getAllPropertyNames(pg, name) {
    const q = await pg.query(`SELECT name FROM meta.properties WHERE object_name=$1 ORDER BY name`, [name]);
    const propsSet = new Set(q.rows.map((r) => r.name));
    // Propiedades clave que siempre queremos presentes
    const required = [
        "hs_lastmodifieddate",
        "email", "firstname", "lastname",
        "phone", "mobilephone",
        "hubspot_owner_id", "associatedcompanyid",
        "hs_lastactivitydate", "hs_lead_status", "createdate"
    ];
    required.forEach(p => propsSet.add(p));
    return Array.from(propsSet);
}
async function ingestObject(name) {
    const pg = getDbConnection();
    const props = await getAllPropertyNames(pg, name).catch(() => ["hs_lastmodifieddate"]);
    let after;
    let count = 0;
    while (true) {
        const data = await hsGetJson(`/crm/v3/objects/${name}`, {
            limit: 100,
            archived: false,
            properties: props,
            ...(after ? { after } : {})
        });
        for (const row of (data.results ?? [])) {
            const id = String(row.id);
            const ts = Number(row.properties?.hs_lastmodifieddate ?? 0) || null;
            await pg.query(`INSERT INTO raw_hubspot.objects_raw(object_name,hs_object_id,updated_at,payload)
         VALUES($1,$2,to_timestamp(($3::double precision)/1000.0),$4)
         ON CONFLICT (object_name,hs_object_id)
         DO UPDATE SET updated_at=EXCLUDED.updated_at, payload=EXCLUDED.payload, ingested_at=NOW()`, [name, id, ts, row]);
            count++;
        }
        after = data.paging?.next?.after;
        if (!after)
            break;
    }
    await pg.query(`INSERT INTO meta.sync_state(entity,kind,last_after) VALUES($1,'object',NULL)
     ON CONFLICT (entity,kind) DO UPDATE SET last_after=NULL`, [name]);
    log.info({ name, count }, "FULL ok");
}
export default async function main() {
    for (const name of OBJECTS_ALL) {
        try {
            await ingestObject(name);
        }
        catch (e) {
            console.error("FULL error", name, e.message);
        }
    }
}
if (import.meta.main)
    main().catch(e => { console.error(e); process.exit(1); });
//# sourceMappingURL=full.js.map