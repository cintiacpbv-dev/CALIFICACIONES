-- ============================================================================
-- Esquema Supabase — Calculadora de Letalidad Térmica (F0 / FH)
-- ============================================================================
-- Acceso libre, sin autenticación: las políticas RLS quedan abiertas (true)
-- para la anon key. No hay audit trail ni firmas: es cálculo matemático puro.
--
-- Ejecutar en: Supabase Dashboard -> SQL Editor -> New query -> Run
-- ============================================================================

create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- projects: un proyecto = un lote/corrida de estudio de penetración de calor.
-- La grilla completa (tiempo + una serie por sensor) vive en raw_data como
-- JSONB: es un único blob que se autoguarda entero en cada cambio, en vez de
-- una fila por celda. Encaja con el patrón "hoja de cálculo pegada de una
-- vez" y evita miles de upserts por segundo mientras el usuario edita.
--
-- Forma de raw_data:
--   {
--     "time": [0, 1, 2, 3, ...],                 -- vector de tiempo (num)
--     "series": {
--       "<sensor_id>": [20.1, 45.3, 98.2, ...],   -- temperatura cruda
--       "<sensor_id>": [19.8, 44.9, 97.5, ...]
--     }
--   }
--
-- La "Data Corregida" (raw + offset) y las curvas de letalidad NO se
-- persisten: son puramente derivadas de raw_data + sensors.offset_celsius,
-- así que se recalculan en el cliente (ver src/lib/lethality.js). Guardar un
-- duplicado corregido violaría la única fuente de verdad y podría
-- desincronizarse del offset vigente.
--
-- results_summary sí se persiste (F0/FH final por sensor) para poder listar
-- el panel de proyectos sin recalcular todo cada vez.
-- ----------------------------------------------------------------------------
create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Proyecto sin título',
  description text,

  -- Parámetros de referencia para F0 (esterilización estándar)
  ref_temp_f0 numeric not null default 121.1,
  z_value_f0 numeric not null default 10,

  -- Parámetros de referencia para FH (configurables: distinto producto o
  -- proceso puede usar otra temperatura/z de referencia)
  ref_temp_fh numeric not null default 100,
  z_value_fh numeric not null default 10,

  time_unit text not null default 'min' check (time_unit in ('s', 'min')),

  raw_data jsonb not null default '{"time": [], "series": {}}'::jsonb,
  results_summary jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on column projects.raw_data is
  'Data cruda de la hoja: {time:number[], series:{sensorId:number[]}}. Única fuente de verdad de las temperaturas.';
comment on column projects.results_summary is
  'Cache de resultados F0/FH por sensor para listar sin recalcular: {sensorId:{f0,fh,points}}';

-- ----------------------------------------------------------------------------
-- sensors: una fila por termocupla/sensor del proyecto. El offset y los
-- datos de calibración viven junto al sensor porque son 1:1 con él — no se
-- crea una tabla de "calibraciones" aparte para no over-normalizar un dato
-- que en este sistema no lleva historial versionado.
-- ----------------------------------------------------------------------------
create table if not exists sensors (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,

  name text not null,
  color text not null default '#2563eb',
  sort_order integer not null default 0,

  -- Corrección de data cruda (°C, puede ser negativo)
  offset_celsius numeric not null default 0,

  -- Certificado de calibración (opcional)
  calibration_cert_number text,
  calibration_date date,
  calibration_notes text,
  certificate_file_url text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (project_id, name)
);

create index if not exists idx_sensors_project_id on sensors(project_id);

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

drop trigger if exists trg_sensors_updated_at on sensors;
create trigger trg_sensors_updated_at
  before update on sensors
  for each row execute function set_updated_at();

-- ----------------------------------------------------------------------------
-- RLS: acceso abierto de lectura/escritura vía anon key (sin autenticación,
-- por requisito explícito del proyecto). Si en el futuro se agrega login,
-- estas son las políticas a reemplazar.
-- ----------------------------------------------------------------------------
alter table projects enable row level security;
alter table sensors enable row level security;

drop policy if exists "allow all projects" on projects;
create policy "allow all projects" on projects for all using (true) with check (true);

drop policy if exists "allow all sensors" on sensors;
create policy "allow all sensors" on sensors for all using (true) with check (true);

-- ----------------------------------------------------------------------------
-- Storage: bucket público para PDFs de certificados de calibración.
-- Ejecutar aparte si el bucket no existe (el editor SQL de Supabase permite
-- estas operaciones sobre storage.buckets/objects).
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('calibration-certs', 'calibration-certs', true)
on conflict (id) do nothing;

drop policy if exists "allow all calibration-certs" on storage.objects;
create policy "allow all calibration-certs" on storage.objects
  for all
  using (bucket_id = 'calibration-certs')
  with check (bucket_id = 'calibration-certs');
