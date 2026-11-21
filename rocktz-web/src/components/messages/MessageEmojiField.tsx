"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Smile } from "lucide-react";
import { applyEmojiShortcuts, MESSAGE_EMOJIS } from "@/lib/emoji-shortcuts";

export function MessageEmojiField({
  id,
  value,
  onChange,
  placeholder,
  rows = 3,
  maxLength = 5000,
  className,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  rows?: number;
  maxLength?: number;
  className?: string;
}) {
  const { t } = useTranslation("app", { keyPrefix: "messages" });
  const root = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLTextAreaElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    function onPointer(event: MouseEvent) {
      if (root.current?.contains(event.target as Node)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", onPointer);
    return () => document.removeEventListener("mousedown", onPointer);
  }, [open]);

  function placeCursor(cursor: number) {
    requestAnimationFrame(() => {
      const el = field.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(cursor, cursor);
    });
  }

  function update(next: string, cursor: number) {
    const applied = applyEmojiShortcuts(next, cursor);
    onChange(applied.value);
    if (applied.value !== next || applied.cursor !== cursor) placeCursor(applied.cursor);
  }

  function insert(emoji: string) {
    const el = field.current;
    const start = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? value.length;
    const next = value.slice(0, start) + emoji + value.slice(end);
    update(next, start + emoji.length);
    setOpen(false);
  }

  return (
    <div ref={root} className="relative">
      <textarea
        ref={field}
        id={id}
        value={value}
        rows={rows}
        maxLength={maxLength}
        placeholder={placeholder}
        onChange={(event) => update(event.target.value, event.target.selectionStart ?? event.target.value.length)}
        className={className}
      />
      <button
        type="button"
        aria-label={t("emoji")}
        aria-expanded={open}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => setOpen((current) => !current)}
        className="mt-2 inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50"
      >
        <Smile size={18} />
      </button>
      {open ? (
        <div className="absolute bottom-12 left-0 z-20 w-[17.5rem] rounded-2xl border border-slate-200 bg-white p-2 shadow-lg">
          <div className="grid grid-cols-8 gap-1">
            {MESSAGE_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                aria-label={emoji}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => insert(emoji)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-lg hover:bg-slate-100"
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
