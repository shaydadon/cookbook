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
          className="card min-h-11 w-full rounded-xl px-3 outline-none" placeholder="name@example.com" />
        <input aria-label="שם בוואטסאפ" value={name} onChange={(e) => setName(e.target.value)}
          className="card min-h-11 w-full rounded-xl px-3 outline-none" placeholder="שם בוואטסאפ" />
        <button className="pressable min-h-11 rounded-xl bg-accent px-4 font-semibold text-on-accent disabled:opacity-60">הוספה לרשימה</button>
        {add.isError && <p role="alert" className="text-[13px] text-danger">לא נוסף (אולי כבר ברשימה?)</p>}
      </form>
      {list.isError && (
        <div role="alert" className="flex items-center justify-between gap-2 text-[13px] text-danger">
          <p>לא הצלחנו לטעון את הרשימה</p>
          <button type="button" onClick={() => list.refetch()} className="pressable min-h-11 rounded-xl bg-fill px-4 font-medium">נסו שוב</button>
        </div>
      )}
      {remove.isError && <p role="alert" className="text-[13px] text-danger">ההסרה נכשלה. נסו שוב.</p>}
      <ul className="card flex flex-col divide-y divide-line overflow-hidden rounded-xl">
        {list.data?.map((a) => (
          <li key={a.email} className="flex items-center justify-between gap-2 px-4 py-3">
            <span><span dir="ltr">{a.email}</span>{a.whatsapp_name && ` · ${a.whatsapp_name}`}{a.role === "admin" && " · מנהל/ת"}</span>
            {a.role !== "admin" && (
              <button className="pressable min-h-11 rounded-xl bg-fill px-4 text-[13px] font-medium text-danger"
                onClick={() => window.confirm(`להסיר את ${a.email}?`) && remove.mutate(a.email)}>הסרה</button>
            )}
          </li>
        ))}
      </ul>
      <p className="px-1 text-[12px] text-muted">הסרה מהרשימה חוסמת הרשמה חדשה. חשבון קיים יש להסיר גם ב-Supabase → Authentication.</p>
    </div>
  );
}
