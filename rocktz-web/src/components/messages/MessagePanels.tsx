"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Select2Field } from "@/components/Select2Field";
import { alertApiError, alertWarning } from "@/lib/alerts";
import { api } from "@/lib/api";
import type { UserRole } from "@/lib/auth";
import { cn } from "@/lib/cn";
import type { ConversationDetail, ConversationRecipients, ConversationSummary, ConversationWork } from "@/lib/types";
import { emitNavRefresh } from "@/lib/session-cache";

const EMPTY_RECIPIENTS: ConversationRecipients = {
  works: [],
  truncated: false,
};

export function formatMessageTime(value: string | null, locale: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export const MESSAGE_POLL_MS = 4000;

export function newerThread(current: ConversationDetail | null, next: ConversationDetail) {
  if (!current || current.id !== next.id) return next;
  const currentLast = current.messages.at(-1)?.id ?? 0;
  const nextLast = next.messages.at(-1)?.id ?? 0;
  return nextLast < currentLast ? current : next;
}

export function workLabel(work: ConversationWork | null | undefined, campaign: string, recurring: string) {
  if (!work) return "";
  return `${work.kind === "recurring" ? recurring : campaign} · ${work.name}`;
}

export function conversationWith(row: ConversationSummary, role: UserRole) {
  const parts: string[] = [];
  if (role !== "company" && row.parties.company) parts.push(row.parties.company.name);
  if (role !== "creator" && row.parties.creator) parts.push(row.parties.creator.name);
  return parts.join(" · ");
}

function sideLabel(side: string | null, t: (key: string) => string) {
  if (side === "agency") return t("sideAgency");
  if (side === "company") return t("sideCompany");
  if (side === "creator") return t("sideCreator");
  return "";
}

export function MessageList({
  items,
  activeId,
  role,
  onOpen,
}: {
  items: ConversationSummary[];
  activeId?: number | null;
  role: UserRole;
  onOpen: (id: number) => void;
}) {
  const { t, i18n } = useTranslation("app", { keyPrefix: "messages" });

  if (items.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-1 px-6 py-10 text-center">
        <p className="text-sm font-semibold text-slate-800">{t("empty")}</p>
        <p className="text-sm text-slate-500">{t("emptyHint")}</p>
      </div>
    );
  }

  return (
    <ul className="min-h-0 flex-1 overflow-y-auto">
      {items.map((item) => {
        const withLabel = conversationWith(item, role);
        const about = workLabel(item.work, t("campaignKind"), t("recurringKind"));
        const active = item.id === activeId;
        return (
          <li key={item.id}>
            <button
              type="button"
              onClick={() => onOpen(item.id)}
              className={cn(
                "flex w-full flex-col gap-1 border-b border-slate-100 px-4 py-3 text-left",
                active ? "bg-purple-50" : "hover:bg-slate-50",
              )}
            >
              <span className="flex items-center gap-2">
                {item.unread ? <span className="h-2 w-2 shrink-0 rounded-full bg-rose-500" aria-hidden /> : null}
                <span className={cn("min-w-0 flex-1 truncate text-sm text-slate-950", item.unread ? "font-bold" : "font-medium")}>
                  {item.subject}
                </span>
                <span className="shrink-0 text-[11px] text-slate-400">{formatMessageTime(item.last_message_at, i18n.language)}</span>
              </span>
              {about ? <span className="truncate text-xs font-semibold text-purple-700">{about}</span> : null}
              {withLabel ? <span className="truncate text-xs text-slate-500">{withLabel}</span> : null}
              {item.preview ? <span className="truncate text-xs text-slate-500">{item.preview}</span> : null}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

export function MessageThread({
  conversation,
  role,
  onBack,
  onReplied,
  showBackOnDesktop = false,
}: {
  conversation: ConversationDetail;
  role: UserRole;
  onBack?: () => void;
  onReplied: (next: ConversationDetail) => void;
  showBackOnDesktop?: boolean;
}) {
  const { t, i18n } = useTranslation("app", { keyPrefix: "messages" });
  const { t: tc } = useTranslation("common");
  const scroller = useRef<HTMLDivElement>(null);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const counterpart = conversationWith(conversation, role);
  const about = workLabel(conversation.work, t("campaignKind"), t("recurringKind"));

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [conversation.id, conversation.messages.length]);

  async function send(event: React.FormEvent) {
    event.preventDefault();
    const text = body.trim();
    if (!text) {
      await alertWarning(t("pickBody"));
      return;
    }
    setSending(true);
    try {
      const res = await api.replyConversation(conversation.id, text);
      setBody("");
      onReplied(res.data);
      emitNavRefresh();
    } catch (err) {
      await alertApiError(err);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex items-start gap-3 border-b border-slate-100 px-4 py-3">
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            className={cn("mt-0.5 shrink-0 text-sm font-semibold text-purple-700", showBackOnDesktop ? "" : "lg:hidden")}
          >
            {tc("back")}
          </button>
        ) : null}
        <div className="min-w-0">
          <h2 className="truncate text-base font-black text-slate-950">{conversation.subject}</h2>
          {about ? <p className="truncate text-xs font-semibold text-purple-700">{about}</p> : null}
          <p className="truncate text-xs font-semibold text-slate-500">{counterpart}</p>
        </div>
      </header>
      <div ref={scroller} className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {conversation.messages.map((message) => {
          const side = sideLabel(message.author.side, t);
          return (
            <article key={message.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="mb-1 flex flex-wrap items-center gap-x-2 text-[11px] font-bold tracking-wide text-slate-500 uppercase">
                <span className="text-slate-800">{message.mine ? t("you") : (message.author.name || side)}</span>
                {side ? <span>{side}</span> : null}
                <span className="font-medium normal-case tracking-normal">{formatMessageTime(message.created_at, i18n.language)}</span>
              </p>
              <p className="text-sm whitespace-pre-wrap break-words text-slate-800">{message.body}</p>
            </article>
          );
        })}
      </div>
      <form onSubmit={send} noValidate className="border-t border-slate-100 p-3">
        <label className="sr-only" htmlFor={`reply-${conversation.id}`}>{t("body")}</label>
        <textarea
          id={`reply-${conversation.id}`}
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder={t("replyPlaceholder")}
          rows={3}
          className="w-full resize-y rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-purple-600"
        />
        <div className="mt-2 flex justify-end">
          <button
            type="submit"
            disabled={sending}
            className="inline-flex h-10 items-center rounded-xl bg-brand-primary px-4 text-sm font-semibold text-white hover:bg-indigo-600 disabled:opacity-60"
          >
            {tc("send")}
          </button>
        </div>
      </form>
    </div>
  );
}

export function MessageCompose({
  role,
  onSent,
  onCancel,
}: {
  role: UserRole;
  onSent: (conversation: ConversationDetail) => void;
  onCancel?: () => void;
}) {
  const { t } = useTranslation("app", { keyPrefix: "messages" });
  const { t: tc } = useTranslation("common");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [recipients, setRecipients] = useState<ConversationRecipients>(EMPTY_RECIPIENTS);
  const [loaded, setLoaded] = useState(false);
  const [workKey, setWorkKey] = useState("");
  const [creatorId, setCreatorId] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setQuery(search.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    let cancelled = false;
    api.conversationRecipients(query ? `?q=${encodeURIComponent(query)}` : "")
      .then((res) => {
        if (!cancelled) {
          setRecipients(res.data);
          setLoaded(true);
        }
      })
      .catch((err) => {
        if (!cancelled) void alertApiError(err);
      });
    return () => {
      cancelled = true;
    };
  }, [query]);

  const workOptions = useMemo(
    () => recipients.works.map((work) => ({
      value: `${work.kind}:${work.id}`,
      label: workLabel(work, t("campaignKind"), t("recurringKind")),
    })),
    [recipients.works, t],
  );

  const selected = useMemo(
    () => recipients.works.find((work) => `${work.kind}:${work.id}` === workKey) ?? null,
    [recipients.works, workKey],
  );

  const needsCreator = role !== "creator";

  function chooseWork(next: string) {
    setWorkKey(next);
    setCreatorId("");
  }

  async function send(event: React.FormEvent) {
    event.preventDefault();
    if (!selected) {
      await alertWarning(t("pickWork"));
      return;
    }
    if (needsCreator && !creatorId) {
      await alertWarning(t("creatorPlaceholder"));
      return;
    }

    if (!subject.trim()) {
      await alertWarning(t("pickSubject"));
      return;
    }
    if (!body.trim()) {
      await alertWarning(t("pickBody"));
      return;
    }

    setSending(true);
    try {
      const res = await api.createConversation({
        subject: subject.trim(),
        body: body.trim(),
        campaign_id: selected.kind === "campaign" ? selected.id : null,
        recurring_contract_id: selected.kind === "recurring" ? selected.id : null,
        creator_id: needsCreator ? Number(creatorId) : null,
      });
      onSent(res.data);
      emitNavRefresh();
    } catch (err) {
      await alertApiError(err);
    } finally {
      setSending(false);
    }
  }

  return (
    <form onSubmit={send} noValidate className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
      <label className="block">
        <span className="sr-only">{t("searchPlaceholder")}</span>
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={t("searchPlaceholder")}
          className="h-11 w-full rounded-xl border border-slate-200 px-4 text-sm text-slate-900 outline-none focus:border-purple-600"
        />
      </label>
      {recipients.truncated ? <p className="text-xs text-slate-500">{t("refineSearch")}</p> : null}
      {loaded && recipients.works.length === 0 && search.trim() === "" ? (
        <p className="text-sm text-slate-500">{t("emptyWorks")}</p>
      ) : (
        <label className="block">
          <span className="mb-1 block text-[11px] font-bold tracking-wider text-slate-500 uppercase">{t("work")}</span>
          <Select2Field
            theme="light"
            placeholder={t("workPlaceholder")}
            value={workKey}
            onChange={chooseWork}
            options={workOptions}
          />
        </label>
      )}
      {selected && needsCreator ? (
        <label className="block">
          <span className="mb-1 block text-[11px] font-bold tracking-wider text-slate-500 uppercase">{t("creator")}</span>
          <Select2Field
            theme="light"
            placeholder={t("creatorPlaceholder")}
            value={creatorId}
            onChange={setCreatorId}
            options={selected.creators.map((creator) => ({ value: String(creator.id), label: creator.name }))}
          />
        </label>
      ) : null}
      {loaded && recipients.works.length === 0 && search.trim() === "" ? (
        onCancel ? (
          <div className="flex justify-end">
            <button type="button" onClick={onCancel} className="inline-flex h-10 items-center rounded-xl px-3 text-sm font-semibold text-slate-600">
              {tc("cancel")}
            </button>
          </div>
        ) : null
      ) : (
      <>
      <label className="block">
        <span className="mb-1 block text-[11px] font-bold tracking-wider text-slate-500 uppercase">{t("subject")}</span>
        <input
          value={subject}
          onChange={(event) => setSubject(event.target.value)}
          placeholder={t("subjectPlaceholder")}
          maxLength={160}
          className="h-11 w-full rounded-xl border border-slate-200 px-4 text-sm text-slate-900 outline-none focus:border-purple-600"
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-[11px] font-bold tracking-wider text-slate-500 uppercase">{t("body")}</span>
        <textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder={t("bodyPlaceholder")}
          rows={5}
          maxLength={5000}
          className="w-full resize-y rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none focus:border-purple-600"
        />
      </label>
      <div className="flex justify-end gap-2">
        {onCancel ? (
          <button type="button" onClick={onCancel} className="inline-flex h-10 items-center rounded-xl px-3 text-sm font-semibold text-slate-600">
            {tc("cancel")}
          </button>
        ) : null}
        <button
          type="submit"
          disabled={sending}
          className="inline-flex h-10 items-center rounded-xl bg-brand-primary px-4 text-sm font-semibold text-white hover:bg-indigo-600 disabled:opacity-60"
        >
          {tc("send")}
        </button>
      </div>
      </>
      )}
    </form>
  );
}
