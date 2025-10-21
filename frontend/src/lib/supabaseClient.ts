import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!url || !anonKey) {
  console.warn("Supabase env variables are missing. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local");
}

export const supabase = createClient(url || "", anonKey || "");

export async function safeInvokeEdgeFunction<T = any>(name: string, payload?: any): Promise<{ data?: T; error?: any }>{
  try {
    const { data, error } = await supabase.functions.invoke(name, {
      body: payload ?? {},
    });
    if (error) return { error };
    return { data: data as T };
  } catch (e) {
    return { error: e };
  }
}