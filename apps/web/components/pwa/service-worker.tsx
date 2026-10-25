"use client";

import { useEffect } from "react";

/** Registers the service worker in production builds only; the version in the URL drives cache invalidation. */
export function ServiceWorkerRegistration({ version }: { version: string }) {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register(`/sw.js?v=${encodeURIComponent(version)}`, { scope: "/" }).catch(() => {
      // Registration failure only disables offline support; the app keeps working online.
    });
  }, [version]);
  return null;
}
