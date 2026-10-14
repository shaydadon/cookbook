import type { SupabaseClient } from "./npm.ts";

export interface Member { id: string; role: "admin" | "member"; display_name: string }

export async function getMember(req: Request, db: SupabaseClient): Promise<Member | null> {
  const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const { data: userData, error } = await db.auth.getUser(token);
  if (error || !userData.user) return null;
  const { data } = await db.from("members").select("id, role, display_name").eq("id", userData.user.id).maybeSingle();
  return (data as Member | null) ?? null;
}
