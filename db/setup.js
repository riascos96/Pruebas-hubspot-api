import { readFileSync } from "node:fs";
import { getDbConnection } from "../src/utils/dbConnection";
(async () => {
    const pool = getDbConnection();
    const sql = readFileSync("db/ddl.sql", "utf8");
    await pool.query(sql);
    console.log("DB: esquemas/tablas creadas");
})();
//# sourceMappingURL=setup.js.map