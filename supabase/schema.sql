-- ============================================================================
-- Esquema Supabase — Calculadora de Letalidad Térmica (F0 / FH)
-- ============================================================================
-- Acceso libre, sin autenticación: las políticas RLS quedan abiertas (true)
-- para la anon key. No hay audit trail ni firmas: es cálculo matemático puro.
--
-- Modelo (v2 — reestructurado a partir del análisis de validaciones reales
-- de autoclave/horno): un proyecto es UN EQUIPO en calificación (ej.
-- "Autoclave CCAV0401"). Un equipo tiene:
--   - probes: las termocuplas físicas usadas, cada una con su certificado
--     de calibración (2-3 puntos), reutilizadas entre corridas.
--   - runs: las corridas del estudio (cámara vacía, cámara cargada x3,
--     distintos setpoints…). Cada corrida tiene su propia hoja de datos,
--     su propio setpoint (Tref/z — el mismo equipo puede correr a 115°C y
--     121°C en corridas distintas) y su propio punto de inicio de conteo.
--
-- Ejecutar en: Supabase Dashboard -> SQL Editor -> New query -> Run
-- ============================================================================

create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- projects: un equipo en calificación.
-- ----------------------------------------------------------------------------
create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Proyecto sin título',
  description text,
  equipment_code text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Si la tabla projects ya existía del esquema v1, el "if not exists" de
-- arriba la deja intacta y esta columna nueva no se crearía. Este alter la
-- agrega en ese caso, y es inofensivo en una instalación nueva.
alter table projects add column if not exists equipment_code text;

-- ----------------------------------------------------------------------------
-- probes: termocuplas físicas del equipo. La calibración vive acá porque es
-- del sensor, no de la corrida: el mismo certificado (2 o 3 puntos) se
-- reutiliza en todas las corridas del estudio, tal como está armado en las
-- planillas reales que se tomaron de referencia.
--
-- calibration_points: [{ "equi": number, "tcv": number }, ...] — 2 o 3
-- puntos, con los nombres de columna de las planillas de referencia:
--   equi = lo que leyó ESE canal en el punto de calibración (mismo dominio
--          que la data cruda de la corrida)
--   tcv  = el valor certificado del patrón en ese punto
-- Se ajusta tcv = f(equi) por cuadrados mínimos (igual que FORECAST.LINEAR
-- de Excel) y esa recta corrige cada lectura cruda:
--   corregida = intercepto + pendiente · cruda
-- Con 2 puntos la recta pasa exacta por ambos; con 3, es la mejor recta.
-- ----------------------------------------------------------------------------
create table if not exists probes (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,

  code text not null,
  color text not null default '#008300',
  sort_order integer not null default 0,

  calibration_points jsonb not null default '[]'::jsonb,
  calibration_cert_number text,
  calibration_date date,
  certificate_file_url text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (project_id, code)
);

create index if not exists idx_probes_project_id on probes(project_id);

-- ----------------------------------------------------------------------------
-- runs: una corrida del estudio (una hoja de datos completa). Las columnas
-- de sensores de una corrida son siempre todos los probes del proyecto
-- (ver nota debajo de la tabla) — raw_data.series usa los ids de probes
-- como claves.
--
-- start_index: índice de fila (0-based) desde donde arranca el conteo de
-- F0/FH. En las planillas reales esto se elige a mano mirando el gráfico
-- (no hay una regla fija de temperatura/tiempo) — acá se marca desde la
-- hoja de datos. Filas antes de start_index no aportan letalidad.
--
-- raw_data: {"time": number[], "series": {probeId: (number|null)[]}} —
-- única fuente de verdad de las temperaturas crudas de la corrida.
--
-- results_summary: cache por probe con AMBOS métodos de integración, para
-- listar sin recalcular:
--   {probeId: {f0Trap, fhTrap, f0Sum, fhSum}}
-- Todas las corridas de un proyecto usan las mismas termocuplas (así están
-- armadas las planillas reales que se tomaron de referencia: un mismo set
-- de ~12 sensores se repite en cada corrida del equipo), así que una
-- corrida no cura su propio subconjunto de probes — siempre son todos los
-- del proyecto, en su sort_order. raw_data.series puede tener menos claves
-- si un probe se agregó después; la hoja lo muestra igual con celdas vacías.
-- ----------------------------------------------------------------------------
create table if not exists runs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,

  name text not null default 'Corrida sin título',
  sort_order integer not null default 0,

  ref_temp_f0 numeric not null default 121.1,
  z_value_f0 numeric not null default 10,
  ref_temp_fh numeric not null default 250,
  z_value_fh numeric not null default 54,
  time_unit text not null default 'min' check (time_unit in ('s', 'min')),

  start_index integer not null default 0,
  raw_data jsonb not null default '{"time": [], "series": {}}'::jsonb,
  results_summary jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_runs_project_id on runs(project_id);

comment on column runs.start_index is
  'Fila (0-based) desde donde arranca el conteo de F0/FH. Se marca a mano en la hoja de datos.';
comment on column runs.raw_data is
  'Data cruda de la corrida: {time:number[], series:{probeId:number[]}}. Única fuente de verdad.';

-- ----------------------------------------------------------------------------
-- updated_at automático
-- ----------------------------------------------------------------------------
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_projects_updated_at on projects;
create trigger trg_projects_updated_at
  before update on projects
  for each row execute function set_updated_at();

drop trigger if exists trg_probes_updated_at on probes;
create trigger trg_probes_updated_at
  before update on probes
  for each row execute function set_updated_at();

drop trigger if exists trg_runs_updated_at on runs;
create trigger trg_runs_updated_at
  before update on runs
  for each row execute function set_updated_at();

-- ----------------------------------------------------------------------------
-- RLS: acceso abierto de lectura/escritura vía anon key (sin autenticación,
-- por requisito explícito del proyecto).
-- ----------------------------------------------------------------------------
alter table projects enable row level security;
alter table probes enable row level security;
alter table runs enable row level security;

drop policy if exists "allow all projects" on projects;
create policy "allow all projects" on projects for all using (true) with check (true);

drop policy if exists "allow all probes" on probes;
create policy "allow all probes" on probes for all using (true) with check (true);

drop policy if exists "allow all runs" on runs;
create policy "allow all runs" on runs for all using (true) with check (true);

-- ----------------------------------------------------------------------------
-- Storage: bucket público para PDFs de certificados de calibración.
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('calibration-certs', 'calibration-certs', true)
on conflict (id) do nothing;

drop policy if exists "allow all calibration-certs" on storage.objects;
create policy "allow all calibration-certs" on storage.objects
  for all
  using (bucket_id = 'calibration-certs')
  with check (bucket_id = 'calibration-certs');

-- ============================================================================
-- ¿Venís del esquema v1 (proyecto plano, sin corridas)?
-- ============================================================================
-- Este archivo es idempotente: correrlo sobre una base v1 crea las tablas
-- nuevas y agrega la columna que faltaba, sin tocar los datos viejos.
--
-- Para MIGRAR esos datos viejos al modelo nuevo (una corrida por proyecto,
-- offsets convertidos a puntos de calibración equivalentes), ejecutar
-- después: supabase/migration_v1_to_v2.sql
-- ============================================================================
