"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { useTranslation } from "react-i18next";
import { MessageCircle, X } from "lucide-react";
import { MESSAGE_POLL_MS, MessageCompose, MessageList, MessageStatusFilter, MessageThread, filterConversations, newerThread } from "@/components/messages/MessagePanels";
import { alertApiError } from "@/lib/alerts";
import { api } from "@/lib/api";
import type { AuthUser } from "@/lib/auth";
import { cn } from "@/lib/cn";
import type { ConversationDetail, ConversationSummary } from "@/lib/types";
import { emitNavRefresh } from "@/lib/session-cache";

type DockView = "list" | "thread" | "compose";

type DockFrame = {
  top: number;
  height: number;
  keyboard: boolean;
};

function useDockFrame(): DockFrame | null {
  const [frame, setFrame] = useState<DockFrame | null>(null);

  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;

    function update() {
      const next = window.visualViewport;
      if (!next) return;
      const hidden = window.innerHeight - next.height;
      setFrame({
        top: next.offsetTop + 8,
        height: Math.max(220, next.height - 16),
        keyboard: hidden > 120,
      });
    }

    update();
    viewport.addEventListener("resize", update);
    viewport.addEventListener("scroll", update);
    window.addEventListener("orientationchange", update);
    return () => {
      viewport.removeEventListener("resize", update);
      viewport.removeEventListener("scroll", update);
      window.removeEventListener("orientationchange", update);
    };
  }, []);

  return frame;
}

