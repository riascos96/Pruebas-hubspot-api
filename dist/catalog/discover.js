import { hsGetJson } from "../clients/hubspot.js";
import { getDbConnection } from "../utils/dbConnection.js";
import { log } from "../utils/logger.js";
const ACTIVITY_OBJECTS = ["calls", "emails", "meetings", "notes", "tasks"];
const CORE_HINT = ["contacts", "companies", "deals", "tickets", "products", "line_items"];
async function upsert(pg, q, params) { await pg.query(q, params); }
export default async function main() {
    const pg = getDbConnection();
    const schemas = await hsGetJson("/crm/v3/schemas");
    const names = [];
    for (const s of (schemas?.results ?? [])) {
        const name = (s?.name || "").toLowerCase();
        names.push(name);
        await upsert(pg, `INSERT INTO meta.objects(object_type_id,name,label,is_custom,payload)
       VALUES($1,$2,$3,$4,$5)
       ON CONFLICT (object_type_id) DO UPDATE
       SET name=EXCLUDED.name,label=EXCLUDED.label,is_custom=EXCLUDED.is_custom,payload=EXCLUDED.payload,discovered_at=NOW()`, [s.objectTypeId, name, s.labels?.singular ?? name, s.type === "CUSTOM", s]);
        // Propiedades
        try {
            const props = await hsGetJson(`/crm/v3/properties/${name}`);
            for (const p of (props?.results ?? [])) {
                await upsert(pg, `INSERT INTO meta.properties(object_name,name,label,type,field_type,payload)
           VALUES($1,$2,$3,$4,$5,$6)
           ON CONFLICT (object_name,name) DO UPDATE
           SET label=EXCLUDED.label,type=EXCLUDED.type,field_type=EXCLUDED.field_type,payload=EXCLUDED.payload`, [name, p.name, p.label ?? p.name, p.type ?? null, p.fieldType ?? null, p]);
            }
        }
        catch { }
        // Pipelines
        try {
            const pl = await hsGetJson(`/crm/v3/pipelines/${name}`);
            for (const p of (pl?.results ?? [])) {
                await upsert(pg, `INSERT INTO meta.pipelines(object_name,pipeline_id,label,payload)
           VALUES($1,$2,$3,$4)
           ON CONFLICT (object_name,pipeline_id) DO UPDATE
           SET label=EXCLUDED.label,payload=EXCLUDED.payload`, [name, p.id, p.label ?? p.id, p]);
            }
        }
        catch { }
    }
    for (const n of CORE_HINT)
        if (!names.includes(n))
            names.push(n);
    for (const n of ACTIVITY_OBJECTS)
        if (!names.includes(n))
            names.push(n);
    // Owners
    try {
        const owners = await hsGetJson("/crm/v3/owners/");
        for (const o of (owners?.results ?? [])) {
            await upsert(pg, `INSERT INTO meta.owners(owner_id,email,first_name,last_name,payload)
         VALUES($1,$2,$3,$4,$5)
         ON CONFLICT (owner_id) DO UPDATE
         SET email=EXCLUDED.email,first_name=EXCLUDED.first_name,last_name=EXCLUDED.last_name,payload=EXCLUDED.payload,discovered_at=NOW()`, [o.id, o.email ?? null, o.firstName ?? null, o.lastName ?? null, o]);
        }
    }
    catch { }
    log.info({ objects: names }, "Descubrimiento completado");
}
if (import.meta.main)
    main().catch(e => { console.error(e); process.exit(1); });
//# sourceMappingURL=discover.js.map