"use client";
import { useCallback, useRef, useState } from "react";
import { ArrowRight, Check, Loader2, LogIn, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  mode: "CHECK_IN" | "CHECK_OUT";
  loading?: boolean;
  onComplete: () => void | Promise<void>;
  className?: string;
}

const KNOB = 52;
const THRESHOLD = 0.7; // 70% of the slide required to trigger

/** Slide-to-confirm slider (Pointer Events with capture + keyboard/tap fallback). */
export function SlideToAction({ mode, loading, onComplete, className }: Props) {
  const trackRef = useRef<HTMLDivElement>(null);
  const startX = useRef(0);
  const currentX = useRef(0);
  const isDragging = useRef(false);
  const [x, setX] = useState(0);
  const [drag, setDrag] = useState(false);
  const [done, setDone] = useState(false);

  const checkIn = mode === "CHECK_IN";
  const locked = Boolean(loading) || done;

  const maxSlide = useCallback((): number => {
    const t = trackRef.current;
    if (!t) return 220;
    return Math.max(90, t.clientWidth - KNOB - 14);
  }, []);

  const triggerComplete = useCallback(() => {
    const max = maxSlide();
    setDone(true);
    setX(max);
    currentX.current = max;

    void Promise.resolve(onComplete()).finally(() => {
      window.setTimeout(() => {
        setDone(false);
        setX(0);
        currentX.current = 0;
      }, 1500);
    });
  }, [maxSlide, onComplete]);

  const handlePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (locked || e.button !== 0) return;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* ignore if capture not supported */
    }
    isDragging.current = true;
    startX.current = e.clientX - currentX.current;
    setDrag(true);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!isDragging.current || locked) return;
    const max = maxSlide();
    const newX = Math.min(Math.max(0, e.clientX - startX.current), max);
    currentX.current = newX;
    setX(newX);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!isDragging.current) return;
    isDragging.current = false;
    setDrag(false);
    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch {
      /* ignore */
    }

    const max = maxSlide();
    const ratio = currentX.current / Math.max(1, max);

    if (ratio >= THRESHOLD && !locked) {
      triggerComplete();
    } else {
      currentX.current = 0;
      setX(0);
    }
  };

  const handlePointerCancel = () => {
    isDragging.current = false;
    setDrag(false);
    currentX.current = 0;
    setX(0);
  };

  const max = maxSlide();
  const pct = Math.min(1, Math.max(0, x / Math.max(1, max)));
  const Icon = loading ? Loader2 : checkIn ? LogIn : LogOut;

  return (
    <div className={cn("w-full select-none", className)}>
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
          locked && "opacity-80"
        )}
        style={{ height: 64 }}
      >
        <div
          aria-hidden
          className={cn(
            "absolute inset-y-0 left-0",
            checkIn ? "bg-brand/80" : "bg-amber-300/80",
            !drag && "transition-all duration-200 ease-out"
          )}
          style={{ width: `${pct * 100}%` }}
        />
        <p className="pointer-events-none absolute inset-0 flex items-center justify-center gap-1.5 px-16 text-center text-sm font-bold text-neutral-900">
          {loading
            ? "Recording…"
            : done
              ? "Confirmed!"
              : checkIn
                ? "Slide to Check In"
                : "Slide to Check Out"}
          {!loading && !done && (
            <ArrowRight className="h-4 w-4 shrink-0 animate-pulse text-neutral-800" aria-hidden />
          )}
        </p>
        <button
          type="button"
          disabled={locked}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerCancel}
          className={cn(
            "absolute top-1/2 flex -translate-y-1/2 items-center justify-center rounded-xl text-white shadow-md",
            "cursor-grab active:cursor-grabbing disabled:cursor-not-allowed",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ink",
            !drag && "transition-[left] duration-200 ease-out",
            checkIn ? "bg-brand-ink" : "bg-amber-600"
          )}
          style={{ width: KNOB, height: KNOB - 10, left: 7 + x }}
          aria-label={checkIn ? "Check in" : "Check out"}
        >
          {done && !loading ? (
            <Check className="h-5 w-5 text-[#C3FF7D]" aria-hidden />
          ) : (
            <Icon className={cn("h-5 w-5", loading && "animate-spin")} aria-hidden />
          )}
        </button>
      </div>
      <button
        type="button"
        onClick={() => {
          if (!locked) triggerComplete();
        }}
        disabled={locked}
        className="mt-2 text-xs font-semibold text-neutral-700 underline-offset-2 hover:text-neutral-950 hover:underline disabled:no-underline disabled:opacity-60"
      >
        Can&apos;t slide? Tap here to {checkIn ? "check in" : "check out"}.
      </button>
    </div>
  );
}
