import { supabase } from "./supabase";

export function urlBase64ToUint8Array(s: string): Uint8Array<ArrayBuffer> {
  const padded = (s + "=".repeat((4 - (s.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
}

export function pushSupported(): boolean {
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

export async function subscribePush(vapidKey: string): Promise<void> {
  const reg = await navigator.serviceWorker.ready;
  const sub = (await reg.pushManager.getSubscription()) ??
    await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(vapidKey) });
  const json = sub.toJSON();
  const { error } = await supabase.functions.invoke("push-subscribe", { body: { endpoint: json.endpoint, keys: json.keys } });
  if (error) throw error;
}

export const isIos = (ua: string, maxTouchPoints = 0) =>
  /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && maxTouchPoints > 1);

export function isStandalone(): boolean {
  return window.matchMedia?.("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export const shouldShowIosInstallHint = (ua: string, standalone: boolean, maxTouchPoints = 0) =>
  isIos(ua, maxTouchPoints) && !standalone;
