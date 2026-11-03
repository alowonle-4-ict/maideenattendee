"use client";

import * as React from "react";
import { RefreshCw, WifiOff } from "lucide-react";

import { Button } from "@/components/ui/button";

export function OfflineRetry() {
  const [online, setOnline] = React.useState(true);
  const [message, setMessage] = React.useState<string | null>(null);

  React.useEffect(() => {
    const sync = () => {
      setOnline(navigator.onLine);
      if (navigator.onLine) {
        setMessage(null);
        window.location.reload();
      }
    };
    setOnline(navigator.onLine);
    window.addEventListener("online", sync);
    return () => window.removeEventListener("online", sync);
  }, []);

  return (
    <div className="flex flex-col items-center gap-3">
      <Button
        onClick={() => {
          if (navigator.onLine) {
            window.location.reload();
          } else {
            setMessage("Still offline — check your connection and try again.");
          }
        }}
      >
        <RefreshCw />
        Try again
      </Button>
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground" aria-live="polite">
        <WifiOff className="h-3.5 w-3.5" />
        {message ?? (online ? "You are back online." : "No internet connection detected.")}
      </p>
    </div>
  );
}
