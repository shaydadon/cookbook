import { expect, test } from "vitest";
import { isIos, shouldShowIosInstallHint, urlBase64ToUint8Array } from "./push";

test("urlBase64ToUint8Array decodes URL-safe base64 without padding", () => {
  expect([...urlBase64ToUint8Array("AQID_-8")]).toEqual([1, 2, 3, 255, 239]);
});

const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
const ANDROID = "Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Mobile Safari/537.36";

const IPAD_MAC_UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15";

test("iPadOS (Mac UA with touch points) counts as iOS; a real Mac does not", () => {
  expect(isIos(IPAD_MAC_UA, 5)).toBe(true);
  expect(isIos(IPAD_MAC_UA, 0)).toBe(false);
  expect(shouldShowIosInstallHint(IPAD_MAC_UA, false, 5)).toBe(true);
});

test("iOS detection and install hint", () => {
  expect(isIos(IPHONE)).toBe(true);
  expect(isIos(ANDROID)).toBe(false);
  expect(shouldShowIosInstallHint(IPHONE, false)).toBe(true);
  expect(shouldShowIosInstallHint(IPHONE, true)).toBe(false);
  expect(shouldShowIosInstallHint(ANDROID, false)).toBe(false);
});
