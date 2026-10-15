import type { Session } from "@supabase/supabase-js";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor } from "@testing-library/react";
import type { ReactElement } from "react";
import { beforeEach, expect, test, vi } from "vitest";
import { AuthProvider, useAuth } from "./AuthProvider";

type AuthCb = (event: string, session: Session | null) => void;

const h = vi.hoisted(() => ({
  getSession: vi.fn(),
  maybeSingle: vi.fn(),
  cb: null as null | ((event: string, session: unknown) => void),
}));

vi.mock("../lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: () => h.getSession(),
      onAuthStateChange: (cb: AuthCb) => {
        h.cb = cb as never;
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      },
      signOut: vi.fn(),
    },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: () => h.maybeSingle() }) }) }),
  },
}));

const sess = (id: string) => ({ user: { id, email: `${id}@t.local` } }) as unknown as Session;
const row = (name: string) => ({ data: { id: "x", display_name: name, role: "member" }, error: null });

function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

function Probe() {
  const a = useAuth();
  return (
    <div>
      <span data-testid="loading">{String(a.loading)}</span>
      <span data-testid="error">{a.error ?? ""}</span>
      <span data-testid="member">{a.member?.display_name ?? ""}</span>
    </div>
  );
}

// AuthProvider needs the QueryClient (it clears the query cache on sign-out / user change).
let qc: QueryClient;
const withQc = (ui: ReactElement) => <QueryClientProvider client={qc}>{ui}</QueryClientProvider>;
const mount = () => render(withQc(<AuthProvider><Probe /></AuthProvider>));
const tick = () => act(() => new Promise((r) => setTimeout(r, 5)));

beforeEach(() => {
  h.getSession.mockReset();
  h.maybeSingle.mockReset();
  h.cb = null;
  qc = new QueryClient();
});

test("signOut clears the React Query cache", async () => {
  h.getSession.mockResolvedValue({ data: { session: null } });
  qc.setQueryData(["recipes", "", null, false], { pages: [[{ id: "secret" }]] });
  let out!: () => Promise<void>;
  function Grab() {
    out = useAuth().signOut;
    return null;
  }
  render(withQc(<AuthProvider><Grab /></AuthProvider>));
  await act(async () => { await out(); });
  expect(qc.getQueryCache().getAll()).toHaveLength(0);
});

test("switching to a different user clears the React Query cache, the first load does not", async () => {
  h.getSession.mockResolvedValue({ data: { session: null } });
  h.maybeSingle.mockResolvedValue(row("איי"));
  mount();
  await waitFor(() => expect(h.cb).not.toBeNull());
  await waitFor(() => expect(screen.getByTestId("loading")).toHaveTextContent("false"));

  qc.setQueryData(["favorites"], ["before-first-login"]);
  act(() => h.cb!("SIGNED_IN", sess("A")));
  await waitFor(() => expect(screen.getByTestId("member")).toHaveTextContent("איי"));
  expect(qc.getQueryData(["favorites"])).toEqual(["before-first-login"]);

  qc.setQueryData(["recipe", "r1"], { id: "r1", title: "של A" });
  h.maybeSingle.mockResolvedValue(row("בי"));
  act(() => h.cb!("SIGNED_IN", sess("B")));
  expect(qc.getQueryData(["recipe", "r1"])).toBeUndefined();
  await waitFor(() => expect(screen.getByTestId("member")).toHaveTextContent("בי"));
});

test("signOut clears the recipes-api cache", async () => {
  const del = vi.fn().mockResolvedValue(true);
  vi.stubGlobal("caches", { delete: del });
  try {
    h.getSession.mockResolvedValue({ data: { session: null } });
    let out!: () => Promise<void>;
    function Grab() {
      out = useAuth().signOut;
      return null;
    }
    render(withQc(<AuthProvider><Grab /></AuthProvider>));
    await act(async () => { await out(); });
    expect(del).toHaveBeenCalledWith("recipes-api");
  } finally {
    vi.unstubAllGlobals();
  }
});

test("a members query error sets error, ends loading and keeps member null", async () => {
  h.getSession.mockResolvedValue({ data: { session: sess("u1") } });
  h.maybeSingle.mockResolvedValue({ data: null, error: { message: "boom" } });
  mount();
  await waitFor(() => expect(screen.getByTestId("loading")).toHaveTextContent("false"));
  expect(screen.getByTestId("error")).toHaveTextContent("לא הצלחנו לטעון את החשבון");
  expect(screen.getByTestId("member")).toHaveTextContent("");
});

test("a rejecting getSession still ends loading", async () => {
  h.getSession.mockRejectedValue(new Error("net"));
  mount();
  await waitFor(() => expect(screen.getByTestId("loading")).toHaveTextContent("false"));
  expect(screen.getByTestId("error")).toHaveTextContent("לא הצלחנו לטעון את החשבון");
});

test("TOKEN_REFRESHED neither sets loading nor refetches the member", async () => {
  h.getSession.mockResolvedValue({ data: { session: sess("u1") } });
  h.maybeSingle.mockResolvedValue(row("רחל"));
  mount();
  await waitFor(() => expect(screen.getByTestId("member")).toHaveTextContent("רחל"));
  expect(h.maybeSingle).toHaveBeenCalledTimes(1);

  act(() => h.cb!("TOKEN_REFRESHED", sess("u1")));
  expect(screen.getByTestId("loading")).toHaveTextContent("false");
  await tick();
  expect(screen.getByTestId("loading")).toHaveTextContent("false");
  expect(h.maybeSingle).toHaveBeenCalledTimes(1);
  expect(screen.getByTestId("member")).toHaveTextContent("רחל");
});

test("a stale slow load does not overwrite a newer one", async () => {
  h.getSession.mockResolvedValue({ data: { session: null } });
  mount();
  await waitFor(() => expect(h.cb).not.toBeNull());
  await waitFor(() => expect(screen.getByTestId("loading")).toHaveTextContent("false"));

  const a = deferred<ReturnType<typeof row>>();
  const b = deferred<ReturnType<typeof row>>();
  h.maybeSingle.mockReturnValueOnce(a.promise).mockReturnValueOnce(b.promise);

  act(() => h.cb!("SIGNED_IN", sess("A")));
  await tick();
  act(() => h.cb!("SIGNED_IN", sess("B")));
  await tick();
  expect(h.maybeSingle).toHaveBeenCalledTimes(2);

  await act(async () => b.resolve(row("בי")));
  expect(screen.getByTestId("member")).toHaveTextContent("בי");
  await act(async () => a.resolve(row("איי")));
  expect(screen.getByTestId("member")).toHaveTextContent("בי");
  expect(screen.getByTestId("loading")).toHaveTextContent("false");
});
