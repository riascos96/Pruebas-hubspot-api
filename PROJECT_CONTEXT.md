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
- Persistencia:
  - `meta.*` → catálogo, pipelines, owners, `sync_state`.
  - `raw_hubspot.*` → objetos y asociaciones (payload JSONB completo).

## Fuera de Alcance (por ahora)
- Hosting/infra (AWS, Docker, orquestadores).
- Frontend/UI de dashboards.
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

## Flujo de datos
1) Discover → `meta.*`.
2) Full Load → `/objects/{obj}` (listar IDs) + `/batch/read` (todas las propiedades) → `raw_hubspot.objects_raw`.
3) Incremental → `/objects/{obj}/search` (`hs_lastmodifieddate`) → UPSERT y watermark en `meta.sync_state`.
4) (Próximo) Asociaciones v4 → `raw_hubspot.associations_raw`.
5) (Próximo) Normalización a `stg` y modelos `analytics`.

## Rate Limits y Resiliencia
- List endpoints: ~100 req / 10 s.
- Search: ~5 req / s por token.
- Reintentos con `Retry-After` ante 429.
- Idempotencia: `ON CONFLICT (object_name, hs_object_id)`.

## Backlog inmediato
- Asociaciones v4: batch read para pares comunes (contacts↔companies, deals↔companies, deals↔contacts, etc.).
- Normalización mínima (stg): emails en minúsculas, teléfonos E.164, dedupe por email/domain, fechas UTC.
- KPIs base: conteos por objeto/ventana de tiempo; diferencias vs HubSpot (script verifyCounts).
- Seguridad: rotación de token si se expone; limitar scopes `.read` necesarios.

