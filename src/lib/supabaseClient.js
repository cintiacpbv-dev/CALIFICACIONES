import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Sin credenciales la app sigue funcionando (el caller debe manejar
// supabase === null y avisar que no hay guardado en la nube), en vez de
// romper el build o el arranque en local.
export const supabase = url && anonKey ? createClient(url, anonKey) : null;
