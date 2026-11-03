"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { BrowserMultiFormatReader, type IScannerControls } from "@zxing/browser";
import { NotFoundException } from "@zxing/library";
import {
  Camera,
  CameraOff,
  CheckCircle2,
  CloudOff,
  CloudUpload,
  Flashlight,
  FlashlightOff,
  Loader2,
  RefreshCw,
  SwitchCamera,
  Volume2,
  VolumeX,
  Wifi,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { scanAttendance } from "@/lib/actions/attendance";
import {
  cacheSession,
  countPending,
  enqueueScan,
  listPendingScans,
  type CachedSession,
  type PendingScan,
} from "@/lib/offline/db";
import { synchronizeQueue } from "@/lib/offline/sync";
import type { ScanResult } from "@/lib/types";
import { cn, formatTime } from "@/lib/utils";

export interface ScannerSession {
  id: string;
  course_id: string;
  course_code: string;
  course_title: string;
  title: string;
  class_date: string;
  opens_at: string;
  closes_at: string;
  status: string;
}

export interface ScannerStudent {
  student_id: string;
  full_name: string;
  matric_number: string | null;
  token: string;
}

export interface ScannerRecord {
  student_id: string;
  status: string;
  scanned_at: string;
  sync_source: string;
}

type FeedbackTone = "success" | "warning" | "error" | "info";

interface Feedback {
  tone: FeedbackTone;
  title: string;
  detail?: string;
  at: number;
}

const toneStyles: Record<FeedbackTone, string> = {
  success: "border-success/40 bg-success/10 text-success",
  warning: "border-warning/40 bg-warning/10 text-warning",
  error: "border-destructive/40 bg-destructive/10 text-destructive",
  info: "border-brand-300 bg-brand-50 text-brand-800 dark:border-brand-800 dark:bg-brand-950 dark:text-brand-200",
};

function beep(ok: boolean, enabled: boolean) {
  if (!enabled || typeof window === "undefined") return;
  try {
    const AudioContextClass = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const context = new AudioContextClass();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.type = "sine";
    oscillator.frequency.value = ok ? 880 : 240;
    gain.gain.setValueAtTime(0.08, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.18);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.2);
  } catch {
    // Audio is best-effort.
  }
}

function vibrate(ok: boolean, enabled: boolean) {
  if (!enabled || typeof navigator === "undefined" || !navigator.vibrate) return;
  navigator.vibrate(ok ? 60 : [60, 40, 60]);
}

