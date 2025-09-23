import { getDbConnection, verifyDbConnection } from "../utils/dbConnection.js";
(async () => {
    const ok = await verifyDbConnection();
    if (!ok)
        throw new Error("DB no disponible");
    const { rows } = await getDbConnection().query("SELECT NOW() as now");
    console.log("DB OK:", rows[0].now);
})();
//# sourceMappingURL=checkDb.js.map