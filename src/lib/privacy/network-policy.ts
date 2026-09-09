export function assertAllowedOutboundUrl(input: string): void {
  if (input.startsWith("/")) return;

  const url = new URL(input);
  const isLocalOllama =
    url.protocol === "http:" &&
    ["127.0.0.1", "localhost"].includes(url.hostname) &&
    url.port === "11434";
  const isSupabase = url.protocol === "https:" && url.hostname.endsWith(".supabase.co");

  if (!isLocalOllama && !isSupabase) {
    throw new Error("Outbound destination is not allowed");
  }
}
