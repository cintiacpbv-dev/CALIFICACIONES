import { supabase } from './supabaseClient';

const EMPTY_RAW_DATA = { time: [], series: {} };

// ---------------------------------------------------------------------------
// Projects (equipos en calificación)
// ---------------------------------------------------------------------------

/** Lista los proyectos guardados, para el panel central. */
export async function listProjects() {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('projects')
    .select('id, name, description, equipment_code, updated_at, created_at')
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return data;
}

/** Crea un proyecto (equipo) nuevo. */
export async function createProject(name = 'Proyecto sin título') {
  if (!supabase) throw new Error('Supabase no está configurado.');
  const { data, error } = await supabase.from('projects').insert({ name }).select().single();
  if (error) throw error;
  return data;
}

export async function saveProjectFields(id, fields) {
  if (!supabase) return;
  const { error } = await supabase.from('projects').update(fields).eq('id', id);
  if (error) throw error;
}

export async function deleteProject(id) {
  if (!supabase) throw new Error('Supabase no está configurado.');
  const { error } = await supabase.from('projects').delete().eq('id', id);
  if (error) throw error;
}

/** Trae un proyecto con sus probes y el resumen de sus corridas (para el overview). */
export async function getProjectOverview(id) {
  if (!supabase) throw new Error('Supabase no está configurado.');
  const [{ data: project, error: pErr }, { data: probes, error: prErr }, { data: runs, error: rErr }] =
    await Promise.all([
      supabase.from('projects').select('*').eq('id', id).single(),
      supabase.from('probes').select('*').eq('project_id', id).order('sort_order'),
      supabase
        .from('runs')
        .select(
          'id, name, sort_order, ref_temp_f0, ref_temp_fh, time_unit, results_summary, ' +
            'acceptance_summary, f0_min_required, fh_min_required, temp_low_limit, temp_high_limit, ' +
            'run_date, batch_code, cycle_code, load_description, operator, updated_at'
        )
        .eq('project_id', id)
        .order('sort_order'),
    ]);
  if (pErr) throw pErr;
  if (prErr) throw prErr;
  if (rErr) throw rErr;
  return { project, probes: probes ?? [], runs: runs ?? [] };
}

// ---------------------------------------------------------------------------
// Probes (termocuplas físicas, con su calibración)
// ---------------------------------------------------------------------------

export async function createProbe(projectId, { code, color, sortOrder }) {
  if (!supabase) throw new Error('Supabase no está configurado.');
  const { data, error } = await supabase
    .from('probes')
    .insert({ project_id: projectId, code, color, sort_order: sortOrder, calibration_points: [] })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function saveProbeFields(id, fields) {
  if (!supabase) return;
  const { error } = await supabase.from('probes').update(fields).eq('id', id);
  if (error) throw error;
}

export async function deleteProbe(id) {
  if (!supabase) throw new Error('Supabase no está configurado.');
  const { error } = await supabase.from('probes').delete().eq('id', id);
  if (error) throw error;
}

/** Sube un PDF de certificado de calibración y devuelve su URL pública. */
export async function uploadCalibrationCert(probeId, file) {
  if (!supabase) throw new Error('Supabase no está configurado.');
  const path = `${probeId}/${Date.now()}-${file.name}`;
  const { error: uploadError } = await supabase.storage
    .from('calibration-certs')
    .upload(path, file, { upsert: true });
  if (uploadError) throw uploadError;

  const { data } = supabase.storage.from('calibration-certs').getPublicUrl(path);
  return data.publicUrl;
}

// ---------------------------------------------------------------------------
// Runs (corridas)
// ---------------------------------------------------------------------------

export async function createRun(projectId, { name, sortOrder }) {
  if (!supabase) throw new Error('Supabase no está configurado.');
  const { data, error } = await supabase
    .from('runs')
    .insert({ project_id: projectId, name, sort_order: sortOrder, raw_data: EMPTY_RAW_DATA })
    .select()
    .single();
  if (error) throw error;
  return data;
}

/**
 * Trae una corrida con los probes y el proyecto al que pertenece. El
 * proyecto viene acá y no en una llamada aparte porque el informe exportado
 * necesita el nombre y el código de equipo en su encabezado.
 */
export async function getRun(runId) {
  if (!supabase) throw new Error('Supabase no está configurado.');
  const { data: run, error: rErr } = await supabase.from('runs').select('*').eq('id', runId).single();
  if (rErr) throw rErr;
  const [{ data: probes, error: pErr }, { data: project, error: prErr }] = await Promise.all([
    supabase.from('probes').select('*').eq('project_id', run.project_id).order('sort_order'),
    supabase
      .from('projects')
      .select('id, name, equipment_code, description')
      .eq('id', run.project_id)
      .single(),
  ]);
  if (pErr) throw pErr;
  if (prErr) throw prErr;
  return { run, probes: probes ?? [], project };
}

export async function saveRunFields(id, fields) {
  if (!supabase) return;
  const { error } = await supabase.from('runs').update(fields).eq('id', id);
  if (error) throw error;
}

export async function deleteRun(id) {
  if (!supabase) throw new Error('Supabase no está configurado.');
  const { error } = await supabase.from('runs').delete().eq('id', id);
  if (error) throw error;
}
