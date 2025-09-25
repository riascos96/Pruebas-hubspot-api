# HubSpot → PostgreSQL ETL (Node.js 22 + TypeScript)

Pipeline local  para extraer datos de HubSpot y persistirlos en PostgreSQL en capas meta (catálogo/estado) y raw_hubspot (captura 1:1). Pensado para habilitar limpieza, mapeo y reportería posteriores.

## Características
- ESM + TypeScript con `moduleResolution: NodeNext` (imports relativos con extensión `.js`).
- Cliente HubSpot con `fetch` nativo, rate limiting (`bottleneck`) y reintentos ante 429 (Retry-After).
- Ingesta FULL e INCREMENTAL para objetos core y actividades.
- Catálogo de objetos, propiedades, pipelines y owners.
- Persistencia en PostgreSQL con upsert idempotente.

## Requisitos
- macOS/Linux/Windows
- Node.js 22+
- PostgreSQL 13+
- Acceso a una cuenta de HubSpot (Private App Token con scopes de solo lectura)

## Instalación
1) Clonar e instalar dependencias
```bash
git clone <repo-url>
cd Pruebas-hubspot-api
npm ci
```

2) Configurar variables de entorno (`.env` en la raíz)
```dotenv
HUBSPOT_TOKEN=pat-xxxxxxxxxxxxxxxx
HUBSPOT_BASE_URL=https://api.hubapi.com

PGHOST=localhost
PGPORT=5432
PGDATABASE=hubspot_dw
PGUSER=postgres
PGPASSWORD=postgres

PGPOOL_MAX=20
PG_IDLE_MS=30000
PG_CONN_MS=2000
# PGSSL=require
LOG_LEVEL=info

# Opcional (red/proxy)
# NET_CONNECT_TIMEOUT_MS=30000
# HTTPS_PROXY=http://usuario:pass@proxy:puerto
```

3) Crear base de datos (si no existe)
```bash
# Opción recomendada: crear desde tu cliente (DBeaver) con el nombre de PGDATABASE
# Alternativa por script
npm run db:create
```

4) Crear esquemas/tablas
```bash
npm run db:setup
```

5) Verificar conectividad
```bash
npm run check:db   # SELECT NOW()
npm run check:hs   # Llamada simple a HubSpot (contacts?limit=1)
```

## Comandos disponibles
- `npm run db:create` — Crea la base `PGDATABASE` si no existe (conecta a `postgres`).
- `npm run db:setup` — Aplica `db/ddl.sql` para crear `meta.*` y `raw_hubspot.*`.
- `npm run db:init` — Ejecuta `db:create` y luego `db:setup`.
- `npm run check:db` — Verifica conexión a PostgreSQL.
- `npm run check:hs` — Verifica acceso a HubSpot.
- `npm run catalog:discover` — Descubre catálogo: schemas, properties, pipelines, owners → `meta.*`.
- `npm run ingest:full` — Carga FULL de objetos objetivo. Usa batch read para traer TODAS las propiedades.
- `npm run ingest:full:one -- <obj>` — FULL de un solo objeto (ej. `contacts`).
- `npm run ingest:inc` — Carga INCREMENTAL por `hs_lastmodifieddate`. Trae todas las propiedades.
- `npm run verify:counts` — Compara conteos HS vs DB por objeto (sanity check).
- `npm run debug:dump -- <obj> [id]` — Muestra propiedades en DB y en API para depurar.
- `npm run normalize:stg` — Limpia y normaliza `contacts`, `companies` y actividades hacia `stg.*`.

## Objetos cubiertos (MVP)
- Core: `contacts`, `companies`, `deals`, `tickets`, `products`, `line_items`
- Actividades: `calls`, `emails`, `meetings`, `notes`, `tasks`

## Esquema de datos (PostgreSQL)
- `meta.objects` — Catálogo de objetos (estándar/custom)
- `meta.properties` — Propiedades por objeto
- `meta.pipelines` — Pipelines por objeto
- `meta.owners` — Dueños
- `meta.sync_state` — Estado de sincronización (paginación y/o watermark)
- `raw_hubspot.objects_raw` — Payload 1:1 por objeto + `updated_at` y `ingested_at`
- `raw_hubspot.associations_raw` — Asociaciones v4 (cuando se habilite el ingestor)
- `stg.contacts` — Contactos con emails estandarizados, teléfonos limpios y fechas en TIMESTAMPTZ
- `stg.companies` — Empresas con dominio, teléfonos y owner normalizados
- `stg.activities` — Actividades (`calls/emails/meetings/notes/tasks`) con metadatos clave y payload plano

## Flujo
1. `catalog:discover` → pobla `meta.*` (schemas/properties/pipelines/owners)
2. `ingest:full` → lista IDs por página y hace `batch/read` para traer TODAS las propiedades; UPSERT en `raw_hubspot.objects_raw`
3. `ingest:inc` → `/search` por `hs_lastmodifieddate` ascendente; UPSERT y actualiza `meta.sync_state`
4. `normalize:stg` → lee de `raw_hubspot.objects_raw` y consolida en tablas `stg.*` listas para reporting/analytics

## Buenas prácticas y notas
- ESM NodeNext: en TypeScript, los imports relativos deben terminar en `.js`.
- El cliente maneja 429 con `Retry-After` y usa `bottleneck` para rate limiting.
- Tiempos de red: ajusta `NET_CONNECT_TIMEOUT_MS` si tienes conexiones lentas.
- Proxy corporativo: define `HTTPS_PROXY`/`HTTP_PROXY`. El cliente intentará honrarlo.
- `updated_at` en DB: usa `hs_lastmodifieddate`, si no está usa `createdate`, si no hay ninguno usa `NOW()`.

## Solución de problemas
- Asegúrate de conectarte a la DB de `.env` (p.ej. `hubspot_dw`) y al esquema correcto (`raw_hubspot`). Valida con:
  ```sql
  SELECT current_database(), current_user, inet_server_addr(), inet_server_port();
  SELECT object_name, COUNT(*) FROM raw_hubspot.objects_raw GROUP BY 1 ORDER BY 1;
  ```
- Timeouts de red → incrementa `NET_CONNECT_TIMEOUT_MS`.
- Proxy corporativo → exporta `HTTPS_PROXY` y reintenta. 
- Desbalance HS/DB → `npm run verify:counts` y, si falta backfill para un objeto concreto, `npm run ingest:full:one -- <obj>`.

## Licencia
ISC (ver `package.json`).
