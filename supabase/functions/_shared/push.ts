import { webpush } from "./npm.ts";

export interface PushSubscriptionRow { id: string; endpoint: string; p256dh: string; auth: string }
export interface PushPayload { title: string; body: string; url: string }
export type SendFn = (sub: PushSubscriptionRow, body: string) => Promise<void>;

export async function sendPushToAll(
  subs: PushSubscriptionRow[],
  payload: PushPayload,
  send: SendFn,
): Promise<string[]> {
  const body = JSON.stringify(payload);
  const dead: string[] = [];
  await Promise.all(subs.map(async (s) => {
    try {
      await send(s, body);
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) dead.push(s.id);
      else console.error("push failed", s.id, code ?? e);
    }
  }));
  return dead;
}

export function webPushSender(vapid: { publicKey: string; privateKey: string; subject: string }): SendFn {
  webpush.setVapidDetails(vapid.subject, vapid.publicKey, vapid.privateKey);
  return async (s, body) => {
    await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, body, { TTL: 86400 });
  };
}
