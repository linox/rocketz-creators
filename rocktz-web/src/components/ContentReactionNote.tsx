"use client";

import { Heart } from "lucide-react";
import { useTranslation } from "react-i18next";
import { promptContentReaction, type ContentReactionChoice } from "@/lib/alerts";

type NoteProps = {
  scriptLiked?: boolean | null;
  scriptMessage?: string | null;
  videoLiked?: boolean | null;
  videoMessage?: string | null;
};

function hasReaction(liked?: boolean | null, message?: string | null) {
  return Boolean(liked) || Boolean(message?.trim());
}

export function ContentReactionNotes({ scriptLiked, scriptMessage, videoLiked, videoMessage }: NoteProps) {
  const { t } = useTranslation("app");
  const script = hasReaction(scriptLiked, scriptMessage);
  const video = hasReaction(videoLiked, videoMessage);
  if (!script && !video) return null;

  return (
    <div className="flex flex-col gap-2">
      {script ? <ContentReactionNote liked={scriptLiked} message={scriptMessage} stage={t("contentReaction.scriptStage")} /> : null}
      {video ? <ContentReactionNote liked={videoLiked} message={videoMessage} stage={t("contentReaction.videoStage")} /> : null}
    </div>
  );
}

export function ContentReactionNote({ liked, message, stage }: { liked?: boolean | null; message?: string | null; stage?: string }) {
  const { t } = useTranslation("app");
  const text = message?.trim() || "";
  if (!liked && !text) return null;

  return (
    <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5">
      <p className="m-0 flex items-center gap-1.5 text-xs font-black text-rose-700">
        <Heart size={14} className={liked ? "fill-current" : ""} />
        {liked ? t("contentReaction.creatorTitle") : t("contentReaction.creatorMessageTitle")}
        {stage ? <span className="text-[10px] font-extrabold tracking-wider text-rose-400 uppercase">{stage}</span> : null}
      </p>
      {text ? <p className="m-0 mt-1 text-xs font-semibold whitespace-pre-wrap text-slate-800">{text}</p> : null}
    </div>
  );
}

export function ContentReactionButton({
  label,
  liked,
  message,
  disabled,
  onSave,
}: {
  label: string;
  liked?: boolean | null;
  message?: string | null;
  disabled?: boolean;
  onSave: (reaction: ContentReactionChoice) => Promise<unknown> | unknown;
}) {
  const { t } = useTranslation("app");

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => {
        void (async () => {
          const reaction = await promptContentReaction({
            title: t("contentReaction.editTitle"),
            text: t("contentReaction.editText"),
            confirmText: t("contentReaction.save"),
            liked: Boolean(liked),
            message: message ?? "",
          });
          if (!reaction) return;
          await onSave(reaction);
        })();
      }}
      className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2 py-1.5 text-[11px] font-bold whitespace-nowrap text-rose-700 transition-colors hover:bg-rose-100 disabled:opacity-50"
    >
      <Heart size={12} className={liked ? "fill-current" : ""} />
      {liked ? t("contentReaction.liked") : label}
    </button>
  );
}