export function ScannerView({
  session,
  students,
  initialRecords,
  manualAllowed,
}: {
  session: ScannerSession;
  students: ScannerStudent[];
  initialRecords: ScannerRecord[];
  manualAllowed: boolean;
}) {
  const router = useRouter();
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const controlsRef = React.useRef<IScannerControls | null>(null);
  const lastTokenRef = React.useRef<{ token: string; at: number } | null>(null);
  const busyRef = React.useRef(false);

  const [online, setOnline] = React.useState(true);
  const [scanning, setScanning] = React.useState(false);
  const [cameraError, setCameraError] = React.useState<string | null>(null);
  const [devices, setDevices] = React.useState<MediaDeviceInfo[]>([]);
  const [deviceId, setDeviceId] = React.useState<string | null>(null);
  const [torchOn, setTorchOn] = React.useState(false);
  const [torchAvailable, setTorchAvailable] = React.useState(false);
  const [soundOn, setSoundOn] = React.useState(true);
  const [feedback, setFeedback] = React.useState<Feedback | null>(null);
  const [present, setPresent] = React.useState<Record<string, ScannerRecord>>(() =>
    Object.fromEntries(initialRecords.map((record) => [record.student_id, record]))
  );
  const [pending, setPending] = React.useState<PendingScan[]>([]);
  const [syncing, setSyncing] = React.useState(false);
  const [manual, setManual] = React.useState("");

  const studentByToken = React.useMemo(() => {
    const map = new Map<string, ScannerStudent>();
    students.forEach((student) => {
      if (student.token) map.set(student.token, student);
    });
    return map;
  }, [students]);
  const studentById = React.useMemo(() => {
    const map = new Map<string, ScannerStudent>();
    students.forEach((student) => map.set(student.student_id, student));
    return map;
  }, [students]);

  const presentCount = Object.keys(present).length;
  const registered = students.length;

  const refreshPending = React.useCallback(async () => {
    setPending(await listPendingScans(session.id));
  }, [session.id]);

  const showFeedback = React.useCallback(
    (tone: FeedbackTone, title: string, detail?: string) => {
      setFeedback({ tone, title, detail, at: Date.now() });
      beep(tone === "success" || tone === "info", soundOn);
      vibrate(tone === "success", soundOn);
      window.setTimeout(() => {
        setFeedback((current) => (current && Date.now() - current.at >= 2400 ? null : current));
      }, 2500);
    },
    [soundOn]
  );

  // Cache the roster so scanning continues if the network drops mid-session.
  React.useEffect(() => {
    const cached: CachedSession = {
      id: session.id,
      course_id: session.course_id,
      course_code: session.course_code,
      course_title: session.course_title,
      title: session.title,
      class_date: session.class_date,
      opens_at: session.opens_at,
      closes_at: session.closes_at,
      status: session.status,
      roster: students,
      cached_at: new Date().toISOString(),
    };
    void cacheSession(cached);
    void refreshPending();
  }, [refreshPending, session, students]);

  const sync = React.useCallback(
    async (quiet = false) => {
      if (syncing) return;
      const queue = await listPendingScans(session.id);
      if (queue.length === 0) {
        if (!quiet) toast.info("Nothing to synchronize.");
        return;
      }
      setSyncing(true);
      try {
        const summary = await synchronizeQueue(session.id);
        await refreshPending();
        if (summary.synced > 0) {
          toast.success(
            `${summary.synced} offline record${summary.synced === 1 ? "" : "s"} confirmed by the server.`
          );
          router.refresh();
        }
        if (summary.failed > 0) {
          toast.error(
            `${summary.failed} record${summary.failed === 1 ? "" : "s"} could not be synchronized. They remain queued with the server's reason.`
          );
        }
      } catch {
        if (!quiet) toast.error("Synchronization failed. Records stay queued and will retry.");
      } finally {
        setSyncing(false);
      }
    },
    [refreshPending, router, session.id, syncing]
  );

  const onToken = React.useCallback(
    async (rawToken: string) => {
      const token = rawToken.trim();
      if (!token || busyRef.current) return;
      const now = Date.now();
      if (lastTokenRef.current && lastTokenRef.current.token === token && now - lastTokenRef.current.at < 3000) {
        return;
      }
      lastTokenRef.current = { token, at: now };
      busyRef.current = true;

      try {
        const student = studentByToken.get(token);

        if (!online) {
          if (!student) {
            showFeedback("error", "Invalid QR code", "This code is not in the downloaded roster for this class.");
            return;
          }
          const already = present[student.student_id];
          if (already) {
            showFeedback("warning", "Already marked", `${student.full_name} was recorded at ${formatTime(already.scanned_at)}.`);
            return;
          }
          const clientTransactionId = crypto.randomUUID();
          const scannedAt = new Date().toISOString();
          await enqueueScan({
            client_transaction_id: clientTransactionId,
            attendance_session_id: session.id,
            qr_token: token,
            student_id: student.student_id,
            student_name: student.full_name,
            matric_number: student.matric_number,
            local_scanned_at: scannedAt,
            device_info: navigator.userAgent,
            status: "pending",
            created_at: scannedAt,
          });
          setPresent((current) => ({
            ...current,
            [student.student_id]: {
              student_id: student.student_id,
              status: "present",
              scanned_at: scannedAt,
              sync_source: "offline",
            },
          }));
          await refreshPending();
          showFeedback(
            "warning",
            "Recorded offline — provisional",
            `${student.full_name} · ${student.matric_number ?? ""}. Not yet confirmed by the server.`
          );
          return;
        }

        let result: ScanResult;
        try {
          result = await scanAttendance(session.id, token);
        } catch {
          setOnline(false);
          showFeedback("error", "Connection lost", "The scan was not saved online. Scan again — it will be queued offline.");
          return;
        }

        handleResult(result, token);
      } finally {
        busyRef.current = false;
      }

      function handleResult(result: ScanResult, scannedToken: string) {
        if (result.ok && result.code === "SUCCESS" && result.student) {
          setPresent((current) => ({
            ...current,
            [result.student!.id]: {
              student_id: result.student!.id,
              status: result.message.toLowerCase().includes("late") ? "late" : "present",
              scanned_at: result.scanned_at ?? new Date().toISOString(),
              sync_source: "online",
            },
          }));
          showFeedback(
            "success",
            "Attendance successful",
            `${result.student.full_name} · ${result.student.matric_number ?? ""} · ${result.course?.code ?? ""} · ${formatTime(result.scanned_at ?? new Date())}`
          );
          router.refresh();
          return;
        }

        if (result.code === "DUPLICATE" && result.student) {
          showFeedback("warning", "Already marked present", `${result.student.full_name} · ${result.student.matric_number ?? ""}`);
          return;
        }

        const localStudent = studentByToken.get(scannedToken);
        if (result.code === "INVALID_QR" || result.code === "WRONG_INSTITUTION") {
          showFeedback("error", "Invalid QR code", result.message);
          return;
        }
        if (result.code === "NOT_REGISTERED") {
          showFeedback("error", "Not registered for this course", localStudent?.full_name ?? result.message);
          return;
        }
        if (result.code === "SESSION_CLOSED" || result.code === "OUTSIDE_WINDOW") {
          showFeedback("error", "Attendance is closed", result.message);
          return;
        }
        showFeedback("error", "Scan rejected", result.message);
      }
    },
    [online, present, refreshPending, router, session.id, showFeedback, studentByToken]
  );

  // Camera lifecycle -----------------------------------------------------
  const stopCamera = React.useCallback(() => {
    controlsRef.current?.stop();
    controlsRef.current = null;
    setScanning(false);
    setTorchOn(false);
  }, []);

  const startCamera = React.useCallback(
    async (preferredId?: string | null) => {
      if (!videoRef.current) return;
      setCameraError(null);
      stopCamera();
      try {
        const inputs = await BrowserMultiFormatReader.listVideoInputDevices();
        setDevices(inputs);
        const chosen =
          preferredId ??
          deviceId ??
          inputs.find((input) => /back|rear|environment/i.test(input.label))?.deviceId ??
          inputs[0]?.deviceId;

        const reader = new BrowserMultiFormatReader();
        const controls = await reader.decodeFromVideoDevice(chosen ?? undefined, videoRef.current, (result) => {
          if (result) void onToken(result.getText());
        });
        controlsRef.current = controls;
        setScanning(true);
        if (chosen) setDeviceId(chosen);

        const stream = videoRef.current.srcObject as MediaStream | null;
        const track = stream?.getVideoTracks()[0];
        const capabilities = track?.getCapabilities() as (MediaTrackCapabilities & { torch?: boolean }) | undefined;
        setTorchAvailable(Boolean(capabilities?.torch));
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setCameraError(
          /permission|denied|notallowed/i.test(message)
            ? "Camera permission was denied. Allow camera access in your browser settings, or use manual entry."
            : /notfound|devices/i.test(message)
              ? "No camera was found on this device. You can still enter codes manually."
              : `Could not start the camera: ${message}`
        );
        setScanning(false);
      }
    },
    [deviceId, onToken, stopCamera]
  );

  React.useEffect(() => {
    return () => controlsRef.current?.stop();
  }, []);

  React.useEffect(() => {
    setOnline(typeof navigator === "undefined" ? true : navigator.onLine);
    function goOnline() {
      setOnline(true);
      void sync(true);
    }
    function goOffline() {
      setOnline(false);
      showFeedback("warning", "You are offline", "Scans are recorded locally and marked provisional until synchronized.");
    }
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, [showFeedback, sync]);

  React.useEffect(() => {
    if (!online) return;
    const timer = setInterval(() => {
      void sync(true);
    }, 30_000);
    return () => clearInterval(timer);
  }, [online, sync]);

  async function toggleTorch() {
    const stream = videoRef.current?.srcObject as MediaStream | null;
    const track = stream?.getVideoTracks()[0];
    if (!track) return;
    try {
      await track.applyConstraints({ advanced: [{ torch: !torchOn } as MediaTrackConstraintSet] });
      setTorchOn((value) => !value);
    } catch {
      toast.error("This camera does not support the torch.");
    }
  }

  async function switchCamera() {
    if (devices.length < 2) {
      toast.info("Only one camera is available on this device.");
      return;
    }
    const index = devices.findIndex((device) => device.deviceId === deviceId);
    const next = devices[(index + 1) % devices.length];
    await startCamera(next.deviceId);
  }

  function submitManual(event: React.FormEvent) {
    event.preventDefault();
    if (!manual.trim()) return;
    void onToken(manual.trim());
    setManual("");
  }

  const queueCount = pending.length;
  const failedCount = pending.filter((item) => item.status === "failed").length;
  const rows = students
    .filter((student) => present[student.student_id])
    .sort((a, b) => (present[b.student_id]?.scanned_at ?? "").localeCompare(present[a.student_id]?.scanned_at ?? ""));

  const closed = session.status === "closed" || session.status === "cancelled";

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
      <div className="space-y-4">
        <div className="relative overflow-hidden rounded-2xl border bg-black shadow-card">
          <video ref={videoRef} className="aspect-[4/3] w-full object-cover sm:aspect-video" muted playsInline />
          <div className="pointer-events-none absolute inset-0 grid place-items-center">
            <div className="scanner-frame relative h-[62%] w-[62%] max-w-sm rounded-2xl border-2 border-white/70">
              {scanning && <span className="scan-overlay-line" />}
            </div>
          </div>

          {!scanning && (
            <div className="absolute inset-0 grid place-items-center bg-black/70 p-6 text-center">
              <div>
                <Camera className="mx-auto h-8 w-8 text-white/80" />
                <p className="mt-3 text-sm font-medium text-white">Camera is off</p>
                <p className="mt-1 max-w-xs text-xs text-white/70">
                  Start the camera and point it at a student&apos;s QR code. The scanner stays active for the next student automatically.
                </p>
                <Button className="mt-4" onClick={() => void startCamera()}>
                  <Camera /> Start camera
                </Button>
              </div>
            </div>
          )}

          <div className="absolute left-3 top-3 flex flex-wrap items-center gap-2">
            <Badge variant={online ? "success" : "warning"} className="shadow">
              {online ? <Wifi className="h-3 w-3" /> : <CloudOff className="h-3 w-3" />}
              {online ? "Online" : "Offline"}
            </Badge>
            {closed && <Badge variant="destructive">Attendance closed</Badge>}
            {queueCount > 0 && (
              <Badge variant={failedCount > 0 ? "destructive" : "warning"} className="shadow">
                {failedCount > 0 ? `${failedCount} failed` : `${queueCount} pending`}
              </Badge>
            )}
          </div>

          <div className="absolute bottom-3 right-3 flex gap-2">
            {torchAvailable && (
              <Button variant="secondary" size="icon" onClick={toggleTorch} aria-label="Toggle torch">
                {torchOn ? <FlashlightOff /> : <Flashlight />}
              </Button>
            )}
            <Button variant="secondary" size="icon" onClick={switchCamera} aria-label="Switch camera" disabled={!scanning}>
              <SwitchCamera />
            </Button>
            <Button variant="secondary" size="icon" onClick={() => setSoundOn((value) => !value)} aria-label="Toggle sound">
              {soundOn ? <Volume2 /> : <VolumeX />}
            </Button>
          </div>

          {feedback && (
            <div className={cn("absolute inset-x-3 bottom-3 rounded-xl border p-3.5 shadow-lg backdrop-blur", toneStyles[feedback.tone])}>
              <p className="text-sm font-semibold">{feedback.title}</p>
              {feedback.detail && <p className="mt-0.5 text-xs opacity-90">{feedback.detail}</p>}
            </div>
          )}
        </div>

        {cameraError && (
          <div className="rounded-xl border border-warning/40 bg-warning/10 p-4 text-sm text-warning">{cameraError}</div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          {scanning ? (
            <Button variant="outline" onClick={stopCamera}>
              <CameraOff /> Stop camera
            </Button>
          ) : (
            <Button onClick={() => void startCamera()}>
              <Camera /> Start camera
            </Button>
          )}
          <Button variant="outline" onClick={() => sync()} disabled={syncing || queueCount === 0}>
            {syncing ? <Loader2 className="animate-spin" /> : <CloudUpload />}
            Synchronize {queueCount > 0 ? `(${queueCount})` : ""}
          </Button>
          <Button variant="ghost" onClick={() => router.refresh()}>
            <RefreshCw /> Refresh
          </Button>
        </div>

        {manualAllowed && (
          <form onSubmit={submitManual} className="flex gap-2 rounded-xl border bg-card p-3">
            <Input
              value={manual}
              onChange={(event) => setManual(event.target.value)}
              placeholder="Manual fallback: paste the student's QR token"
              className="font-mono text-xs"
            />
            <Button type="submit" variant="outline" disabled={!manual.trim()}>
              Record
            </Button>
          </form>
        )}

        <div className="rounded-xl border bg-card shadow-card">
          <div className="flex items-center justify-between border-b px-5 py-4">
            <div>
              <p className="font-display text-sm font-semibold">Recorded in this session</p>
              <p className="text-xs text-muted-foreground">
                {presentCount} of {registered} registered students
              </p>
            </div>
            <Badge variant="success">{registered ? Math.round((presentCount / registered) * 100) : 0}%</Badge>
          </div>
          {rows.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Matric</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead>Source</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((student) => {
                  const record = present[student.student_id];
                  return (
                    <TableRow key={student.student_id}>
                      <TableCell className="font-medium">{student.full_name}</TableCell>
                      <TableCell className="font-mono text-xs">{student.matric_number ?? "—"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{formatTime(record.scanned_at)}</TableCell>
                      <TableCell>
                        <Badge variant={record.sync_source === "offline" ? "warning" : "success"}>
                          {record.sync_source === "offline" ? "Provisional" : "Confirmed"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <p className="p-5 text-sm text-muted-foreground">No scans recorded yet in this session.</p>
          )}
        </div>
      </div>

      <div className="space-y-4">
        <div className="rounded-xl border bg-card p-5 shadow-card">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Now scanning</p>
          <p className="mt-2 font-display text-lg font-semibold">{session.course_code}</p>
          <p className="text-sm text-muted-foreground">{session.course_title}</p>
          <div className="mt-4 space-y-1.5 text-xs text-muted-foreground">
            <p>
              <span className="font-medium text-foreground">{session.title}</span>
            </p>
            <p>Class date: {session.class_date}</p>
            <p>
              Window: {formatTime(session.opens_at)} → {formatTime(session.closes_at)}
            </p>
          </div>
          <div className="mt-5 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-lg bg-muted/60 p-2.5">
              <p className="text-lg font-semibold">{registered}</p>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Registered</p>
            </div>
            <div className="rounded-lg bg-success/10 p-2.5 text-success">
              <p className="text-lg font-semibold">{presentCount}</p>
              <p className="text-[10px] uppercase tracking-wide">Present</p>
            </div>
            <div className="rounded-lg bg-muted/60 p-2.5">
              <p className="text-lg font-semibold">{Math.max(registered - presentCount, 0)}</p>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Remaining</p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border bg-card p-5 shadow-card">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">Offline queue</p>
            <Badge variant={queueCount === 0 ? "success" : failedCount > 0 ? "destructive" : "warning"}>
              {queueCount === 0 ? "Clear" : failedCount > 0 ? "Needs attention" : "Pending"}
            </Badge>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {queueCount === 0
              ? "All scans have been confirmed by the server."
              : `${queueCount} scan${queueCount === 1 ? "" : "s"} recorded on this device and not yet confirmed. They upload automatically when you are online.`}
          </p>

          {pending.length > 0 && (
            <ul className="mt-3 max-h-56 space-y-2 overflow-y-auto">
              {pending.map((item) => (
                <li key={item.client_transaction_id} className="rounded-lg border px-3 py-2 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{item.student_name}</span>
                    <Badge variant={item.status === "failed" ? "destructive" : "warning"}>
                      {item.status === "failed" ? "Failed" : "Pending"}
                    </Badge>
                  </div>
                  <p className="mt-0.5 text-muted-foreground">
                    {item.matric_number} · {formatTime(item.local_scanned_at)}
                  </p>
                  {item.error && <p className="mt-1 text-destructive">{item.error}</p>}
                </li>
              ))}
            </ul>
          )}

          {queueCount > 0 && (
            <Button className="mt-4 w-full" variant="outline" onClick={() => sync()} disabled={syncing || !online}>
              {syncing ? <Loader2 className="animate-spin" /> : <CloudUpload />}
              {online ? "Synchronize now" : "Waiting for connection"}
            </Button>
          )}
        </div>

        <div className="rounded-xl border bg-muted/30 p-4 text-[11px] leading-relaxed text-muted-foreground">
          <p className="flex items-center gap-1.5 font-semibold text-foreground">
            <CheckCircle2 className="h-3.5 w-3.5 text-success" /> How validation works
          </p>
          <p className="mt-1.5">
            Every online scan is verified by the server: student status, credential, course registration,
            session window and duplicate prevention. Offline scans are matched against the downloaded
            roster and remain provisional until the server accepts them.
          </p>
        </div>
      </div>
    </div>
  );
}
