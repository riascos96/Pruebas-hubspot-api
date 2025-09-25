# Change Log

Todos los cambios notables de este proyecto serán documentados en este archivo.

El formato se inspira en “Keep a Changelog” y sigue SemVer.

## [1.1.0] - 2025-09-24

### Agregado
- Esquema `stg` con tablas normalizadas para contactos, compañías y actividades (calls/emails/meetings/notes/tasks).
- Script `npm run normalize:stg` para consolidar datos desde `raw_hubspot.objects_raw` hacia `stg.*`.
- Utilidades de normalización para limpiar emails, teléfonos y fechas antes de cargar a staging.

### Modificado
- README con instrucciones para ejecutar la normalización y descripción de las nuevas tablas.
- DDL principal para crear índices de email y dominio sobre las tablas `stg`.
- Proceso incremental ajustado para evitar avanzar el watermark cuando `hs_lastmodifieddate` viene vacío.

### Corregido
- Prevención de timestamp `null` al evaluar el mayor `hs_lastmodifieddate` visto en la carga incremental.

## [1.0.0] - 2024-12-09

### Agregado
- Pipeline local HubSpot → PostgreSQL (Node.js 22 + TypeScript).
- Descubrimiento de catálogo: schemas, properties, pipelines y owners (`catalog:discover`).
- Ingesta FULL con `batch/read` para traer TODAS las propiedades por objeto.
- Ingesta INCREMENTAL por `hs_lastmodifieddate` (`/search`).
- Manejo de rate limits (Bottleneck) y reintentos ante 429 (Retry-After).
- Esquemas/tablas: `meta.*`, `raw_hubspot.objects_raw`, `raw_hubspot.associations_raw`.
- Scripts de verificación y diagnóstico: `check:db`, `check:hs`, `verify:counts`, `debug:dump`.

### Corregido
- Imports ESM con extensión `.js` para `moduleResolution: NodeNext`.
- Tipos `pg` con `import type` (verbatimModuleSyntax).
- Cálculo de `updated_at` con fallback (`hs_lastmodifieddate` → `createdate` → `NOW()`).
- Construcción correcta de `properties` (parámetros repetidos) y uso de `batch/read` para payload completo.

### Modificado
- Cliente HTTP para usar `fetch` nativo con timeout configurable.
- Scripts npm migrados a `node --env-file=.env --import tsx/esm`.

### Removido
- Dependencias innecesarias para proxy por defecto (uso opcional de `undici` si se requiere).
