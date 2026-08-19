import Link from "next/link";
import { cn } from "@/lib/cn";

type RocketzLogoProps = {
  variant?: "light" | "dark";
  size?: "sm" | "md" | "lg" | "xl";
  href?: string;
  className?: string;
  showSubtitle?: boolean;
};

const sizeClasses = {
  sm: { text: "text-[23px]", sub: "text-[9.8px] -mt-1", tracking: "tracking-[0.24em] pl-[0.24em]" },
  md: { text: "text-[31px]", sub: "text-[11.7px] -mt-1.5", tracking: "tracking-[0.25em] pl-[0.25em]" },
  lg: { text: "text-[39px]", sub: "text-[13.6px] -mt-2", tracking: "tracking-[0.27em] pl-[0.27em]" },
  xl: { text: "text-[47px]", sub: "text-[15.6px] -mt-2.5", tracking: "tracking-[0.28em] pl-[0.28em]" },
};

export function RocketzLogo({
  variant = "light",
  size = "md",
  href,
  className = "",
  showSubtitle = true,
}: RocketzLogoProps) {
  const sizes = sizeClasses[size];

  const content = (
    <div className={cn("inline-flex flex-col items-center justify-center text-center select-none group", className)}>
      <div className="flex items-center justify-center leading-none">
        <span className={cn("font-black tracking-tight", sizes.text, variant === "dark" ? "text-white" : "text-slate-950")}>
          rocket
        </span>
        <span
          className={cn(
            "font-black",
            sizes.text,
            variant === "dark" ? "text-purple-400 group-hover:text-purple-300" : "text-purple-600 group-hover:text-purple-700",
          )}
        >
          z
        </span>
      </div>
      {showSubtitle ? (
        <span
          className={cn(
            "font-black uppercase text-center",
            sizes.sub,
            sizes.tracking,
            variant === "dark" ? "text-slate-400" : "text-slate-500",
          )}
        >
          CREATORS
        </span>
      ) : null}
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="inline-flex items-center justify-center no-underline">
        {content}
      </Link>
    );
  }

  return content;
}
