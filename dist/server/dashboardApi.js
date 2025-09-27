import { createServer, IncomingMessage, ServerResponse } from "node:http";
import { getDbConnection } from "../utils/dbConnection.js";
import { log } from "../utils/logger.js";
const port = Number(process.env.DASHBOARD_API_PORT || 4000);
const corsOrigin = process.env.DASHBOARD_API_CORS || "*";
function setCors(res) {
    res.setHeader("Access-Control-Allow-Origin", corsOrigin);
    res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}
function sendJson(res, status, payload) {
    res.statusCode = status;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify(payload));
}
function getPathname(req) {
    const url = req.url ?? "/";
    try {
        return new URL(url, `http://${req.headers.host ?? "localhost"}`).pathname;
    }
    catch {
        return "/";
    }
}
function toMetric(rows) {
    return rows.map((row) => ({
        label: row.label && row.label.trim().length ? row.label : "Sin dato",
        count: Number(row.count ?? 0) || 0
    }));
}
function toOwnerStatus(rows) {
    return rows.map((row) => ({
        owner: row.owner && row.owner.trim().length ? row.owner : "No asignado",
        status: row.status && row.status.trim().length ? row.status : "Sin estado",
        count: Number(row.count ?? 0) || 0
    }));
}
async function fetchDashboard() {
    const pg = getDbConnection();
    const [summaryRow, statusRows, ownerRows, monthlyRows, companyRows, activityRows, ownerStatusRows, activitiesMonthlyRows] = await Promise.all([
        pg.query(`SELECT
           (SELECT COUNT(*)::int FROM stg.contacts) AS contacts,
           (SELECT COUNT(*)::int FROM stg.companies) AS companies,
           (SELECT COUNT(*)::int FROM stg.activities) AS activities,
           (SELECT COUNT(*)::int FROM raw_hubspot.objects_raw WHERE object_name = 'deals') AS deals,
           (
             SELECT COUNT(DISTINCT COALESCE(NULLIF(TRIM(CONCAT_WS(' ', mo.first_name, mo.last_name)), ''), mo.email, sc.owner_id, 'No asignado'))
               FROM stg.contacts sc
               LEFT JOIN meta.owners mo ON mo.owner_id::text = sc.owner_id
           ) AS contact_owners`).then((res) => res.rows[0]),
        pg.query(`SELECT COALESCE(NULLIF(lead_status, ''), 'Sin estado') AS label, COUNT(*)::int AS count
           FROM stg.contacts
          GROUP BY 1
          ORDER BY count DESC`).then((res) => res.rows),
        pg.query(`SELECT COALESCE(NULLIF(TRIM(CONCAT_WS(' ', mo.first_name, mo.last_name)), ''), mo.email, sc.owner_id, 'No asignado') AS label,
              COUNT(*)::int AS count
         FROM stg.contacts sc
         LEFT JOIN meta.owners mo ON mo.owner_id::text = sc.owner_id
        GROUP BY 1
        ORDER BY count DESC
        LIMIT 10`).then((res) => res.rows),
        pg.query(`SELECT to_char(date_trunc('month', created_at), 'YYYY-MM') AS label,
              COUNT(*)::int AS count
         FROM stg.contacts
        WHERE created_at IS NOT NULL
          AND created_at >= NOW() - INTERVAL '12 months'
        GROUP BY 1
        ORDER BY label`).then((res) => res.rows),
        pg.query(`SELECT COALESCE(NULLIF(TRIM(CONCAT_WS(' ', mo.first_name, mo.last_name)), ''), mo.email, sc.owner_id, 'No asignado') AS label,
                COUNT(*)::int AS count
           FROM stg.companies sc
           LEFT JOIN meta.owners mo ON mo.owner_id::text = sc.owner_id
          GROUP BY 1
          ORDER BY count DESC
          LIMIT 10`).then((res) => res.rows),
        pg.query(`SELECT object_name AS label, COUNT(*)::int AS count
         FROM stg.activities
        GROUP BY 1
        ORDER BY count DESC`).then((res) => res.rows),
        pg.query(`WITH contacts_enriched AS (
           SELECT
             COALESCE(NULLIF(TRIM(CONCAT_WS(' ', mo.first_name, mo.last_name)), ''), mo.email, sc.owner_id, 'No asignado') AS owner_label,
             COALESCE(NULLIF(sc.lead_status, ''), 'Sin estado') AS status_label
           FROM stg.contacts sc
           LEFT JOIN meta.owners mo ON mo.owner_id::text = sc.owner_id
         ), top_owners AS (
           SELECT owner_label
             FROM contacts_enriched
            GROUP BY 1
            ORDER BY COUNT(*) DESC
            LIMIT 5
         )
         SELECT ce.owner_label AS owner,
                ce.status_label AS status,
                COUNT(*)::int AS count
           FROM contacts_enriched ce
           JOIN top_owners t ON t.owner_label = ce.owner_label
          GROUP BY ce.owner_label, ce.status_label
          ORDER BY ce.owner_label, ce.status_label`).then((res) => res.rows),
        pg.query(`SELECT to_char(date_trunc('month', created_at), 'YYYY-MM') AS label,
                COUNT(*)::int AS count
           FROM stg.activities
          WHERE created_at IS NOT NULL
            AND created_at >= NOW() - INTERVAL '12 months'
          GROUP BY 1
          ORDER BY label`).then((res) => res.rows)
    ]);
    return {
        summary: {
            contacts: Number(summaryRow?.contacts ?? 0) || 0,
            companies: Number(summaryRow?.companies ?? 0) || 0,
            activities: Number(summaryRow?.activities ?? 0) || 0,
            deals: Number(summaryRow?.deals ?? 0) || 0,
            contactOwners: Number(summaryRow?.contact_owners ?? 0) || 0
        },
        kpis: (() => {
            const contacts = Number(summaryRow?.contacts ?? 0) || 0;
            const deals = Number(summaryRow?.deals ?? 0) || 0;
            const activities = Number(summaryRow?.activities ?? 0) || 0;
            const owners = Number(summaryRow?.contact_owners ?? 0) || 0;
            const conversionRate = contacts > 0 ? deals / contacts : null;
            const averageContactsPerOwner = owners > 0 ? contacts / owners : null;
            const activitiesPerContact = contacts > 0 ? activities / contacts : null;
            return { conversionRate, averageContactsPerOwner, activitiesPerContact };
        })(),
        contactsByStatus: toMetric(statusRows ?? []),
        contactsByOwner: toMetric(ownerRows ?? []),
        contactsMonthly: toMetric(monthlyRows ?? []),
        companiesByOwner: toMetric(companyRows ?? []),
        activitiesByType: toMetric(activityRows ?? []),
        contactsByOwnerStatus: toOwnerStatus(ownerStatusRows ?? []),
        activitiesMonthly: toMetric(activitiesMonthlyRows ?? [])
    };
}
async function handleDashboard(res) {
    try {
        const payload = await fetchDashboard();
        sendJson(res, 200, payload);
    }
    catch (error) {
        log.error({ err: error }, "dashboard query failed");
        sendJson(res, 500, { message: "Error consultando datos" });
    }
}
async function routeRequest(req, res) {
    setCors(res);
    if (req.method === "OPTIONS") {
        res.statusCode = 204;
        res.end();
        return;
    }
    const pathname = getPathname(req);
    if (req.method === "GET" && pathname === "/health") {
        sendJson(res, 200, { ok: true });
        return;
    }
    if (req.method === "GET" && pathname === "/api/dashboard") {
        await handleDashboard(res);
        return;
    }
    sendJson(res, 404, { message: "Not found" });
}
const server = createServer((req, res) => {
    void routeRequest(req, res);
});
server.listen(port, () => {
    log.info({ port }, "Dashboard API listening");
});
const tidyShutdown = (signal) => {
    log.info({ signal }, "Shutting down dashboard API");
    server.close((err) => {
        if (err) {
            log.error({ err }, "Error closing server");
            process.exit(1);
        }
        process.exit(0);
    });
};
process.on("SIGINT", tidyShutdown);
process.on("SIGTERM", tidyShutdown);
//# sourceMappingURL=dashboardApi.js.map