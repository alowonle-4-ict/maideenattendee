"use client";

import * as React from "react";
import { Download, Loader2, Printer, ShieldCheck } from "lucide-react";
import QRCode from "qrcode";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function QrCard({
  token,
  name,
  matric,
  institutionName,
  className,
  compact = false,
}: {
  token: string;
  name: string;
  matric?: string | null;
  institutionName?: string | null;
  className?: string;
  compact?: boolean;
}) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    async function render() {
      if (!canvasRef.current || !token) return;
      await QRCode.toCanvas(canvasRef.current, token, {
        width: compact ? 180 : 260,
        margin: 2,
        errorCorrectionLevel: "M",
        color: { dark: "#1e2a5a", light: "#ffffff" },
      });
      if (!cancelled) setReady(true);
    }
    render().catch(() => setReady(false));
    return () => {
      cancelled = true;
    };
  }, [token, compact]);

  function download() {
    if (!canvasRef.current) return;
    const link = document.createElement("a");
    link.download = `maideenattendee-${(matric ?? name).replace(/[^a-z0-9-]+/gi, "-")}.png`;
    link.href = canvasRef.current.toDataURL("image/png");
    link.click();
  }

  function print() {
    if (!canvasRef.current) return;
    const image = canvasRef.current.toDataURL("image/png");
    const win = window.open("", "_blank", "width=560,height=720");
    if (!win) return;
    win.document.write(`<!doctype html><html><head><title>Student QR</title>
      <style>
        body{font-family:ui-sans-serif,system-ui,sans-serif;display:flex;align-items:center;justify-content:center;padding:40px;color:#111827}
        .card{border:1px solid #e5e7eb;border-radius:16px;padding:32px;text-align:center;width:360px}
        img{width:260px;height:260px;margin:16px auto;display:block}
        .institution{font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#6b7280}
        .name{font-size:20px;font-weight:700;margin-top:6px}
        .matric{font-size:13px;color:#6b7280;margin-top:2px}
        .hint{font-size:10px;color:#9ca3af;margin-top:18px}
      </style></head><body onload="window.print()">
        <div class="card">
          <div class="institution">${(institutionName ?? "MaideenAttendee").replace(/[<>&]/g, "")}</div>
          <img src="${image}" alt="Student QR code" />
          <div class="name">${name.replace(/[<>&]/g, "")}</div>
          <div class="matric">${(matric ?? "").replace(/[<>&]/g, "")}</div>
          <div class="hint">Present this code to your lecturer. It is permanent and unique to you.</div>
        </div>
      </body></html>`);
    win.document.close();
  }

  return (
    <div className={cn("rounded-2xl border bg-card p-6 shadow-card", className)}>
      <div className="text-center">
        {institutionName && (
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            {institutionName}
          </p>
        )}
        <div className="relative mx-auto mt-4 grid w-fit place-items-center rounded-xl border bg-white p-3">
          <canvas ref={canvasRef} className={cn(compact ? "h-[180px] w-[180px]" : "h-[260px] w-[260px]")} />
          {!ready && (
            <span className="absolute inset-0 grid place-items-center bg-white/80">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </span>
          )}
        </div>
        <p className="mt-4 font-display text-base font-semibold">{name}</p>
        {matric && <p className="text-xs text-muted-foreground">{matric}</p>}
        <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-success/10 px-2.5 py-1 text-[10px] font-semibold text-success">
          <ShieldCheck className="h-3 w-3" /> Permanent student credential
        </p>
      </div>
      <div className="mt-5 flex gap-2">
        <Button variant="outline" size="sm" className="flex-1" onClick={download} disabled={!ready}>
          <Download /> PNG
        </Button>
        <Button variant="outline" size="sm" className="flex-1" onClick={print} disabled={!ready}>
          <Printer /> Print
        </Button>
      </div>
      {!compact && (
        <p className="mt-4 break-all rounded-md bg-muted/60 px-2 py-1.5 text-center font-mono text-[10px] text-muted-foreground">
          {token}
        </p>
      )}
    </div>
  );
}
