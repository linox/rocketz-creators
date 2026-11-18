"use client";

import { useEffect, useState } from "react";
import { mediaPosterUrl } from "@/lib/media-playback";

type CoverStatus = "ready" | "missing";

const RETRIES = 20;
const RETRY_MS = 4000;
const PROBE_MS = 8000;

const covers = new Map<string, CoverStatus>();
const readySrc = new Map<string, string>();
const listeners = new Set<() => void>();
const inflight = new Map<string, Promise<void>>();

function emit() {
  listeners.forEach((listener) => listener());
}

function displayUrl(poster: string): string {
  const join = poster.includes("?") ? "&" : "?";
  return `${poster}${join}cover=1`;
}

function probe(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    const image = new Image();
    let settled = false;
    let timer = 0;
    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      image.onload = null;
      image.onerror = null;
      resolve(ok);
    };
    timer = window.setTimeout(() => {
      image.src = "";
      finish(false);
    }, PROBE_MS);
    image.onload = () => finish(true);
    image.onerror = () => finish(false);
    const join = url.includes("?") ? "&" : "?";
    image.src = `${url}${join}probe=${Date.now()}`;
  });
}

function watchCover(poster: string): Promise<void> {
  const current = inflight.get(poster);
  if (current) return current;

  let job!: Promise<void>;
  job = (async () => {
    if (covers.get(poster) === "ready") return;
    for (let attempt = 0; attempt < RETRIES; attempt += 1) {
      if (await probe(poster)) {
        readySrc.set(poster, displayUrl(poster));
        covers.set(poster, "ready");
        emit();
        return;
      }
      covers.set(poster, "missing");
      emit();
      if (attempt < RETRIES - 1) {
        await new Promise((resolve) => window.setTimeout(resolve, RETRY_MS));
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
  if (covers.get(poster) === "ready") return { url: readySrc.get(poster) ?? displayUrl(poster), pending: false };
  return { url: null, pending: inflight.has(poster) };
}
