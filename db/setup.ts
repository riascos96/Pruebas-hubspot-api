import { readFileSync } from "node:fs";
import { getDbConnection } from "../src/utils/dbConnection.js";
(async () => {
  const pool = getDbConnection();
  const sql = readFileSync("db/ddl.sql", "utf8");
  await pool.query(sql);
  console.log("DB: esquemas/tablas creadas");
})();