export function MessageDock({
  user,
  unread,
  menuOpen,
}: {
  user: AuthUser;
  unread: number;
  menuOpen: boolean;
}) {
  const pathname = usePathname();
  const frame = useDockFrame();
  const { t } = useTranslation("app", { keyPrefix: "messages" });
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<DockView>("list");
  const [items, setItems] = useState<ConversationSummary[]>([]);
  const [thread, setThread] = useState<ConversationDetail | null>(null);
  const [filter, setFilter] = useState("all");
  const openRef = useRef(open);
  const seenUnread = useRef<number | null>(null);
  const alerted = useRef(false);
  const openId = useRef<number | null>(null);
  openRef.current = open;
  openId.current = open && view === "thread" ? thread?.id ?? null : null;

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (menuOpen) setOpen(false);
  }, [menuOpen]);

  const onInbox = (pathname.replace(/\/+$/, "") || "/") === "/messages";

  useEffect(() => {
    if (onInbox) return;
    let cancelled = false;

    async function load() {
      if (document.visibilityState === "hidden") return;
      try {
        const res = await api.conversations();
        if (cancelled) return;
        const rows = res.data.map((item) => (item.id === openId.current ? { ...item, unread: false } : item));
        setItems(rows);
        const count = rows.filter((item) => item.unread).length;
        if (seenUnread.current !== count && (seenUnread.current !== null || count > 0)) emitNavRefresh();
        seenUnread.current = count;
      } catch (err) {
        if (openRef.current && !alerted.current && !cancelled) {
          alerted.current = true;
          await alertApiError(err);
        }
      }
    }

    void load();
    const timer = window.setInterval(() => {
      void load();
    }, MESSAGE_POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [onInbox, user.company?.id, user.role]);

  useEffect(() => {
    if (!open || view !== "thread" || !thread?.id) return;
    const id = thread.id;
    let cancelled = false;
    const timer = window.setInterval(() => {
      if (document.visibilityState === "hidden") return;
      api.conversation(id)
        .then((res) => {
          if (cancelled) return;
          setThread((current) => newerThread(current, res.data));
          setItems((current) => current.map((item) => (item.id === res.data.id ? { ...item, ...res.data, unread: false } : item)));
        })
        .catch(() => undefined);
    }, MESSAGE_POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [open, view, thread?.id]);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    function onPointer(event: MouseEvent) {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest("[data-message-dock]")) return;
      if (target.closest("[role='listbox']")) return;
      setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onPointer);
    };
  }, [open]);

  async function openThread(id: number) {
    setView("thread");
    try {
      const res = await api.conversation(id);
      setThread(res.data);
      setItems((current) => current.map((item) => (item.id === id ? { ...item, unread: false } : item)));
      emitNavRefresh();
    } catch (err) {
      setView("list");
      await alertApiError(err);
    }
  }

  const path = pathname.replace(/\/+$/, "") || "/";
  if (!mounted || path === "/messages") return null;

  const keyboard = open && frame?.keyboard === true;

  return createPortal(
    <div
      data-message-dock
      style={keyboard && frame ? { top: frame.top, height: frame.height } : undefined}
      className={cn(
        "fixed right-3 flex flex-col items-end lg:right-6",
        keyboard ? "left-3 bottom-auto" : "bottom-[calc(var(--app-bottom-nav-h)+0.75rem)] lg:bottom-6",
        open ? "z-[45]" : "z-30",
      )}
    >
      {open ? (
        <section
          className={cn(
            "flex min-h-0 w-[min(24rem,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_18px_50px_rgba(15,23,42,0.18)]",
            keyboard
              ? "h-full w-full"
              : "mb-3 h-[min(32rem,calc(100dvh-var(--app-header-h)-var(--app-bottom-nav-h)-6.5rem))]",
          )}
          aria-label={t("title")}
        >
          <header className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
            <h2 className="min-w-0 flex-1 truncate text-sm font-black text-slate-950">{t("title")}</h2>
            <Link href="/messages" className="shrink-0 text-xs font-semibold text-purple-700" onClick={() => setOpen(false)}>
              {t("openInbox")}
            </Link>
            <button type="button" onClick={() => setOpen(false)} aria-label={t("closeDock")} className="text-slate-500">
              <X size={18} />
            </button>
          </header>
          {view === "compose" ? (
            <MessageCompose
              role={user.role}
              onCancel={() => setView("list")}
              onSent={(next) => {
                setThread(next);
                setItems((current) => [next, ...current.filter((item) => item.id !== next.id)]);
                setView("thread");
              }}
            />
          ) : null}
          {view === "thread" && thread ? (
            <MessageThread
              conversation={thread}
              role={user.role}
              showBackOnDesktop
              onBack={() => setView("list")}
              onReplied={(next) => {
                setThread(next);
                setItems((current) => current.map((item) => (item.id === next.id ? { ...item, ...next, unread: false } : item)));
              }}
            />
          ) : null}
          {view === "list" ? (
            <>
              <div className="border-b border-slate-100 p-3">
                <button
                  type="button"
                  onClick={() => setView("compose")}
                  className="inline-flex h-10 w-full items-center justify-center rounded-xl bg-brand-primary text-sm font-semibold text-white hover:bg-indigo-600"
                >
                  {t("new")}
                </button>
              </div>
              <div className="border-b border-slate-100 px-3 py-2">
                <MessageStatusFilter value={filter} onChange={setFilter} role={user.role} />
              </div>
              {filterConversations(items, filter).length === 0 && items.length > 0 ? (
                <p className="px-4 py-6 text-sm text-slate-500">{t("emptyFilter")}</p>
              ) : (
                <MessageList items={filterConversations(items, filter)} role={user.role} onOpen={(id) => void openThread(id)} />
              )}
            </>
          ) : null}
        </section>
      ) : null}
      {keyboard ? null : (
      <button
        type="button"
        onClick={() => {
          setOpen((current) => !current);
          setView("list");
        }}
        aria-expanded={open}
        aria-label={open ? t("closeDock") : t("dockLabel")}
        className="relative flex h-14 w-14 items-center justify-center rounded-full bg-[#8A3FFC] text-white shadow-lg shadow-purple-300"
      >
        {open ? <X size={24} /> : <MessageCircle size={26} />}
        {!open && unread > 0 ? (
          <span className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-black text-white">
            {unread > 99 ? "99+" : unread}
          </span>
        ) : null}
      </button>
      )}
    </div>,
    document.body,
  );
}
