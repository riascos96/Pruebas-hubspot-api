import { getDbConnection } from "../utils/dbConnection.js";
import { log } from "../utils/logger.js";
import { asString, buildFullName, cleanEmail, emailDomain, normalizePhone, parseTimestamp, pickFirstTimestamp, safeJson } from "./helpers.js";
export async function normalizeContacts() {
    const pg = getDbConnection();
    const { rows } = await pg.query(`SELECT hs_object_id, payload, updated_at
       FROM raw_hubspot.objects_raw
      WHERE object_name = 'contacts'`);
    let processed = 0;
    for (const row of rows) {
        const payload = safeJson(row.payload);
        const props = safeJson(payload.properties ?? {});
        const contactId = row.hs_object_id;
        const email = cleanEmail(props.email);
        const domain = emailDomain(email);
        const first = asString(props.firstname);
        const last = asString(props.lastname);
        const fullName = buildFullName(first, last);
        const phone = normalizePhone(props.phone);
        const mobile = normalizePhone(props.mobilephone);
        const associatedCompanyId = asString(props.associatedcompanyid);
        const ownerId = asString(props.hubspot_owner_id);
        const leadStatus = asString(props.hs_lead_status);
        const createdAt = pickFirstTimestamp(props, ["hs_createdate", "createdate"]) ?? parseTimestamp(payload.createdAt);
        const lastModifiedAt = pickFirstTimestamp(props, ["hs_lastmodifieddate", "lastmodifieddate"]) ?? parseTimestamp(payload.updatedAt);
        const lastActivityAt = pickFirstTimestamp(props, ["hs_lastactivitydate"]);
        const updatedAt = parseTimestamp(row.updated_at ?? payload.updatedAt) ?? lastModifiedAt ?? createdAt;
        const archived = Boolean(payload.archived);
        const rawProps = props;
        await pg.query(`INSERT INTO stg.contacts (
         contact_id, canonical_email, email_domain, first_name, last_name, full_name,
         phone_raw, phone_e164, mobile_phone_raw, mobile_phone_e164,
         associated_company_id, owner_id, lead_status,
         created_at, last_modified_at, last_activity_at,
         archived, updated_at, raw_properties, ingested_at
       ) VALUES (
         $1,$2,$3,$4,$5,$6,
         $7,$8,$9,$10,
         $11,$12,$13,
         $14,$15,$16,
         $17,$18,$19,NOW()
       )
       ON CONFLICT (contact_id) DO UPDATE SET
         canonical_email = EXCLUDED.canonical_email,
         email_domain = EXCLUDED.email_domain,
         first_name = EXCLUDED.first_name,
         last_name = EXCLUDED.last_name,
         full_name = EXCLUDED.full_name,
         phone_raw = EXCLUDED.phone_raw,
         phone_e164 = EXCLUDED.phone_e164,
         mobile_phone_raw = EXCLUDED.mobile_phone_raw,
         mobile_phone_e164 = EXCLUDED.mobile_phone_e164,
         associated_company_id = EXCLUDED.associated_company_id,
         owner_id = EXCLUDED.owner_id,
         lead_status = EXCLUDED.lead_status,
         created_at = EXCLUDED.created_at,
         last_modified_at = EXCLUDED.last_modified_at,
         last_activity_at = EXCLUDED.last_activity_at,
         archived = EXCLUDED.archived,
         updated_at = EXCLUDED.updated_at,
         raw_properties = EXCLUDED.raw_properties,
         ingested_at = NOW()`, [
            contactId,
            email,
            domain,
            first,
            last,
            fullName,
            phone.raw,
            phone.e164,
            mobile.raw,
            mobile.e164,
            associatedCompanyId,
            ownerId,
            leadStatus,
            createdAt,
            lastModifiedAt,
            lastActivityAt,
            archived,
            updatedAt,
            rawProps
        ]);
        processed += 1;
    }
    log.info({ processed }, "contacts normalized");
}
//# sourceMappingURL=contacts.js.map