"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useTranslation } from "react-i18next";
import {
  cancelMediaUpload,
  clearUploadAbort,
  completeMediaUpload,
  getMediaUploadStatus,
  initMediaUpload,
  isUploadCancelled,
  runMediaUploadChunks,
  UploadCancelledError,
  waitForMediaUpload,
  type SubmissionUploadMeta,
  type UploadProgressHandler,
} from "@/lib/laravel";
import { alertApiError, alertSuccess } from "@/lib/alerts";

const STORAGE_KEY = "rocketz:active-uploads";

export type ActiveUploadTask = {
  uploadId: string;
  subjectType: SubmissionUploadMeta["type"];
  subjectId: number;
  label: string;
  progress: number;
  phase: "uploading" | "processing" | "done" | "failed";
};

type UploadManagerContextValue = {
  activeUploads: ActiveUploadTask[];
  startSubmissionUpload: (
    file: Blob,
    filename: string,
    submission: SubmissionUploadMeta,
    onProgress?: UploadProgressHandler,
  ) => void;
  cancelActiveUpload: (uploadId: string) => Promise<void>;
  cancelSubjectUpload: (
    type: SubmissionUploadMeta["type"],
    id: number,
    fallbackUploadId?: string | null,
  ) => Promise<void>;
  isSubjectUploading: (type: SubmissionUploadMeta["type"], id: number) => boolean;
  getSubjectProgress: (type: SubmissionUploadMeta["type"], id: number) => number | null;
};

const UploadManagerContext = createContext<UploadManagerContextValue | null>(null);

function readStored(): ActiveUploadTask[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as ActiveUploadTask[]) : [];
  } catch {
    return [];
  }
}

function writeStored(tasks: ActiveUploadTask[]) {
  if (typeof window === "undefined") return;
  if (tasks.length === 0) {
    sessionStorage.removeItem(STORAGE_KEY);
    return;
  }
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
}

