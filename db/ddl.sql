CREATE SCHEMA IF NOT EXISTS meta;
CREATE SCHEMA IF NOT EXISTS raw_hubspot;

CREATE TABLE IF NOT EXISTS meta.objects (
  object_type_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  label TEXT,
  is_custom BOOLEAN NOT NULL DEFAULT FALSE,
  payload JSONB NOT NULL,
  discovered_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS meta.properties (
  object_name TEXT NOT NULL,
  name TEXT NOT NULL,
  label TEXT,
  type TEXT,
  field_type TEXT,
  payload JSONB NOT NULL,
  PRIMARY KEY (object_name, name)
);

CREATE TABLE IF NOT EXISTS meta.pipelines (
  object_name TEXT NOT NULL,
  pipeline_id TEXT NOT NULL,
  label TEXT,
  payload JSONB NOT NULL,
  PRIMARY KEY (object_name, pipeline_id)
);

CREATE TABLE IF NOT EXISTS meta.owners (
  owner_id BIGINT PRIMARY KEY,
  email TEXT,
  first_name TEXT,
  last_name TEXT,
  payload JSONB NOT NULL,
  discovered_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS meta.sync_state (
  entity TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'object',
  last_after TEXT,
  last_updated_at TIMESTAMPTZ,
  PRIMARY KEY (entity, kind)
);

CREATE TABLE IF NOT EXISTS raw_hubspot.objects_raw (
  object_name TEXT NOT NULL,
  hs_object_id TEXT NOT NULL,
  updated_at TIMESTAMPTZ,
  payload JSONB NOT NULL,
  ingested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (object_name, hs_object_id)
);

CREATE TABLE IF NOT EXISTS raw_hubspot.associations_raw (
  from_object TEXT NOT NULL,
  from_id TEXT NOT NULL,
  to_object TEXT NOT NULL,
  to_id TEXT NOT NULL,
  labels TEXT[],
  payload JSONB NOT NULL,
  ingested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (from_object, from_id, to_object, to_id)
);
