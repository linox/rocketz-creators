"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import { AuthenticatedShell } from "@/components/AuthenticatedShell";
import { MessageCompose, MessageList, MessageThread } from "@/components/messages/MessagePanels";
import { alertApiError } from "@/lib/alerts";
import { api } from "@/lib/api";
import { cn } from "@/lib/cn";
import { emitNavRefresh } from "@/lib/session-cache";
import type { ConversationDetail, ConversationSummary } from "@/lib/types";
import { useAuth } from "@/lib/use-auth";

function MessagesInner() {
  const user = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useTranslation("app", { keyPrefix: "messages" });
  const { t: tc } = useTranslation("common");
  const requested = Number(searchParams.get("c") || 0) || 0;
  const [items, setItems] = useState<ConversationSummary[]>([]);
  const [thread, setThread] = useState<ConversationDetail | null>(null);
  const [composing, setComposing] = useState(false);
  const [ready, setReady] = useState(false);

  const loadList = useCallback(async () => {
    const res = await api.conversations();
    setItems(res.data);
  }, []);

  useEffect(() => {
    let cancelled = false;
    api.conversations()
      .then((res) => {
        if (!cancelled) setItems(res.data);
      })
      .catch((err) => {
        if (!cancelled) void alertApiError(err);
      })
      .finally(() => {
        if (!cancelled) setReady(true);
      });
    const timer = window.setInterval(() => {
      void loadList().catch(() => undefined);
    }, 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [loadList, user.company?.id, user.id, user.role]);

  useEffect(() => {
    if (!requested) {
      setThread(null);
      return;
    }
    let cancelled = false;
    api.conversation(requested)
      .then((res) => {
        if (cancelled) return;
        setThread(res.data);
        setComposing(false);
        setItems((current) => current.map((item) => (item.id === res.data.id ? { ...item, unread: false } : item)));
        emitNavRefresh();
      })
      .catch(() => {
        if (!cancelled) router.replace("/messages");
      });
    return () => {
      cancelled = true;
    };
  }, [requested, router, user.company?.id]);

  function openThread(id: number) {
    setComposing(false);
    router.replace(`/messages?c=${id}`, { scroll: false });
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4">
      <header>
        <h1 className="text-2xl font-black text-slate-950">{t("title")}</h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-500">{t("subtitle")}</p>
      </header>
      <div className="flex min-h-[32rem] flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm lg:h-[calc(100dvh-16rem)] lg:flex-row">
        <aside className={cn("flex min-h-0 w-full flex-col lg:w-80 lg:border-r lg:border-slate-200", thread ? "hidden lg:flex" : "flex")}>
          <div className="border-b border-slate-100 p-3">
            <button
              type="button"
              onClick={() => {
                setComposing((current) => !current);
              }}
              className="inline-flex h-10 w-full items-center justify-center rounded-xl bg-brand-primary text-sm font-semibold text-white hover:bg-indigo-600"
            >
              {composing ? tc("cancel") : t("new")}
            </button>
          </div>
          {composing ? (
            <MessageCompose
              role={user.role}
              onCancel={() => setComposing(false)}
              onSent={(next) => {
                setItems((current) => [next, ...current.filter((item) => item.id !== next.id)]);
                setComposing(false);
                openThread(next.id);
              }}
            />
          ) : ready ? (
            <MessageList items={items} activeId={thread?.id} role={user.role} onOpen={openThread} />
          ) : (
            <p className="px-4 py-6 text-sm text-slate-500">{tc("loading")}</p>
          )}
        </aside>
        <section className={cn("flex min-h-0 min-w-0 flex-1 flex-col", thread ? "flex" : "hidden lg:flex")}>
          {thread ? (
            <MessageThread
              conversation={thread}
              role={user.role}
              onBack={() => router.replace("/messages", { scroll: false })}
              onReplied={(next) => {
                setThread(next);
                setItems((current) => current.map((item) => (item.id === next.id ? { ...item, ...next, unread: false } : item)));
              }}
            />
          ) : (
            <div className="flex flex-1 items-center justify-center px-6 text-center text-sm text-slate-500">
              {t("noThread")}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

export function MessagesScreen() {
  return (
    <AuthenticatedShell>
      <MessagesInner />
    </AuthenticatedShell>
  );
}
