import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import type { ReactElement } from "react";
import { MemoryRouter, Route, Routes } from "react-router";
import { AuthContext, type AuthState } from "../auth/AuthProvider";
import type { Member } from "../lib/types";

export const TEST_MEMBER: Member = { id: "m1", email: "rachel@test.local", display_name: "רחל", role: "member" };
export const TEST_ADMIN: Member = { ...TEST_MEMBER, id: "a1", display_name: "שי", role: "admin" };

export function renderWithProviders(
  ui: ReactElement,
  opts: {
    member?: Member | null;
    signedIn?: boolean;
    route?: string;
    /** full history stack (the last entry is current); overrides `route` */
    entries?: string[];
    path?: string;
    error?: string | null;
    loading?: boolean;
    retry?: () => void;
  } = {},
) {
  const member = opts.member === undefined ? TEST_MEMBER : opts.member;
  const signedIn = opts.signedIn ?? member !== null;
  const auth: AuthState = {
    loading: opts.loading ?? false,
    error: opts.error ?? null,
    retry: opts.retry ?? (() => {}),
    session: signedIn ? ({ user: { id: member?.id ?? "u", email: member?.email ?? "x@y.z" } } as AuthState["session"]) : null,
    member,
    signOut: async () => {},
  };
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <AuthContext.Provider value={auth}>
        <MemoryRouter initialEntries={opts.entries ?? [opts.route ?? "/"]}>
          <Routes>
            <Route path={opts.path ?? "*"} element={ui} />
            <Route path="/login" element={<div>LOGIN PAGE</div>} />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>,
  );
}
