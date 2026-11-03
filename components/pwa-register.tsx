"use client";

import { useEffect } from "react";
import { toast } from "sonner";

export function PwaRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production") return;

    let reloading = false;
    let updateRequested = false;
    let cancelled = false;

    const onControllerChange = () => {
      if (reloading || !updateRequested) return;
      reloading = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    function offerUpdate(worker: ServiceWorker) {
      toast("A new version is available", {
        description: "Reload to get the latest attendance features.",
        duration: Infinity,
        action: {
          label: "Reload",
          onClick: () => {
            updateRequested = true;
            worker.postMessage({ type: "SKIP_WAITING" });
          },
        },
      });
    }

    async function register() {
      try {
        const registration = await navigator.serviceWorker.register("/sw.js", {
          scope: "/",
        });
        if (cancelled) return;

        if (registration.waiting && navigator.serviceWorker.controller) {
          offerUpdate(registration.waiting);
        }

        registration.addEventListener("updatefound", () => {
          const worker = registration.installing;
          if (!worker) return;
          worker.addEventListener("statechange", () => {
            if (worker.state === "installed" && navigator.serviceWorker.controller) {
              offerUpdate(worker);
            }
          });
        });
      } catch {
        // Registration failures should never interrupt attendance.
      }
    }

    window.addEventListener("load", register);
    return () => {
      cancelled = true;
      window.removeEventListener("load", register);
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
    };
  }, []);

  return null;
}
