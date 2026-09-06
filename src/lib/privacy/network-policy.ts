const APPROVED_HOSTS = ["api.telegram.org"];

export function assertAllowedOutboundUrl(input: string): void {
  if (input.startsWith("/")) return;

  const url = new URL(input);
  const isLocalOllama =
    url.protocol === "http:" &&
    ["127.0.0.1", "localhost"].includes(url.hostname) &&
    url.port === "11434";
  const isSupabase = url.protocol === "https:" && url.hostname.endsWith(".supabase.co");
  const isApproved = url.protocol === "https:" && APPROVED_HOSTS.includes(url.hostname);

  if (!isLocalOllama && !isSupabase && !isApproved) {
    throw new Error("Outbound destination is not allowed");
  }
}
