-- ============================================================================
-- Migración v1 -> v2 (opcional): proyecto plano -> proyecto con corridas
-- ============================================================================
-- Ejecutar SÓLO si ya tenías datos del esquema anterior (projects.raw_data +
-- tabla sensors) y los querés conservar. Es segura de correr dos veces: sólo
-- toca proyectos que todavía no tienen corridas.
--
-- Qué hace, por cada proyecto viejo:
--   1. Crea una corrida "Corrida 1" con su data cruda y sus parámetros.
--   2. Convierte cada sensor en un probe, traduciendo el offset constante a
--      dos puntos de calibración equivalentes: la recta que sale de
--      {equi:0, tcv:offset} y {equi:100, tcv:100+offset} tiene pendiente 1 e
--      intercepto = offset, o sea corregida = cruda + offset, que es
--      exactamente lo que hacía el esquema v1.
--   3. Reindexa raw_data.series de los ids viejos de sensores a los ids
--      nuevos de probes.
-- ============================================================================

do $$
declare
  p record;
  s record;
  new_run_id uuid;
  new_probe_id uuid;
  sensor_map jsonb;
  new_series jsonb;
  migrated integer := 0;
begin
  if to_regclass('public.sensors') is null then
    raise notice 'No existe la tabla sensors: no hay nada del esquema v1 que migrar.';
    return;
  end if;

  for p in
    select * from projects pr
    where not exists (select 1 from runs r where r.project_id = pr.id)
  loop
    sensor_map := '{}'::jsonb;

    insert into runs (project_id, name, ref_temp_f0, z_value_f0,
                      ref_temp_fh, z_value_fh, time_unit, raw_data)
    values (p.id, 'Corrida 1', p.ref_temp_f0, p.z_value_f0,
            p.ref_temp_fh, p.z_value_fh, p.time_unit,
            coalesce(p.raw_data, '{"time": [], "series": {}}'::jsonb))
    returning id into new_run_id;

    for s in select * from sensors where project_id = p.id order by sort_order loop
      insert into probes (project_id, code, color, sort_order,
                          calibration_points, calibration_cert_number,
                          calibration_date, certificate_file_url)
      values (p.id, s.name, s.color, s.sort_order,
              jsonb_build_array(
                jsonb_build_object('equi', 0,   'tcv', s.offset_celsius),
                jsonb_build_object('equi', 100, 'tcv', 100 + s.offset_celsius)
              ),
              s.calibration_cert_number, s.calibration_date, s.certificate_file_url)
      on conflict (project_id, code) do nothing
      returning id into new_probe_id;

      if new_probe_id is not null then
        sensor_map := sensor_map || jsonb_build_object(s.id::text, new_probe_id::text);
      end if;
    end loop;

    select coalesce(jsonb_object_agg(sensor_map->>e.k, e.v), '{}'::jsonb)
      into new_series
      from jsonb_each(coalesce(p.raw_data->'series', '{}'::jsonb)) as e(k, v)
     where sensor_map ? e.k;

    update runs
       set raw_data = jsonb_build_object(
             'time',   coalesce(p.raw_data->'time', '[]'::jsonb),
             'series', new_series)
     where id = new_run_id;

    migrated := migrated + 1;
  end loop;

  raise notice 'Proyectos migrados: %', migrated;
end $$;

-- ----------------------------------------------------------------------------
-- Limpieza (opcional): recién cuando verificaste que las corridas quedaron
-- bien, podés borrar lo viejo. Hasta entonces no molesta que siga ahí.
-- ----------------------------------------------------------------------------
-- alter table projects drop column if exists raw_data;
-- alter table projects drop column if exists results_summary;
-- alter table projects drop column if exists ref_temp_f0;
-- alter table projects drop column if exists z_value_f0;
-- alter table projects drop column if exists ref_temp_fh;
-- alter table projects drop column if exists z_value_fh;
-- alter table projects drop column if exists time_unit;
-- drop table if exists sensors;
