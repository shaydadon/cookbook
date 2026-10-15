/// <reference types="vite-plugin-pwa/client" />
// Must stay first: captures OAuth redirect errors before the Supabase client and the router read the URL.
import "./capture-auth-error";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import App from "./App";
import { AuthProvider } from "./auth/AuthProvider";
import { ErrorBoundary } from "./components/ErrorBoundary";
import "./index.css";
import { registerSW } from "virtual:pwa-register";

registerSW({ immediate: true });

// After a deploy the new SW takes over: reload once so open pages don't run old JS against new chunks.
// Skipped on first install (no controller at load).
if ("serviceWorker" in navigator) {
  const hadController = !!navigator.serviceWorker.controller;
  let reloaded = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!hadController || reloaded) return;
    reloaded = true;
    window.location.reload();
  });
}

// offlineFirst: queries still run while the browser reports offline, so the SW cache can answer them.
const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 60_000, retry: 1, networkMode: "offlineFirst" } } });

// AuthProvider must stay inside QueryClientProvider: it clears the query cache on sign-out / user change.
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  </StrictMode>,
);
