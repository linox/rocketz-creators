"use client";

import { useEffect, useState } from "react";
import { mediaPosterUrl } from "@/lib/media-playback";

type CoverStatus = "ready" | "missing";

const covers = new Map<string, CoverStatus>();
const listeners = new Set<() => void>();
const inflight = new Map<string, Promise<void>>();

function emit() {
  listeners.forEach((listener) => listener());
}

function probe(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve(true);
    image.onerror = () => resolve(false);
    image.src = url;
  });
}

function watchCover(poster: string): Promise<void> {
  const current = inflight.get(poster);
  if (current) return current;

  let job!: Promise<void>;
  job = (async () => {
    if (covers.get(poster) === "ready") return;
    for (let attempt = 0; attempt < 6; attempt += 1) {
      if (await probe(poster)) {
        covers.set(poster, "ready");
        emit();
        return;
      }
      covers.set(poster, "missing");
      emit();
      if (attempt < 5) {
        await new Promise((resolve) => window.setTimeout(resolve, 3000));
      }
    }
  })().finally(() => {
    if (inflight.get(poster) === job && covers.get(poster) !== "ready") inflight.delete(poster);
    emit();
  });

  inflight.set(poster, job);
  return job;
}

/** The JPEG stored beside the video. One load is shared by every screen. */
export function useVideoCover(src?: string | null): { url: string | null; pending: boolean } {
  const poster = mediaPosterUrl(src);
  const [, setTick] = useState(0);

  useEffect(() => {
    const listener = () => setTick((value) => value + 1);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  useEffect(() => {
    if (!poster || covers.get(poster) === "ready") return;
    void watchCover(poster);
  }, [poster]);

  if (!poster) return { url: null, pending: false };
  if (covers.get(poster) === "ready") return { url: poster, pending: false };
  return { url: null, pending: inflight.has(poster) };
}
