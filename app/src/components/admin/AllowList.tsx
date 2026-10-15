import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type FormEvent, useState } from "react";
import { supabase } from "../../lib/supabase";

interface Allowed { email: string; whatsapp_name: string | null; role: "admin" | "member" }

export function AllowList() {
  const qc = useQueryClient();
  const list = useQuery({
    queryKey: ["allowed"],
    queryFn: async () => {
      const { data, error } = await supabase.from("allowed_emails").select("*").order("email");
      if (error) throw error;
      return data as Allowed[];
    },
  });
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const add = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("allowed_emails")
        .insert({ email: email.trim().toLowerCase(), whatsapp_name: name.trim() || null });
      if (error) throw error;
    },
    onSuccess: () => { setEmail(""); setName(""); qc.invalidateQueries({ queryKey: ["allowed"] }); },
  });
  const remove = useMutation({
    mutationFn: async (e: string) => {
      const { error } = await supabase.from("allowed_emails").delete().eq("email", e);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["allowed"] }),
  });

  return (
    <div className="flex flex-col gap-3">
      <form onSubmit={(e: FormEvent) => { e.preventDefault(); add.mutate(); }} className="flex flex-col gap-2">
        <input aria-label="אימייל חבר/ה" type="email" required dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)}
          className="min-h-11 rounded-xl border border-line bg-white px-3" placeholder="name@example.com" />
        <input aria-label="שם בוואטסאפ" value={name} onChange={(e) => setName(e.target.value)}
          className="min-h-11 rounded-xl border border-line bg-white px-3" placeholder="שם בוואטסאפ" />
        <button className="min-h-11 rounded-full bg-accent text-white">הוספה לרשימה</button>
        {add.isError && <p role="alert" className="text-sm text-red-700">לא נוסף (אולי כבר ברשימה?)</p>}
      </form>
      {list.isError && (
        <div role="alert" className="flex items-center justify-between gap-2 text-sm text-red-700">
          <p>לא הצלחנו לטעון את הרשימה</p>
          <button type="button" onClick={() => list.refetch()} className="min-h-11 rounded-full border border-line px-4">נסו שוב</button>
        </div>
      )}
      {remove.isError && <p role="alert" className="text-sm text-red-700">ההסרה נכשלה. נסו שוב.</p>}
      <ul className="flex flex-col divide-y divide-line rounded-2xl bg-white">
        {list.data?.map((a) => (
          <li key={a.email} className="flex items-center justify-between gap-2 p-3">
            <span><span dir="ltr">{a.email}</span>{a.whatsapp_name && ` · ${a.whatsapp_name}`}{a.role === "admin" && " · מנהל/ת"}</span>
            {a.role !== "admin" && (
              <button className="min-h-11 rounded-full border border-line px-3 text-sm"
                onClick={() => window.confirm(`להסיר את ${a.email}?`) && remove.mutate(a.email)}>הסרה</button>
            )}
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted">הסרה מהרשימה חוסמת הרשמה חדשה. חשבון קיים יש להסיר גם ב-Supabase → Authentication.</p>
    </div>
  );
}
