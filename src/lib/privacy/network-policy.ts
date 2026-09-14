export function assertAllowedOutboundUrl(input: string, configuredSupabaseUrl = process.env.EXPENSES_NEXT_PUBLIC_SUPABASE_URL): void {
  if (input.startsWith("/")) return;

  const url = new URL(input);
  const isLocalOllama =
    url.protocol === "http:" &&
    ["127.0.0.1", "localhost"].includes(url.hostname) &&
    url.port === "11434";
  const isSupabase = Boolean(configuredSupabaseUrl) && url.protocol === "https:" && url.origin === new URL(configuredSupabaseUrl!).origin;

  if (!isLocalOllama && !isSupabase) {
    throw new Error("Outbound destination is not allowed");
  }
}
