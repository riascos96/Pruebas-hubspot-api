import { Client } from "pg";

const DB_NAME = process.env.PGDATABASE;
const HOST = process.env.PGHOST || "localhost";
const PORT = Number(process.env.PGPORT || 5432);
const USER = process.env.PGUSER || "postgres";
const PASSWORD = process.env.PGPASSWORD || "";
// DB a la que nos conectamos para administrar (no la de destino)
const ADMIN_DB = process.env.PGADMIN_DB || "postgres";
const OWNER = process.env.PGOWNER || USER;

if (!DB_NAME) {
  console.error("PGDATABASE no está definido en el entorno (.env)");
  process.exit(1);
}

async function main() {
  const admin = new Client({ host: HOST, port: PORT, user: USER, password: PASSWORD, database: ADMIN_DB });
  await admin.connect();
  try {
    const exists = await admin.query("SELECT 1 FROM pg_database WHERE datname = $1", [DB_NAME]);
    if (exists.rowCount) {
      console.log(`DB ya existe: ${DB_NAME}`);
      return;
    }
    console.log(`Creando database ${DB_NAME} con owner ${OWNER}...`);
    // Nota: CREATE DATABASE no soporta parámetros, por eso interpolamos con nombres escapados.
    const dbId = DB_NAME.replaceAll('"', '""');
    const ownerId = OWNER.replaceAll('"', '""');
    await admin.query(`CREATE DATABASE "${dbId}" WITH OWNER = "${ownerId}" ENCODING 'UTF8'`);
    console.log("Database creada");
  } finally {
    await admin.end();
  }
}

main().catch((e) => {
  console.error("Error creando la DB:", e.message);
  process.exit(1);
});

