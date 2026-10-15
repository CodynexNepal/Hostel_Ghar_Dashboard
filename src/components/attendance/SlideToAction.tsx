"use client";
import { useRef, useState } from "react";
import { ArrowRight, Check, Loader2, LogIn, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  mode: "CHECK_IN" | "CHECK_OUT";
  loading?: boolean;
  onComplete: () => void | Promise<void>;
  className?: string;
}

const KNOB = 52;

/** Slide-to-confirm slider (pointer + touch + keyboard fallback button). */
export function SlideToAction({ mode, loading, onComplete, className }: Props) {
  const trackRef = useRef<HTMLDivElement>(null);
  const startX = useRef(0);
  const active = useRef(false);
  const [x, setX] = useState(0);
  const [drag, setDrag] = useState(false);
  const [done, setDone] = useState(false);
  const inRef = useRef(false);
  inRef.current = drag;

  const checkIn = mode === "CHECK_IN";
  const locked = Boolean(loading) || done;

  function maxSlide(): number {
    const t = trackRef.current;
    if (!t) return 220;
    return Math.max(90, t.clientWidth - KNOB - 14);
  }
  function finish(cx: number) {
    active.current = false;
    setDrag(false);
    if (cx / Math.max(1, maxSlide()) >= 0.85 && !locked) {
      setDone(true);
      void Promise.resolve(onComplete()).finally(() => {
        window.setTimeout(() => {
          setDone(false);
          setX(0);
        }, 1200);
      });
    } else setX(0);
  }
  function begin(cx: number) {
    if (locked) return;
    active.current = true;
    startX.current = cx;
    setDrag(true);
  }
  function move(cx: number) {
    if (!active.current || locked) return;
    setX(Math.min(Math.max(0, cx - startX.current), maxSlide()));
  }

  const pct = Math.min(1, x / Math.max(1, maxSlide()));
  const Icon = loading ? Loader2 : checkIn ? LogIn : LogOut;

  return (
    <div className={cn("w-full", className)}>
      <div
        ref={trackRef}
        role="slider"
        aria-label={checkIn ? "Slide to check in" : "Slide to check out"}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(pct * 100)}
        className={cn(
          "relative w-full touch-none select-none overflow-hidden rounded-2xl border",
          checkIn ? "border-brand bg-brand-muted/60" : "border-amber-300 bg-amber-50",
          locked && "opacity-70"
        )}
        style={{ height: 64 }}
        onPointerMove={(e) => move(e.clientX)}
        onPointerUp={() => finish(x)}
        onPointerCancel={() => {
          active.current = false;
          setDrag(false);
          setX(0);
        }}
      >
        <div
          aria-hidden
          className={cn("absolute inset-y-0 left-0", checkIn ? "bg-brand/70" : "bg-amber-300/70")}
          style={{ width: `${pct * 100}%` }}
        />
        <p className="pointer-events-none absolute inset-0 flex items-center justify-center gap-1.5 px-16 text-center text-sm font-semibold text-neutral-800">
          {loading ? "Recording…" : checkIn ? "Slide to Check In" : "Slide to Check Out"}
          {!loading && <ArrowRight className="h-4 w-4 shrink-0 animate-pulse" aria-hidden />}
        </p>
        <button
          type="button"
          disabled={locked}
          onPointerDown={(e) => {
            e.preventDefault();
            begin(e.clientX);
          }}
          onTouchStart={(e) => {
            if (e.touches[0]) begin(e.touches[0].clientX);
          }}
          onTouchMove={(e) => {
            if (e.touches[0]) move(e.touches[0].clientX);
          }}
          onTouchEnd={() => finish(x)}
          className={cn(
            "absolute top-1/2 flex -translate-y-1/2 items-center justify-center rounded-xl text-white shadow-md",
            "cursor-grab active:cursor-grabbing disabled:cursor-not-allowed",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ink",
            checkIn ? "bg-brand-ink" : "bg-amber-600"
          )}
          style={{ width: KNOB, height: KNOB - 12, left: 7 + x }}
          aria-label={checkIn ? "Check in" : "Check out"}
        >
          {done && !loading ? (
            <Check className="h-5 w-5" aria-hidden />
          ) : (
            <Icon className={cn("h-5 w-5", loading && "animate-spin")} aria-hidden />
          )}
        </button>
      </div>
      <button
        type="button"
        onClick={() => void onComplete()}
        disabled={locked}
        className="mt-2 text-xs font-medium text-neutral-500 underline-offset-2 hover:underline disabled:no-underline disabled:opacity-60"
      >
        Can&apos;t slide? Tap here to {checkIn ? "check in" : "check out"}.
      </button>
    </div>
  );
}
