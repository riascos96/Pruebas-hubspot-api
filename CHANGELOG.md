# Change Log

Todos los cambios notables de este proyecto serán documentados en este archivo.

El formato se inspira en “Keep a Changelog” y sigue SemVer.

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

