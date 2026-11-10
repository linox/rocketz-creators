"use client";

import { useEffect, useState } from "react";

export type LoadedImage = {
  url: string | null;
  status: "empty" | "loading" | "ready" | "error";
};

/** Resolves off-DOM. A missing file stays hidden instead of painting a broken icon. */
export function useLoadedImage(url: string | null | undefined): LoadedImage {
  const [state, setState] = useState<LoadedImage>({ url: null, status: "empty" });

  useEffect(() => {
    const next = url?.trim() || "";
    if (!next) {
      setState({ url: null, status: "empty" });
      return;
    }

    let cancelled = false;
    setState({ url: null, status: "loading" });
    const image = new Image();
    image.onload = () => {
      if (!cancelled) setState({ url: next, status: "ready" });
    };
    image.onerror = () => {
      if (!cancelled) setState({ url: null, status: "error" });
    };
    image.src = next;

    return () => {
      cancelled = true;
    };
  }, [url]);

  return state;
}
