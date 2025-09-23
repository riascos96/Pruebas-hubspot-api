import { hsGetJson } from "../src/clients/hubspot.js";
import { getDbConnection } from "../src/utils/dbConnection.js";

async function main() {
  const name = (process.argv[2] || "").trim().toLowerCase();
  const id = (process.argv[3] || "").trim();
  if (!name) {
    console.error("Uso: dumpObject <object_name> [id]");
    process.exit(1);
  }
  const pg = getDbConnection();
  if (id) {
    const { rows } = await pg.query(
      `SELECT hs_object_id, payload->'properties' as props
         FROM raw_hubspot.objects_raw
        WHERE object_name=$1 AND hs_object_id=$2`,
      [name, id]
    );
    console.log("DB payload properties keys:", Object.keys(rows[0]?.props ?? {}));
    const api = await hsGetJson(`/crm/v3/objects/${name}/${id}`, {
      properties: [
        // pide un set amplio de propiedades para comparar
        "email","firstname","lastname","phone","mobilephone",
        "hubspot_owner_id","associatedcompanyid","hs_lastactivitydate",
        "hs_lead_status","createdate","hs_lastmodifieddate"
      ]
    });
    console.log("API properties keys:", Object.keys(api?.properties ?? {}));
    console.log({
      db: {
        email: rows[0]?.props?.email,
        firstname: rows[0]?.props?.firstname,
        lastname: rows[0]?.props?.lastname
      },
      api: {
        email: api?.properties?.email,
        firstname: api?.properties?.firstname,
        lastname: api?.properties?.lastname
      }
    });
  } else {
    const api = await hsGetJson(`/crm/v3/objects/${name}`, { limit: 1, properties: ["email","firstname","lastname"] });
    console.log("API sample:", api?.results?.[0]);
    const { rows } = await pg.query(
      `SELECT hs_object_id, payload->'properties' props
         FROM raw_hubspot.objects_raw
        WHERE object_name=$1
        LIMIT 1`,
      [name]
    );
    console.log("DB sample:", rows[0]);
  }
}

if (import.meta.main) main().catch(e => { console.error(e); process.exit(1); });

