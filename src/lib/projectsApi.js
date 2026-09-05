import { supabase } from './supabaseClient';

const EMPTY_RAW_DATA = { time: [], series: {} };

/** Lista los proyectos guardados, para el panel central. */
export async function listProjects() {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('projects')
    .select('id, name, description, updated_at, created_at, results_summary')
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return data;
}

/** Crea un proyecto nuevo y devuelve su fila completa. */
export async function createProject(name = 'Proyecto sin título') {
  if (!supabase) throw new Error('Supabase no está configurado.');
  const { data, error } = await supabase
    .from('projects')
    .insert({ name, raw_data: EMPTY_RAW_DATA })
    .select()
    .single();
  if (error) throw error;
  return data;
}

/** Trae un proyecto y sus sensores. */
export async function getProject(id) {
  if (!supabase) throw new Error('Supabase no está configurado.');
  const [{ data: project, error: projectError }, { data: sensors, error: sensorsError }] =
    await Promise.all([
      supabase.from('projects').select('*').eq('id', id).single(),
      supabase.from('sensors').select('*').eq('project_id', id).order('sort_order'),
    ]);
  if (projectError) throw projectError;
  if (sensorsError) throw sensorsError;
  return { project, sensors: sensors ?? [] };
}

/**
 * Autoguardado: actualiza campos parciales del proyecto (raw_data,
 * results_summary, parámetros de referencia, nombre, etc). Se llama desde
 * el hook de debounce, nunca directamente en cada tecla.
 */
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

/** Crea un sensor (columna nueva de la hoja). */
export async function createSensor(projectId, { name, color, sortOrder }) {
  if (!supabase) throw new Error('Supabase no está configurado.');
  const { data, error } = await supabase
    .from('sensors')
    .insert({ project_id: projectId, name, color, sort_order: sortOrder })
    .select()
    .single();
  if (error) throw error;
  return data;
}

/** Autoguardado de un sensor: offset, datos de calibración, nombre, color. */
export async function saveSensorFields(id, fields) {
  if (!supabase) return;
  const { error } = await supabase.from('sensors').update(fields).eq('id', id);
  if (error) throw error;
}

export async function deleteSensor(id) {
  if (!supabase) throw new Error('Supabase no está configurado.');
  const { error } = await supabase.from('sensors').delete().eq('id', id);
  if (error) throw error;
}

/** Sube un PDF de certificado de calibración y devuelve su URL pública. */
export async function uploadCalibrationCert(sensorId, file) {
  if (!supabase) throw new Error('Supabase no está configurado.');
  const path = `${sensorId}/${Date.now()}-${file.name}`;
  const { error: uploadError } = await supabase.storage
    .from('calibration-certs')
    .upload(path, file, { upsert: true });
  if (uploadError) throw uploadError;

  const { data } = supabase.storage.from('calibration-certs').getPublicUrl(path);
  return data.publicUrl;
}
