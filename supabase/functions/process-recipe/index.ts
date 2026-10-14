import { serviceClient } from "../_shared/db.ts";
import { buildDeps } from "../_shared/deps.ts";
import { json } from "../_shared/http.ts";
import { runWorker } from "../_shared/worker.ts";

Deno.serve(async (req) => {
  if (req.headers.get("Authorization") !== `Bearer ${Deno.env.get("WORKER_SECRET")}`) {
    return json({ error: "unauthorized" }, 401);
  }
  const db = serviceClient();
  const steps = await runWorker(db, buildDeps(db));
  return json({ steps });
});
