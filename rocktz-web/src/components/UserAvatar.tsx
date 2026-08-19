"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";

type AvatarSize = "xs" | "sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | "custom";
type AvatarShape = "circle" | "rounded-lg" | "rounded-xl" | "rounded-2xl" | "square";

const AVATAR_GRADIENTS = [
  "bg-gradient-to-br from-indigo-500 to-purple-600 text-white",
  "bg-gradient-to-br from-blue-500 to-cyan-600 text-white",
  "bg-gradient-to-br from-emerald-500 to-teal-600 text-white",
  "bg-gradient-to-br from-purple-600 to-pink-600 text-white",
  "bg-gradient-to-br from-amber-500 to-orange-600 text-white",
  "bg-gradient-to-br from-rose-500 to-red-600 text-white",
  "bg-gradient-to-br from-violet-600 to-indigo-700 text-white",
  "bg-gradient-to-br from-teal-500 to-emerald-700 text-white",
  "bg-gradient-to-br from-cyan-600 to-blue-700 text-white",
  "bg-gradient-to-br from-fuchsia-500 to-purple-700 text-white",
];

const SIZE_MAP: Record<AvatarSize, { box: string; text: string }> = {
  xs: { box: "h-6 w-6", text: "text-[9px]" },
  sm: { box: "h-8 w-8", text: "text-xs" },
  md: { box: "h-10 w-10", text: "text-sm" },
  lg: { box: "h-12 w-12", text: "text-base" },
  xl: { box: "h-16 w-16", text: "text-xl" },
  "2xl": { box: "h-20 w-20", text: "text-2xl" },
  "3xl": { box: "h-24 w-24", text: "text-3xl" },
  custom: { box: "", text: "" },
};

const SHAPE_MAP: Record<AvatarShape, string> = {
  circle: "rounded-full",
  "rounded-lg": "rounded-lg",
  "rounded-xl": "rounded-xl",
  "rounded-2xl": "rounded-2xl",
  square: "rounded-none",
};

export function getInitials(name?: string | null): string {
  if (!name) return "?";
  const clean = name.replace(/^@/, "").trim();
  if (!clean) return "?";
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return `${parts[0][0] ?? ""}${parts[parts.length - 1][0] ?? ""}`.toUpperCase();
}

export function getAvatarGradient(name?: string | null): string {
  if (!name) return AVATAR_GRADIENTS[0];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_GRADIENTS[Math.abs(hash) % AVATAR_GRADIENTS.length];
}

export function UserAvatar({
  src,
  name,
  alt,
  size = "md",
  className,
  textClassName,
  shape = "rounded-xl",
}: {
  src?: string | null;
  name?: string | null;
  alt?: string;
  size?: AvatarSize;
  className?: string;
  textClassName?: string;
  shape?: AvatarShape;
}) {
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setHasError(false);
  }, [src]);

  const sizeConfig = SIZE_MAP[size];
  const box = cn(
    "relative flex shrink-0 select-none items-center justify-center overflow-hidden",
    sizeConfig.box,
    SHAPE_MAP[shape],
    className,
  );

  if (!src || hasError) {
    return (
      <div className={cn(box, getAvatarGradient(name), "font-bold tracking-tight shadow-xs")} title={name || alt || "Usuário"}>
        <span className={cn("font-extrabold uppercase", textClassName || sizeConfig.text)}>{getInitials(name)}</span>
      </div>
    );
  }

  return (
    <div className={box} title={name || alt || "Usuário"}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt || name || "Avatar"}
        onError={() => setHasError(true)}
        className="h-full w-full object-cover"
        referrerPolicy="no-referrer"
      />
    </div>
  );
}
