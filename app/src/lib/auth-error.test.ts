import { beforeEach, expect, test, vi } from "vitest";
import { AUTH_ERROR_KEY, captureAuthError, MEMBERS_ONLY, SIGN_IN_FAILED, takeAuthError } from "./auth-error";

beforeEach(() => {
  sessionStorage.clear();
});

const loc = (search: string, hash = "", pathname = "/") => ({ search, hash, pathname });

test("captures an error from the query string, stashes it and cleans the URL", () => {
  const replaceState = vi.fn();
  captureAuthError(
    loc("?error=access_denied&error_code=signup_disabled&error_description=Error+running+hook+URI%3A+403&keep=1"),
    { replaceState, state: null },
    sessionStorage,
  );
  expect(sessionStorage.getItem(AUTH_ERROR_KEY)).toBe("Error running hook URI: 403");
  expect(replaceState).toHaveBeenCalledWith(null, "", "/?keep=1");
});

test("captures an error from the hash", () => {
  const replaceState = vi.fn();
  captureAuthError(loc("", "#error=server_error&error_description=Database+error+saving+new+user", "/login"),
    { replaceState, state: { idx: 0 } }, sessionStorage);
  expect(sessionStorage.getItem(AUTH_ERROR_KEY)).toBe("Database error saving new user");
  expect(replaceState).toHaveBeenCalledWith({ idx: 0 }, "", "/login");
});

test("does nothing without an error", () => {
  const replaceState = vi.fn();
  captureAuthError(loc("?q=x", "#access_token=abc"), { replaceState, state: null }, sessionStorage);
  expect(replaceState).not.toHaveBeenCalled();
  expect(sessionStorage.getItem(AUTH_ERROR_KEY)).toBeNull();
});

test("takeAuthError maps hook/access errors to the members-only message and clears the key", () => {
  sessionStorage.setItem(AUTH_ERROR_KEY, "Error running hook URI: pg-functions://postgres/public/hook (403)");
  expect(takeAuthError()).toBe(MEMBERS_ONLY);
  expect(sessionStorage.getItem(AUTH_ERROR_KEY)).toBeNull();
  expect(takeAuthError()).toBeNull();
  sessionStorage.setItem(AUTH_ERROR_KEY, "Signups not allowed for this instance");
  expect(takeAuthError()).toBe(MEMBERS_ONLY);
  sessionStorage.setItem(AUTH_ERROR_KEY, "Unable to exchange external code");
  expect(takeAuthError()).toBe(SIGN_IN_FAILED);
});
