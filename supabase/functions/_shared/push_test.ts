import { assertEquals } from "jsr:@std/assert@1";
import { type PushSubscriptionRow, sendPushToAll } from "./push.ts";

const sub = (id: string): PushSubscriptionRow => ({ id, endpoint: `https://push.test/${id}`, p256dh: "p", auth: "a" });

Deno.test("returns ids of gone subscriptions and tolerates other failures", async () => {
  const sent: string[] = [];
  const dead = await sendPushToAll(
    [sub("ok"), sub("gone"), sub("missing"), sub("flaky")],
    { title: "מתכון חדש", body: "שקשוקה", url: "/recipe/1" },
    async (s, body) => {
      if (s.id === "gone") throw { statusCode: 410 };
      if (s.id === "missing") throw { statusCode: 404 };
      if (s.id === "flaky") throw { statusCode: 500 };
      sent.push(`${s.id}:${JSON.parse(body).title}`);
    },
  );
  assertEquals(sent, ["ok:מתכון חדש"]);
  assertEquals(dead.sort(), ["gone", "missing"]);
});
