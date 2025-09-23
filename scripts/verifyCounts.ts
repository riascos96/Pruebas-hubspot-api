import { hsGetJson } from "../src/clients/hubspot.js";
import { getDbConnection } from "../src/utils/dbConnection.js";

const OBJECTS_ALL = [
  "contacts","companies","deals","tickets","products","line_items",
  "calls","emails","meetings","notes","tasks"
];

async function countHubSpot(name: string): Promise<number> {
  let after: string | undefined;
  let total = 0;
  while (true) {
    const data = await hsGetJson(`/crm/v3/objects/${name}`, { limit: 100, archived: false, ...(after ? { after } : {}) });
    total += (data.results?.length ?? 0);
    after = data.paging?.next?.after;
    if (!after) break;
  }
  return total;
}

async function countDb(name: string): Promise<number> {
  const pg = getDbConnection();
  const { rows } = await pg.query(
    `SELECT COUNT(*)::int AS c FROM raw_hubspot.objects_raw WHERE object_name=$1`,
    [name]
  );
  return rows[0]?.c ?? 0;
}

async function main() {
  const results: Array<{ name: string; hs: number; db: number; diff: number }> = [];
  for (const name of OBJECTS_ALL) {
    try {
      const [hs, db] = await Promise.all([countHubSpot(name), countDb(name)]);
      results.push({ name, hs, db, diff: hs - db });
    } catch (e: any) {
      results.push({ name, hs: -1, db: -1, diff: 0 });
      console.error("Error contando", name, e?.message ?? e);
    }
  }
  results.forEach(r => {
    console.log(`${r.name.padEnd(12)} HS=${r.hs.toString().padStart(4)}  DB=${r.db.toString().padStart(4)}  DIFF=${r.diff >= 0 ? "+" : ""}${r.diff}`);
  });
}

if (import.meta.main) main().catch(e => { console.error(e); process.exit(1); });

