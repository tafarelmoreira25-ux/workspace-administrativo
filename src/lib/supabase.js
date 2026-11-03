import { createClient } from "@supabase/supabase-js";
import { criarCacheConsultas } from "./queryCache";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    "Configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no arquivo .env.",
  );
}

const consultas = criarCacheConsultas((...args) => fetch(...args));
export const invalidarConsultas = consultas.invalidar;

export const supabase = createClient(supabaseUrl, supabaseKey, {
  global: { fetch: consultas.fetch },
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

supabase.auth.onAuthStateChange(() => invalidarConsultas());
