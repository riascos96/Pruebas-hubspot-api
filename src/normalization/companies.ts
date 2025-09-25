import { getDbConnection } from "../utils/dbConnection.js";
import { log } from "../utils/logger.js";
import { asString, normalizePhone, parseTimestamp, pickFirstTimestamp, safeJson } from "./helpers.js";

type RawCompanyRow = {
  hs_object_id: string;
  payload: any;
  updated_at: Date | string | null;
};

export async function normalizeCompanies(): Promise<void> {
  const pg = getDbConnection();
  const { rows } = await pg.query<RawCompanyRow>(
    `SELECT hs_object_id, payload, updated_at
       FROM raw_hubspot.objects_raw
      WHERE object_name = 'companies'`
  );

  let processed = 0;
  for (const row of rows) {
    const payload = safeJson(row.payload);
    const props = safeJson(payload.properties ?? {});

    const companyId = row.hs_object_id;
    const name = asString(props.name ?? props.company ?? props.domain);
    const domain = asString(props.domain);
    const ownerId = asString(props.hubspot_owner_id);

    const phone = normalizePhone(props.phone);

    const createdAt = pickFirstTimestamp(props, ["hs_createdate", "createdate"]) ?? parseTimestamp(payload.createdAt);
    const lastModifiedAt = pickFirstTimestamp(props, ["hs_lastmodifieddate"]) ?? parseTimestamp(payload.updatedAt);
    const updatedAt = parseTimestamp(row.updated_at ?? payload.updatedAt) ?? lastModifiedAt ?? createdAt;

    const archived = Boolean(payload.archived);
    const rawProps = props;

    await pg.query(
      `INSERT INTO stg.companies (
         company_id, name, domain,
         phone_raw, phone_e164, owner_id,
         created_at, last_modified_at,
         archived, updated_at, raw_properties, ingested_at
       ) VALUES (
         $1,$2,$3,
         $4,$5,$6,
         $7,$8,
         $9,$10,$11,NOW()
       )
       ON CONFLICT (company_id) DO UPDATE SET
         name = EXCLUDED.name,
         domain = EXCLUDED.domain,
         phone_raw = EXCLUDED.phone_raw,
         phone_e164 = EXCLUDED.phone_e164,
         owner_id = EXCLUDED.owner_id,
         created_at = EXCLUDED.created_at,
         last_modified_at = EXCLUDED.last_modified_at,
         archived = EXCLUDED.archived,
         updated_at = EXCLUDED.updated_at,
         raw_properties = EXCLUDED.raw_properties,
         ingested_at = NOW()`,
      [
        companyId,
        name,
        domain,
        phone.raw,
        phone.e164,
        ownerId,
        createdAt,
        lastModifiedAt,
        archived,
        updatedAt,
        rawProps
      ]
    );

    processed += 1;
  }

  log.info({ processed }, "companies normalized");
}
