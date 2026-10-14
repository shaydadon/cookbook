import { serviceClient } from "../_shared/db.ts";
import { buildDeps } from "../_shared/deps.ts";
import { background, json } from "../_shared/http.ts";
import { runWorker } from "../_shared/worker.ts";

Deno.serve((req) => {
  const secret = Deno.env.get("WORKER_SECRET");
  if (!secret || req.headers.get("Authorization") !== `Bearer ${secret}`) {
    return json({ error: "unauthorized" }, 401);
  }
  const db = serviceClient();
  background(runWorker(db, buildDeps(db)));
  return json({ started: true }, 202);
});
