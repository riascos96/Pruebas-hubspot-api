import { getDbConnection } from "../utils/dbConnection.js";
import { log } from "../utils/logger.js";
import { asString, parseTimestamp, pickFirstString, pickFirstTimestamp, safeJson } from "./helpers.js";

type RawActivityRow = {
  object_name: string;
  hs_object_id: string;
  payload: any;
  updated_at: Date | string | null;
};

const ACTIVITY_OBJECTS = ["calls", "emails", "meetings", "notes", "tasks"] as const;

type ActivityObject = typeof ACTIVITY_OBJECTS[number];

function resolveSubject(objectName: ActivityObject, props: Record<string, any>): string | null {
  const perObject: Record<ActivityObject, string[]> = {
    calls: ["subject", "hs_subject", "hs_call_title", "hs_call_body"],
    emails: ["subject", "hs_email_subject", "hs_email_html"],
    meetings: ["subject", "hs_meeting_title", "hs_meeting_body"],
    notes: ["subject", "hs_note_title", "hs_note_body"],
    tasks: ["subject", "hs_task_subject", "hs_task_body", "hs_task_title"]
  };
  const keys = perObject[objectName];
  return pickFirstString(props, [...keys, "hs_description"]);
}

function resolveStatus(objectName: ActivityObject, props: Record<string, any>): string | null {
  const perObject: Record<ActivityObject, string[]> = {
    calls: ["hs_call_status", "hs_call_outcome"],
    emails: ["hs_email_status", "hs_email_direction"],
    meetings: ["hs_meeting_outcome", "hs_meeting_status"],
    notes: ["hs_note_status"],
    tasks: ["hs_task_status", "hs_task_priority", "hs_task_state"]
  };
  return pickFirstString(props, [...(perObject[objectName] ?? []), "hs_status", "status"]);
}

function resolveActivityType(objectName: ActivityObject, props: Record<string, any>): string | null {
  const perObject: Record<ActivityObject, string[]> = {
    calls: ["hs_call_direction", "hs_call_status"],
    emails: ["hs_email_direction", "hs_email_type"],
    meetings: ["hs_meeting_outcome", "hs_meeting_type"],
    notes: ["hs_note_type"],
    tasks: ["hs_task_type"]
  };
  return pickFirstString(props, [...(perObject[objectName] ?? []), "activity_type"]);
}

function resolveDueAt(objectName: ActivityObject, props: Record<string, any>): Date | null {
  const perObject: Record<ActivityObject, string[]> = {
    calls: ["hs_call_scheduled_at"],
    emails: ["hs_email_scheduled_time"],
    meetings: ["hs_meeting_start_time", "hs_meeting_end_time"],
    notes: [],
    tasks: ["hs_task_due_date", "hs_task_reminders_time"]
  };
  const ts = pickFirstTimestamp(props, perObject[objectName] ?? []);
  return ts ?? null;
}

export async function normalizeActivities(): Promise<void> {
  const pg = getDbConnection();
  const { rows } = await pg.query<RawActivityRow>(
    `SELECT object_name, hs_object_id, payload, updated_at
       FROM raw_hubspot.objects_raw
      WHERE object_name = ANY($1::text[])`,
    [ACTIVITY_OBJECTS]
  );

  let processed = 0;
  for (const row of rows) {
    const objectName = row.object_name as ActivityObject;
    const payload = safeJson(row.payload);
    const props = safeJson(payload.properties ?? {});

    const activityId = row.hs_object_id;
    const ownerId = asString(props.hubspot_owner_id);
    const subject = resolveSubject(objectName, props);
    const status = resolveStatus(objectName, props);
    const activityType = resolveActivityType(objectName, props) ?? objectName;

    const createdAt = pickFirstTimestamp(props, ["hs_createdate", "createdate"]) ?? parseTimestamp(payload.createdAt);
    const lastModifiedAt = pickFirstTimestamp(props, ["hs_lastmodifieddate"]) ?? parseTimestamp(payload.updatedAt);
    const dueAt = resolveDueAt(objectName, props);
    const updatedAt = parseTimestamp(row.updated_at ?? payload.updatedAt) ?? lastModifiedAt ?? createdAt;
    const archived = Boolean(payload.archived);
    const rawProps = props;

    await pg.query(
      `INSERT INTO stg.activities (
         object_name, activity_id, owner_id, subject, status, activity_type,
         created_at, last_modified_at, due_at,
         archived, updated_at, raw_properties, ingested_at
       ) VALUES (
         $1,$2,$3,$4,$5,$6,
         $7,$8,$9,
         $10,$11,$12,NOW()
       )
       ON CONFLICT (object_name, activity_id) DO UPDATE SET
         owner_id = EXCLUDED.owner_id,
         subject = EXCLUDED.subject,
         status = EXCLUDED.status,
         activity_type = EXCLUDED.activity_type,
         created_at = EXCLUDED.created_at,
         last_modified_at = EXCLUDED.last_modified_at,
         due_at = EXCLUDED.due_at,
         archived = EXCLUDED.archived,
         updated_at = EXCLUDED.updated_at,
         raw_properties = EXCLUDED.raw_properties,
         ingested_at = NOW()`,
      [
        objectName,
        activityId,
        ownerId,
        subject,
        status,
        activityType,
        createdAt,
        lastModifiedAt,
        dueAt,
        archived,
        updatedAt,
        rawProps
      ]
    );

    processed += 1;
  }

  log.info({ processed }, "activities normalized");
}
