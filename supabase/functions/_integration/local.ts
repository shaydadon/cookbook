export async function localEnv(): Promise<{ url: string; serviceKey: string; anonKey: string }> {
  const args = ["supabase", "status", "-o", "json"];
  const cmd = Deno.build.os === "windows"
    ? new Deno.Command("cmd", { args: ["/c", "npx", ...args], stdout: "piped", stderr: "piped" })
    : new Deno.Command("npx", { args, stdout: "piped", stderr: "piped" });
  const out = await cmd.output();
  if (!out.success) throw new Error("Local Supabase is not running. Run `npm run db:start` first.");
  const s = JSON.parse(new TextDecoder().decode(out.stdout));
  return {
    url: s.API_URL,
    serviceKey: s.SERVICE_ROLE_KEY ?? s.SECRET_KEY,
    anonKey: s.ANON_KEY ?? s.PUBLISHABLE_KEY,
  };
}
