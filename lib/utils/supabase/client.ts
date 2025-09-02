import { createBrowserClient } from "@supabase/ssr";
import { SUPABASE_URL_CLIENT, SUPABASE_PUBLIC_ANON_KEY_CLIENT } from "@/lib/constants";

export const createClient = () => {
  if (!SUPABASE_URL_CLIENT || !SUPABASE_PUBLIC_ANON_KEY_CLIENT) {
    throw new Error("Supabase URL or anon key is not set");
  }
  return createBrowserClient(SUPABASE_URL_CLIENT, SUPABASE_PUBLIC_ANON_KEY_CLIENT);
};
