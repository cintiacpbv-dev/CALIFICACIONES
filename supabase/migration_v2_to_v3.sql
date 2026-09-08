-- ============================================================================
-- Migración v2 -> v3 — criterios de aceptación + condición de trabajo
-- ============================================================================
-- Bloque mínimo para bases que ya corrieron el esquema v2. Es exactamente el
-- subconjunto nuevo de supabase/schema.sql (que también es idempotente y se
-- puede volver a correr entero sin riesgo); este archivo existe para no
-- tener que re-ejecutar todo.
--
-- No migra datos: sólo agrega columnas nullables. Un criterio en null
-- significa "no definido" y la app lo muestra como «sin criterio», no como
-- incumplimiento.
--
-- Ejecutar en: Supabase Dashboard -> SQL Editor -> New query -> Run
-- ============================================================================

-- Criterios de aceptación de la corrida + cache del veredicto.
alter table runs add column if not exists acceptance_summary jsonb not null default '{}'::jsonb;
alter table runs add column if not exists f0_min_required numeric;
alter table runs add column if not exists fh_min_required numeric;
alter table runs add column if not exists temp_low_limit numeric;
alter table runs add column if not exists temp_high_limit numeric;

-- Condición de trabajo (encabezado del informe).
alter table runs add column if not exists run_date date;
alter table runs add column if not exists batch_code text;
alter table runs add column if not exists cycle_code text;
alter table runs add column if not exists load_description text;
alter table runs add column if not exists operator text;
alter table runs add column if not exists notes text;

comment on column runs.acceptance_summary is
  'Cache del veredicto de aceptación {verdict, checks[]} para listar el estudio sin recalcular. Derivado, se puede borrar.';
comment on column runs.f0_min_required is
  'F0 mínimo exigido (min) para aceptar la corrida. null = sin criterio definido.';
comment on column runs.fh_min_required is
  'FH mínimo exigido (min) para aceptar la corrida. null = sin criterio definido.';
comment on column runs.temp_low_limit is
  'Límite inferior de temperatura (°C) dentro de la ventana de conteo. null = sin criterio.';
comment on column runs.temp_high_limit is
  'Límite superior de temperatura (°C) dentro de la ventana de conteo. null = sin criterio.';
comment on column runs.load_description is
  'Descripción de la carga (cámara vacía, N viales, etc.). Va al encabezado del informe.';
