import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

/** Test build: everything stays in the viewer's browser. */
export const isDemo = import.meta.env.VITE_DEMO === '1';

/** True when the shared online storage is set up (.env has the keys). */
export const hasRemote = !isDemo && Boolean(url && key);
export const supabase = hasRemote ? createClient(url, key) : null;
