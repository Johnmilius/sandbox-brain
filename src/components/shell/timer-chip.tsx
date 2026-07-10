"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { startTimer, stopTimer } from "@/app/time/actions";
import { formatClock, formatDuration } from "@/lib/format";
import type { TimeEntry } from "@/lib/database.types";

type RunningEntry = TimeEntry & { projectName: string };

type PausedMarker = {
  projectId: string;
  projectName: string;
  pausedAt: string;
};

const STORAGE_KEY = "sandbox-brain:paused-timer";

function readPausedMarker(): PausedMarker | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PausedMarker;
  } catch {
    return null;
  }
}

function writePausedMarker(marker: PausedMarker | null) {
  if (typeof window === "undefined") return;
  try {
    if (marker) {
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(marker));
    } else {
      window.sessionStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // sessionStorage unavailable (private mode, etc.) — pause/resume marker
    // just won't persist; the shell still renders fine without it.
  }
}

type TimerChipProps = {
  runningEntry: RunningEntry | null;
};

export function TimerChip({ runningEntry }: TimerChipProps) {
  const [now, setNow] = useState(() => Date.now());
  // Lazy-init from sessionStorage. This only differs from the server-rendered
  // markup (always null) when a paused marker exists, which is itself only
  // ever written client-side — so there is nothing for the server to have
  // rendered differently against.
  const [paused, setPaused] = useState<PausedMarker | null>(() =>
    runningEntry ? null : readPausedMarker(),
  );
  const [pending, startTransition] = useTransition();
  const [toastMsg, setToastVisible] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // If a running entry shows up from the server (e.g. after resume + revalidate),
  // any stale paused marker is no longer relevant. Clearing storage is a side
  // effect on external state, not a React state sync, so it stays in the effect;
  // the local state itself is derived below instead of set here.
  useEffect(() => {
    if (runningEntry) writePausedMarker(null);
  }, [runningEntry]);

  const effectivePaused = runningEntry ? null : paused;

  useEffect(() => {
    if (!runningEntry) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [runningEntry]);

  useEffect(() => {
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  function showSavedToast(ms: number) {
    setToastVisible(`Saved ${formatDuration(ms)} to your time log`);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastVisible(null), 3200);
  }

  if (!runningEntry && !effectivePaused) return null;

  function onPause() {
    if (!runningEntry) return;
    const elapsedMs = Math.max(
      0,
      Date.now() - new Date(runningEntry.started_at).getTime(),
    );
    startTransition(async () => {
      const { error } = await stopTimer(runningEntry!.id);
      if (error) {
        toast.error(error);
        return;
      }
      const marker: PausedMarker = {
        projectId: runningEntry!.project_id,
        projectName: runningEntry!.projectName,
        pausedAt: new Date().toISOString(),
      };
      writePausedMarker(marker);
      setPaused(marker);
      showSavedToast(elapsedMs);
    });
  }

  function onResume() {
    if (!effectivePaused) return;
    startTransition(async () => {
      const { error } = await startTimer(effectivePaused.projectId);
      if (error) {
        toast.error(error);
        return;
      }
      writePausedMarker(null);
      setPaused(null);
    });
  }

  function onEnd() {
    if (!effectivePaused) return;
    writePausedMarker(null);
    setPaused(null);
  }

  const isRunning = runningEntry != null;
  const elapsed = runningEntry
    ? Math.max(0, now - new Date(runningEntry.started_at).getTime())
    : 0;
  const taskLabel =
    runningEntry?.projectName ?? effectivePaused?.projectName ?? "";

  return (
    <div className="flex flex-col gap-2">
      <div
        className="rounded-[9px] border bg-white px-[10px] py-[9px]"
        style={{ borderColor: "#ededeb" }}
      >
        <div className="flex items-center gap-2">
          <span className="relative flex size-[9px] shrink-0 items-center justify-center">
            {isRunning && (
              <span
                className="absolute inline-flex size-[9px] rounded-full"
                style={{
                  backgroundColor: "var(--v2-timer-green)",
                  animation: "v2-timer-ring 1.8s ease-out infinite",
                }}
              />
            )}
            <span
              className="relative inline-flex size-[9px] rounded-full"
              style={{
                backgroundColor: isRunning
                  ? "var(--v2-timer-green)"
                  : "var(--v2-amber)",
              }}
            />
          </span>
          <span className="font-mono text-[14px] font-medium text-[var(--v2-ink-1)] tabular-nums">
            {isRunning ? formatClock(elapsed) : "Paused"}
          </span>
          <div className="ml-auto flex items-center gap-1.5">
            {isRunning ? (
              <button
                type="button"
                onClick={onPause}
                disabled={pending}
                aria-label="Pause timer"
                title="Pause"
                className="flex size-7 items-center justify-center rounded-md bg-[#1c1c1f] text-white disabled:opacity-50"
              >
                <span aria-hidden className="text-[10px] leading-none">
                  ❚❚
                </span>
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={onEnd}
                  disabled={pending}
                  aria-label="End & save to time log"
                  title="End & save to time log"
                  className="flex size-7 items-center justify-center rounded-md border bg-white disabled:opacity-50"
                  style={{ borderColor: "var(--v2-danger-border)", color: "var(--v2-danger)" }}
                >
                  <span aria-hidden className="text-[10px] leading-none">
                    ■
                  </span>
                </button>
                <button
                  type="button"
                  onClick={onResume}
                  disabled={pending}
                  aria-label="Resume timer"
                  title="Resume"
                  className="flex size-7 items-center justify-center rounded-md text-white disabled:opacity-50"
                  style={{ backgroundColor: "var(--v2-timer-green)" }}
                >
                  <span aria-hidden className="text-[10px] leading-none">
                    ▶
                  </span>
                </button>
              </>
            )}
          </div>
        </div>
        {taskLabel && (
          <p
            className="mt-1 truncate text-[10.5px]"
            style={{ color: "var(--v2-ink-3)" }}
          >
            {taskLabel}
          </p>
        )}
      </div>

      {toastMsg && (
        <div
          className="flex items-center gap-1.5 rounded-[9px] border px-[10px] py-[7px] text-[11px]"
          style={{
            backgroundColor: "var(--v2-success-bg)",
            borderColor: "var(--v2-success-border)",
            color: "var(--v2-success-text)",
          }}
        >
          <span aria-hidden>✓</span>
          <span className="truncate">{toastMsg}</span>
        </div>
      )}

      <style jsx>{`
        @keyframes v2-timer-ring {
          0% {
            transform: scale(0.8);
            opacity: 0.55;
          }
          100% {
            transform: scale(2.4);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}