export function UploadManagerProvider({ children }: { children: ReactNode }) {
  const { t: tp } = useTranslation("profile");
  const [activeUploads, setActiveUploads] = useState<ActiveUploadTask[]>([]);
  const runningRef = useRef(new Set<string>());
  const uploadsRef = useRef<ActiveUploadTask[]>([]);
  const controllersRef = useRef(new Map<string, AbortController>());
  uploadsRef.current = activeUploads;

  const persist = useCallback((updater: (current: ActiveUploadTask[]) => ActiveUploadTask[]) => {
    setActiveUploads((current) => {
      const next = updater(current);
      writeStored(next);
      return next;
    });
  }, []);

  const removeUpload = useCallback((uploadId: string) => {
    persist((current) => current.filter((task) => task.uploadId !== uploadId));
  }, [persist]);

  const cancelActiveUpload = useCallback(async (uploadId: string) => {
    const task = uploadsRef.current.find((row) => row.uploadId === uploadId);
    if (task) {
      controllersRef.current.get(`${task.subjectType}:${task.subjectId}`)?.abort();
    }
    try {
      await cancelMediaUpload(uploadId);
    } catch {
      /* session may already be gone */
    } finally {
      removeUpload(uploadId);
      window.dispatchEvent(new CustomEvent("rocketz:upload-complete"));
    }
  }, [removeUpload]);

  const cancelSubjectUpload = useCallback(async (
    type: SubmissionUploadMeta["type"],
    id: number,
    fallbackUploadId?: string | null,
  ) => {
    const tempKey = `${type}:${id}`;
    controllersRef.current.get(tempKey)?.abort();
    const uploadId = uploadsRef.current.find(
      (task) => task.subjectType === type && task.subjectId === id,
    )?.uploadId ?? fallbackUploadId ?? null;
    if (!uploadId) return;
    await cancelActiveUpload(uploadId);
  }, [cancelActiveUpload]);

  useEffect(() => {
    const stored = readStored();
    if (stored.length === 0) return;
    setActiveUploads(stored);

    void (async () => {
      const valid: ActiveUploadTask[] = [];
      for (const task of stored) {
        try {
          const status = await getMediaUploadStatus(task.uploadId);
          if (status.status === "done" || status.status === "failed") {
            continue;
          }
          valid.push({
            ...task,
            progress: typeof status.progress === "number" ? status.progress : task.progress,
            phase: status.status === "processing" ? "processing" : "uploading",
          });
        } catch {
          /* drop stale session */
        }
      }
      persist(() => valid);
    })();
  }, [persist]);

  const startSubmissionUpload = useCallback((
    file: Blob,
    filename: string,
    submission: SubmissionUploadMeta,
    onProgress?: UploadProgressHandler,
  ) => {
    const tempKey = `${submission.type}:${submission.id}`;
    if (runningRef.current.has(tempKey)) return;

    runningRef.current.add(tempKey);
    const controller = new AbortController();
    controllersRef.current.set(tempKey, controller);
    let uploadId = "";

    void (async () => {
      try {
        const session = await initMediaUpload(file, filename, submission, controller.signal);
        uploadId = session.data.id;
        if (controller.signal.aborted) {
          await cancelMediaUpload(uploadId).catch(() => undefined);
          throw new UploadCancelledError();
        }

        persist((current) => [
          ...current.filter((task) => !(task.subjectType === submission.type && task.subjectId === submission.id)),
          {
            uploadId,
            subjectType: submission.type,
            subjectId: submission.id,
            label: submission.label,
            progress: 0,
            phase: "uploading",
          },
        ]);

        window.dispatchEvent(new CustomEvent("rocketz:upload-started", { detail: { type: submission.type, id: submission.id } }));

        await runMediaUploadChunks(file, uploadId, session.data.chunk_size, session.data.total_chunks, (percent) => {
          onProgress?.(percent);
          persist((current) => current.map((task) => (
            task.uploadId === uploadId
              ? { ...task, progress: percent, phase: percent >= 90 ? "processing" : "uploading" }
              : task
          )));
        });

        const started = await completeMediaUpload(uploadId);
        await waitForMediaUpload(uploadId, started.data, (percent) => {
          onProgress?.(percent);
          persist((current) => current.map((task) => (
            task.uploadId === uploadId ? { ...task, progress: percent, phase: "processing" } : task
          )));
        });

        removeUpload(uploadId);
        await alertSuccess(tp("uploadComplete"), tp("uploadCompleteHint", { label: submission.label }));
        window.dispatchEvent(new CustomEvent("rocketz:upload-complete", { detail: { type: submission.type, id: submission.id } }));
      } catch (err) {
        const cancelled = isUploadCancelled(err);
        if (uploadId) {
          if (!cancelled) {
            try {
              await cancelMediaUpload(uploadId);
            } catch {
              /* ignore */
            }
          }
          removeUpload(uploadId);
          window.dispatchEvent(new CustomEvent("rocketz:upload-complete", { detail: { type: submission.type, id: submission.id } }));
        }
        if (!cancelled) {
          await alertApiError(err);
        }
      } finally {
        if (uploadId) {
          clearUploadAbort(uploadId);
        }
        controllersRef.current.delete(tempKey);
        runningRef.current.delete(tempKey);
      }
    })();
  }, [persist, removeUpload, tp]);

  const isSubjectUploading = useCallback((type: SubmissionUploadMeta["type"], id: number) => {
    return activeUploads.some((task) => task.subjectType === type && task.subjectId === id);
  }, [activeUploads]);

  const getSubjectProgress = useCallback((type: SubmissionUploadMeta["type"], id: number) => {
    const task = activeUploads.find((row) => row.subjectType === type && row.subjectId === id);
    return task?.progress ?? null;
  }, [activeUploads]);

  const value = useMemo(() => ({
    activeUploads,
    startSubmissionUpload,
    cancelActiveUpload,
    cancelSubjectUpload,
    isSubjectUploading,
    getSubjectProgress,
  }), [activeUploads, startSubmissionUpload, cancelActiveUpload, cancelSubjectUpload, isSubjectUploading, getSubjectProgress]);

  return (
    <UploadManagerContext.Provider value={value}>
      {children}
    </UploadManagerContext.Provider>
  );
}

export function useUploadManager() {
  const ctx = useContext(UploadManagerContext);
  if (!ctx) {
    throw new Error("useUploadManager must be used within UploadManagerProvider");
  }
  return ctx;
}

export function useOptionalUploadManager() {
  return useContext(UploadManagerContext);
}
