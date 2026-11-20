"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Select2Field } from "@/components/Select2Field";
import { UserAvatar } from "@/components/UserAvatar";
import { alertApiError, alertWarning } from "@/lib/alerts";
import { api } from "@/lib/api";
import type { UserRole } from "@/lib/auth";
import { cn } from "@/lib/cn";
import type { ConversationDetail, ConversationParticipant, ConversationRecipients, ConversationSummary, ConversationWork } from "@/lib/types";
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

const CLOSE_REASONS = ["resolved", "no_longer_needed", "duplicate", "other"] as const;

export const MESSAGE_POLL_MS = 4000;

export function filterConversations(items: ConversationSummary[], filter: string) {
  if (!filter || filter === "all") return items;
  if (filter === "open") return items.filter((item) => !item.closed);
  if (filter === "closed") return items.filter((item) => item.closed);
  return items.filter((item) => item.close_reason === filter);
}

export function MessageStatusFilter({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  const { t } = useTranslation("app", { keyPrefix: "messages" });

  return (
    <Select2Field
      theme="light"
      value={value}
      onChange={onChange}
      options={[
        { value: "all", label: t("filterAll") },
        { value: "open", label: t("filterOpen") },
        { value: "closed", label: t("filterClosed") },
        ...CLOSE_REASONS.map((reason) => ({ value: reason, label: t(`reasons.${reason}`) })),
      ]}
    />
  );
}

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

const FACE_LIMIT = 3;

export function MessageFaces({ people }: { people: ConversationParticipant[] }) {
  if (people.length === 0) return null;
  const visible = people.slice(0, FACE_LIMIT);
  const extra = people.length - visible.length;
  const names = people.map((person) => person.name).filter(Boolean).join(", ");

  return (
    <span className="flex shrink-0 items-center" aria-label={names} title={names}>
      <span className="flex -space-x-2">
        {visible.map((person, index) => (
          <UserAvatar
            key={`${person.id ?? "person"}-${index}`}
            src={person.photo_url}
            name={person.name}
            alt={person.name}
            size="custom"
            shape="circle"
            className="h-8 w-8 border-2 border-white"
            textClassName="text-[10px]"
          />
        ))}
      </span>
      {extra > 0 ? (
        <span className="ml-1 inline-flex h-8 min-w-8 items-center justify-center rounded-full border-2 border-white bg-slate-100 px-1 text-[10px] font-bold text-slate-600">
          +{extra}
        </span>
      ) : null}
    </span>
  );
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
                "flex w-full items-start gap-3 border-b border-slate-100 px-4 py-3 text-left",
                active ? "bg-purple-50" : "hover:bg-slate-50",
              )}
            >
              <MessageFaces people={item.participants ?? []} />
              <span className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="flex items-center gap-2">
                {item.unread ? <span className="h-2 w-2 shrink-0 rounded-full bg-rose-500" aria-hidden /> : null}
                <span className={cn("min-w-0 flex-1 truncate text-sm text-slate-950", item.unread ? "font-bold" : "font-medium")}>
                  {item.subject}
                  {item.closed ? (
                    <span className="ml-2 text-[11px] font-semibold text-slate-400">
                      {item.close_reason ? `${t("closed")} · ${t(`reasons.${item.close_reason}`)}` : t("closed")}
                    </span>
                  ) : null}
                </span>
                <span className="shrink-0 text-[11px] text-slate-400">{formatMessageTime(item.last_message_at, i18n.language)}</span>
              </span>
              {about ? <span className="truncate text-xs font-semibold text-purple-700">{about}</span> : null}
              {withLabel ? <span className="truncate text-xs text-slate-500">{withLabel}</span> : null}
              {item.preview ? <span className="truncate text-xs text-slate-500">{item.preview}</span> : null}
              </span>
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
  const [closing, setClosing] = useState(false);
  const [pickingReason, setPickingReason] = useState(false);
  const [reason, setReason] = useState("");
  const counterpart = conversationWith(conversation, role);
  const canClose = !conversation.closed && (role === "admin" || role === "company");
  const about = workLabel(conversation.work, t("campaignKind"), t("recurringKind"));

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [conversation.id, conversation.messages.length]);

  async function close() {
    if (!reason) {
      await alertWarning(t("pickCloseReason"));
      return;
    }
    setClosing(true);
    try {
      const res = await api.closeConversation(conversation.id, reason);
      setPickingReason(false);
      onReplied(res.data);
      emitNavRefresh();
    } catch (err) {
      await alertApiError(err);
    } finally {
      setClosing(false);
    }
  }

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
        <MessageFaces people={conversation.participants ?? []} />
        <div className="min-w-0">
          <h2 className="truncate text-base font-black text-slate-950">{conversation.subject}</h2>
          {about ? <p className="truncate text-xs font-semibold text-purple-700">{about}</p> : null}
          <p className="truncate text-xs font-semibold text-slate-500">{counterpart}</p>
        </div>
        {canClose ? (
          <button
            type="button"
            onClick={() => setPickingReason(true)}
            disabled={closing}
            className="ml-auto shrink-0 text-xs font-semibold text-rose-600 disabled:opacity-60"
          >
            {t("close")}
          </button>
        ) : null}
      </header>
      <div ref={scroller} className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {conversation.messages.map((message) => {
          const side = sideLabel(message.author.side, t);
          return (
            <article key={message.id} className="flex items-start gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
              <UserAvatar
                src={message.author.photo_url}
                name={message.author.name}
                alt={message.author.name || side}
                size="custom"
                shape="circle"
                className="mt-0.5 h-7 w-7 border border-white"
                textClassName="text-[10px]"
              />
              <div className="min-w-0 flex-1">
              <p className="mb-1 flex flex-wrap items-center gap-x-2 text-[11px] font-bold tracking-wide text-slate-500 uppercase">
                <span className="text-slate-800">{message.mine ? t("you") : (message.author.name || side)}</span>
                {side ? <span>{side}</span> : null}
                <span className="font-medium normal-case tracking-normal">{formatMessageTime(message.created_at, i18n.language)}</span>
              </p>
              <p className="text-sm whitespace-pre-wrap break-words text-slate-800">{message.body}</p>
              </div>
            </article>
          );
        })}
      </div>
      {conversation.closed ? (
        <p className="border-t border-slate-100 px-4 py-3 text-sm text-slate-500">
          {conversation.close_reason
            ? `${t("closedHint")} ${t(`reasons.${conversation.close_reason}`)}.`
            : t("closedHint")}
        </p>
      ) : pickingReason ? (
        <div className="space-y-3 border-t border-slate-100 p-3">
          <label className="block">
            <span className="mb-1 block text-[11px] font-bold tracking-wider text-slate-500 uppercase">{t("closeReason")}</span>
            <Select2Field
              theme="light"
              placeholder={t("closeReasonPlaceholder")}
              value={reason}
              onChange={setReason}
              options={CLOSE_REASONS.map((item) => ({ value: item, label: t(`reasons.${item}`) }))}
            />
          </label>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setPickingReason(false)} className="inline-flex h-10 items-center rounded-xl px-3 text-sm font-semibold text-slate-600">
              {tc("cancel")}
            </button>
            <button
              type="button"
              onClick={() => void close()}
              disabled={closing}
              className="inline-flex h-10 items-center rounded-xl bg-rose-600 px-4 text-sm font-semibold text-white disabled:opacity-60"
            >
              {t("close")}
            </button>
          </div>
        </div>
      ) : (
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
      )}
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
