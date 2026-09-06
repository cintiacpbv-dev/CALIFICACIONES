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

-- ----------------------------------------------------------------------------
-- probes: termocuplas físicas del equipo. La calibración vive acá porque es
-- del sensor, no de la corrida: el mismo certificado (2 o 3 puntos TCV↔EQUI
-- del baño de calibración) se reutiliza en todas las corridas del estudio,
-- tal como está armado en las planillas reales que se tomaron de referencia.
--
-- calibration_points: [{ "tcv": number, "equi": number }, ...] — 2 o 3
-- puntos. Se ajusta una recta por cuadrados mínimos (igual que
-- FORECAST.LINEAR de Excel) y esa recta corrige cada lectura cruda:
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
-- Migración desde el esquema v1 (proyecto plano, sin corridas)
-- ============================================================================
-- Si ya tenías el esquema anterior (projects.raw_data + tabla sensors),
-- ejecutá esto DESPUÉS de lo de arriba para migrar cada proyecto viejo a
-- una corrida única "Corrida 1", preservando data y offsets como un punto
-- de calibración equivalente (offset ⇔ recta con pendiente 1):
--
-- do $$
-- declare
--   p record;
--   new_run_id uuid;
--   s record;
--   new_probe_id uuid;
--   sensor_map jsonb := '{}'::jsonb;
-- begin
--   for p in select * from projects where raw_data is not null loop
--     insert into runs (project_id, name, ref_temp_f0, z_value_f0,
--       ref_temp_fh, z_value_fh, time_unit, raw_data)
--     values (p.id, 'Corrida 1', p.ref_temp_f0, p.z_value_f0,
--       p.ref_temp_fh, p.z_value_fh, p.time_unit, p.raw_data)
--     returning id into new_run_id;
--
--     for s in select * from sensors where project_id = p.id loop
--       insert into probes (project_id, code, color, sort_order,
--         calibration_points)
--       values (p.id, s.name, s.color, s.sort_order,
--         jsonb_build_array(
--           jsonb_build_object('tcv', 0, 'equi', s.offset_celsius),
--           jsonb_build_object('tcv', 100, 'equi', 100 + s.offset_celsius)
--         ))
--       returning id into new_probe_id;
--       sensor_map := sensor_map || jsonb_build_object(s.id::text, new_probe_id::text);
--     end loop;
--
--     update runs set
--       raw_data = jsonb_build_object(
--         'time', raw_data->'time',
--         'series', (
--           select jsonb_object_agg(sensor_map->>key, raw_data->'series'->key)
--           from jsonb_object_keys(raw_data->'series') as key
--         )
--       )
--     where id = new_run_id;
--   end loop;
-- end $$;
--
-- alter table projects drop column if exists raw_data;
-- alter table projects drop column if exists results_summary;
-- alter table projects drop column if exists ref_temp_f0;
-- alter table projects drop column if exists z_value_f0;
-- alter table projects drop column if exists ref_temp_fh;
-- alter table projects drop column if exists z_value_fh;
-- alter table projects drop column if exists time_unit;
-- drop table if exists sensors;
