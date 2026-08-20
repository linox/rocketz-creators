import Link from "next/link";
import { cn } from "@/lib/cn";

type RocketzLogoProps = {
  /** light = landing; dark = fundo escuro (Z roxo); sidebar = barra roxa (tudo branco) */
  variant?: "light" | "dark" | "sidebar";
  size?: "sm" | "md" | "lg" | "xl";
  href?: string;
  className?: string;
  showSubtitle?: boolean;
};

const sizeClasses = {
  sm: { text: "text-[23px]", sub: "text-[10px] mt-0.5" },
  md: { text: "text-[31px]", sub: "text-[13px] mt-0.5" },
  lg: { text: "text-[39px]", sub: "text-[16px] mt-1" },
  xl: { text: "text-[47px]", sub: "text-[19px] mt-1" },
};

export function RocketzLogo({
  variant = "light",
  size = "md",
  href,
  className = "",
  showSubtitle = true,
}: RocketzLogoProps) {
  const sizes = sizeClasses[size];
  const onPurple = variant === "sidebar";

  const wordClass = onPurple || variant === "dark" ? "text-white" : "text-[#0B0C18]";
  const subClass = onPurple ? "text-white/80" : variant === "dark" ? "text-slate-400" : "text-[#6B7280]";

  const content = (
    <div
      className={cn("inline-flex flex-col items-end leading-none select-none", className)}
      aria-label="creatorz by rocketz"
    >
      <span className={cn("font-black tracking-tight lowercase", sizes.text)}>
        <span className={wordClass}>creator</span>
        <span className={onPurple ? "text-white" : "text-[#8A3FFC]"}>z</span>
      </span>
      {showSubtitle ? (
        <span className={cn("font-medium lowercase", sizes.sub, subClass)}>
          by rocketz
        </span>
      ) : null}
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="inline-flex items-center justify-center no-underline" aria-label="creatorz by rocketz">
        {content}
      </Link>
    );
  }

  return content;
}
