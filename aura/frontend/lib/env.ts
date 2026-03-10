type ClientEnv = {
  apiUrl: string;
  auraEnv: string;
  auraToken: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
};

const auraEnv = process.env.NEXT_PUBLIC_AURA_ENV?.trim() || "local";
const apiUrl = process.env.NEXT_PUBLIC_API_URL?.trim() || "";
const auraToken =
  process.env.NEXT_PUBLIC_AURA_TOKEN?.trim() || (auraEnv === "local" ? "change-me" : "");
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() || "";

export const clientEnv: ClientEnv = {
  apiUrl,
  auraEnv,
  auraToken,
  supabaseUrl,
  supabaseAnonKey,
};

export function getClientEnvWarnings(): string[] {
  const warnings: string[] = [];

  if (!clientEnv.apiUrl) {
    warnings.push("NEXT_PUBLIC_API_URL não está configurada.");
  }

  if (clientEnv.auraEnv !== "local" && !clientEnv.auraToken && !clientEnv.supabaseAnonKey) {
    warnings.push("Defina autenticação de cliente para ambiente cloud.");
  }

  if (clientEnv.supabaseUrl && !clientEnv.supabaseAnonKey) {
    warnings.push("NEXT_PUBLIC_SUPABASE_URL foi definida sem NEXT_PUBLIC_SUPABASE_ANON_KEY.");
  }

  return warnings;
}

export function isSupabaseClientConfigured() {
  return Boolean(clientEnv.supabaseUrl && clientEnv.supabaseAnonKey);
}

