import { useCallback, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { weatherApi } from "@reissulla/api-client";
import { useReduceMotion } from "./useReduceMotion";

export interface RadarFrame {
  timestamp: number;
  tileUrlTemplate: string;
}

export interface RadarTimelineState {
  frames: RadarFrame[];
  currentIdx: number;
  isAnimating: boolean;
  /** Whether the cycle has hit its bounded-pass ceiling and auto-paused. */
  bounded: boolean;
  /** Whether the reduce-motion gate is forcing step-only navigation. */
  stepOnly: boolean;
  play: () => void;
  pause: () => void;
  step: (delta: 1 | -1) => void;
  jumpToFrame: (idx: number) => void;
}

/** ~3 fps cycle — slow enough for HF/MF radar to read, fast enough to feel like motion. */
const FRAME_INTERVAL_MS = 333;
/**
 * Design-system §9 SC 2.2.2 bound on idle motion — radar cycles three full
 * passes (~12 s in current cadence) and then auto-pauses on the most recent
 * frame so the user is never staring at perpetual movement.
 */
const MAX_PASSES = 3;

/**
 * Radar timeline + cycle driver. Fetches the sliding frame window every
 * 60 s (matching the backend cache TTL) and ticks an active-frame index
 * across the frame list. When `reduce-motion` is in effect, cycling
 * never auto-starts and the consumer surface swaps play/pause for
 * step-back / step-forward buttons.
 */
export function useRadarTimeline(enabled: boolean): RadarTimelineState {
  const { effective: reduceMotion } = useReduceMotion();

  const timelineQuery = useQuery({
    queryKey: ["radar-timeline"],
    queryFn: () => weatherApi.getRadarTimeline(60),
    enabled,
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchInterval: 60 * 1000,
  });

  const frames = timelineQuery.data?.data.frames ?? [];
  const lastIdx = Math.max(0, frames.length - 1);

  const [currentIdx, setCurrentIdx] = useState(lastIdx);
  const [paused, setPaused] = useState(false);
  const [bounded, setBounded] = useState(false);
  const [, setPasses] = useState(0);
  const [prevFramesLen, setPrevFramesLen] = useState(frames.length);

  // Adjust state during render when the frame list resets (new poll,
  // length change) — React's "store the previous prop" pattern. Snap
  // back to the latest frame and reset the pass count so a fresh play()
  // starts the cycle from scratch.
  if (frames.length !== prevFramesLen) {
    setPrevFramesLen(frames.length);
    setCurrentIdx(lastIdx);
    setBounded(false);
    setPasses(0);
  }

  // Drive the cycle. Step-only mode (reduce-motion) suppresses the
  // interval entirely — the user advances frames via the surface
  // buttons instead.
  useEffect(() => {
    if (reduceMotion) return;
    if (paused || bounded) return;
    if (frames.length === 0) return;
    const handle = setInterval(() => {
      setCurrentIdx((prev) => {
        const next = prev + 1;
        if (next > lastIdx) {
          setPasses((p) => {
            const nextPasses = p + 1;
            if (nextPasses >= MAX_PASSES) setBounded(true);
            return nextPasses;
          });
          return 0;
        }
        return next;
      });
    }, FRAME_INTERVAL_MS);
    return () => clearInterval(handle);
  }, [reduceMotion, paused, bounded, frames.length, lastIdx]);

  const play = useCallback(() => {
    setPasses(0);
    setBounded(false);
    setPaused(false);
    setCurrentIdx(0);
  }, []);
  const pause = useCallback(() => setPaused(true), []);
  const step = useCallback(
    (delta: 1 | -1) => {
      setPaused(true);
      setCurrentIdx((prev) => {
        const next = prev + delta;
        if (next < 0) return 0;
        if (next > lastIdx) return lastIdx;
        return next;
      });
    },
    [lastIdx],
  );
  const jumpToFrame = useCallback(
    (idx: number) => {
      setPaused(true);
      setCurrentIdx(Math.max(0, Math.min(lastIdx, idx)));
    },
    [lastIdx],
  );

  return {
    frames,
    currentIdx,
    isAnimating: !paused && !bounded && !reduceMotion && frames.length > 0,
    bounded,
    stepOnly: reduceMotion,
    play,
    pause,
    step,
    jumpToFrame,
  };
}
