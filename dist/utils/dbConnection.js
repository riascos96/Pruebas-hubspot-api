import { Pool } from "pg";
function loadPgConfig() {
    const ssl = (process.env.PGSSL || "").toLowerCase();
    return {
        host: process.env.PGHOST,
        user: process.env.PGUSER,
        database: process.env.PGDATABASE,
        password: process.env.PGPASSWORD,
        port: Number(process.env.PGPORT || 5432),
        max: Number(process.env.PGPOOL_MAX || 20),
        idleTimeoutMillis: Number(process.env.PG_IDLE_MS || 30000),
        connectionTimeoutMillis: Number(process.env.PG_CONN_MS || 2000),
        ssl: ssl === "require" || ssl === "true" ? { rejectUnauthorized: false } : undefined
    };
}
const g = globalThis;
if (!g.__PG_POOL__) {
    g.__PG_POOL__ = new Pool(loadPgConfig());
    g.__PG_POOL__.on("error", (err) => console.error("[pg] Pool error:", err));
}
const pool = g.__PG_POOL__;
export function getDbConnection() { return pool; }
export async function verifyDbConnection() {
    const client = await pool.connect();
    try {
        await client.query("SELECT 1");
        return true;
    }
    finally {
        client.release();
    }
}
//# sourceMappingURL=dbConnection.js.map