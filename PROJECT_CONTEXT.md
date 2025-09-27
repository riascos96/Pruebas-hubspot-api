# Contexto del Proyecto — HubSpot → PostgreSQL ETL (Node.js 22 + TypeScript)

## Objetivo
Construir un pipeline local (sin Docker ni nubes) que:
1) Conecta a HubSpot mediante Private App token (solo lectura).
2) Descubre el catálogo (objetos, propiedades, pipelines, owners).
3) Extrae todo el contenido disponible (objetos estándar, actividades y, luego, asociaciones).
4) Guarda en Postgres en capas: `meta` (catálogo y estado) y `raw_hubspot` (captura 1:1).
5) Prepara el terreno para limpieza, mapeo y reportería posteriores (capas `stg` y `analytics`).

## Alcance
- Autenticación: Private App token (scopes `.read`).
- Descubrimiento: `/crm/v3/schemas`, `/properties/{obj}`, `/pipelines/{obj}`, `/crm/v3/owners/`.
- Extracción (FULL): `/crm/v3/objects/{object}` → listar IDs y `batch/read` para TODAS las propiedades.
- Extracción (INCREMENTAL): `/crm/v3/objects/{object}/search` por `hs_lastmodifieddate`.
- Objetos objetivo (MVP):
  - Core: `contacts`, `companies`, `deals`, `tickets`, `products`, `line_items`
  - Actividades: `calls`, `emails`, `meetings`, `notes`, `tasks`
  - Metadatos: `owners`, `pipelines`, `properties`
- Reporterías: API `/api/dashboard` y frontend Vite/React con KPIs básicos sobre `stg.*`.
- Persistencia:
  - `meta.*` → catálogo, pipelines, owners, `sync_state`.
  - `raw_hubspot.*` → objetos y asociaciones (payload JSONB completo).
  - `stg.*` → tablas normalizadas para reporting inicial (emails limpios, teléfonos E.164, fechas TIMESTAMPTZ).

## Fuera de Alcance (por ahora)
- Hosting/infra (AWS, Docker, orquestadores).
- Limpieza avanzada y `stg/analytics` (se harán después).
- OAuth multi-cuenta (solo Private App de una cuenta).

## Stack y Decisiones Técnicas
- Runtime: Node.js 22, TypeScript (ESM + `moduleResolution: NodeNext`).
- HTTP: `fetch` nativo + `bottleneck` (rate limiting) + reintentos 429.
- DB: `pg` con Pool singleton reutilizable.
- Logs: `pino`.
- Variables de entorno: sin `dotenv`; usar `node --env-file=.env`.

### Variables de entorno esperadas (`.env`)
```
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
```

## Estructura de carpetas
```
hubspot-etl/
├─ src/
│  ├─ checks/            # pruebas rápidas (DB/HubSpot)
│  ├─ catalog/           # descubrimiento de catálogo
│  ├─ ingest/            # full + incremental (+ asociaciones)
│  ├─ clients/           # cliente HubSpot (fetch + bottleneck)
│  ├─ normalization/     # staging: helpers y scripts hacia `stg.*`
│  ├─ utils/             # db pool, logger, ensureEnv
│  └─ types/             # (opcional)
├─ db/
│  ├─ ddl.sql            # esquemas/tablas meta + raw
│  └─ setup.ts           # aplica DDL en la DB
├─ scripts/              # utilidades (verifyCounts, dump)
├─ .env
├─ package.json
├─ tsconfig.json
└─ README.md / PROJECT_CONTEXT.md
```

## Tablas clave
- `meta.objects`, `meta.properties`, `meta.pipelines`, `meta.owners`, `meta.sync_state`.
- `raw_hubspot.objects_raw`, `raw_hubspot.associations_raw`.
- `stg.contacts`, `stg.companies`, `stg.activities`.
- `dashboard` (API + frontend React) para visualizar KPIs básicos sobre `stg.*` y `raw_hubspot`.

## Flujo de datos
1) Discover → `meta.*`.
2) Full Load → `/objects/{obj}` (listar IDs) + `/batch/read` (todas las propiedades) → `raw_hubspot.objects_raw`.
3) Incremental → `/objects/{obj}/search` (`hs_lastmodifieddate`) → UPSERT y watermark en `meta.sync_state`.
4) Normalización → `raw_hubspot.objects_raw` → `stg.contacts`, `stg.companies`, `stg.activities` (emails/phones limpios + timestamps UTC).
5) Dashboard API → expone KPIs derivados (conversión, carga promedio por owner, actividades/contacto) y datasets agregados.
6) Frontend React → consume `/api/dashboard` y presenta métricas (gráficos doughnut, barras stacked, combo line/bar, etc.).
7) (Próximo) Asociaciones v4 → `raw_hubspot.associations_raw`.
8) (Próximo) Modelos `analytics` sobre `stg.*`.

## Rate Limits y Resiliencia
- List endpoints: ~100 req / 10 s.
- Search: ~5 req / s por token.
- Reintentos con `Retry-After` ante 429.
- Idempotencia: `ON CONFLICT (object_name, hs_object_id)`.

## Backlog inmediato
- Asociaciones v4: batch read para pares comunes (contacts↔companies, deals↔companies, deals↔contacts, etc.).
- Ampliar normalización `stg` a deals, tickets, products y line_items con llaves foráneas hacia contactos/compañías.
- Automatizar la ejecución de `normalize:stg` después de cada ingest (full/inc) y agregar monitoreo de filas procesadas.
- Publicar documentación paso a paso para refrescar dashboard (ingest → normalize → dashboard API → front) y cubrir despliegue multi-entorno.
- Extender dashboards con filtros interactivos, segmentación y drill-down, aprovechando la API enriquecida.
- Dedupe/contact curator: reglas por email/domain + flags de calidad de datos.
- Modelos `analytics` iniciales (KPIs base, funnels) y validaciones de conteos vs HubSpot.
- Seguridad: rotación de token si se expone; limitar scopes `.read` necesarios.
