"use client";

import { FormEvent, MouseEvent, useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  AnimatePresence,
  motion,
  useMotionValue,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
  type MotionValue,
} from "motion/react";
import {
  ArrowRight,
  Award,
  BarChart3,
  Building2,
  Calendar,
  Check,
  CheckCircle2,
  DollarSign,
  Instagram,
  Layers,
  Linkedin,
  Menu,
  Smartphone,
  Sparkles,
  TrendingUp,
  Tv,
  Users,
  Video,
  X,
  Youtube,
} from "lucide-react";
import { PasswordField } from "@/components/PasswordField";
import { Select2Field } from "@/components/Select2Field";
import { RocketzLogo } from "@/components/RocketzLogo";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { alertApiError, alertWarning } from "@/lib/alerts";
import type { AuthPayload } from "@/lib/auth";
import { promptAndSendPasswordReset } from "@/lib/forgot-password";
import { getAppLocale } from "@/i18n/config";
import { laravelFetch, persistAuth } from "@/lib/laravel";
import {
  formatInstagram,
  formatUF,
  formatWhatsApp,
  instagramHandle,
  isValidEmail,
  isValidUF,
  isValidWhatsApp,
  passwordError,
  UF_OPTIONS,
} from "@/lib/masks";
import { useTranslation } from "react-i18next";

type Modal = "none" | "creator" | "company" | "login";

const trustedBrands: { name: string; className: string; boxed?: boolean }[] = [
  { name: "Samsung", className: "text-[17px] font-black uppercase tracking-[0.22em]" },
  { name: "natura", className: "font-serif text-[23px] font-medium lowercase tracking-tight" },
  { name: "AMERICANAS", boxed: true, className: "text-[12px] font-bold uppercase tracking-[0.16em]" },
  { name: "oBoticário", className: "text-[18px] font-semibold tracking-tight" },
  { name: "NETSHOES", className: "text-[16px] font-black italic uppercase tracking-wide" },
  { name: "PHILIPS", className: "text-[17px] font-bold uppercase tracking-[0.28em]" },
  { name: "BRASTEMP", className: "text-[16px] font-black uppercase tracking-[0.08em]" },
];

const benefitCardDefs = [
  { icon: DollarSign, titleKey: "benefits.investTitle", textKey: "benefits.investText" },
  { icon: Video, titleKey: "benefits.contentTitle", textKey: "benefits.contentText" },
  { icon: TrendingUp, titleKey: "benefits.resultsTitle", textKey: "benefits.resultsText" },
  { icon: Users, titleKey: "benefits.scaleTitle", textKey: "benefits.scaleText" },
] as const;

const creatorCategoryValues = [
  "UGC Content",
  "Influenciador",
  "Ator / Apresentador",
  "Moda & Beleza",
  "Fitness & Saúde",
  "Gastronomia",
  "Tecnologia & Games",
] as const;

const modalInput =
  "h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm outline-none transition-colors focus:border-purple-600";

const sectionInner = "mx-auto max-w-7xl px-4 sm:px-6 lg:px-8";
const sectionY = "py-20 md:py-28";
const kickerClass = "text-[11px] font-bold uppercase tracking-[0.22em] text-purple-600";
const sectionTitleClass = "mt-4 text-balance text-3xl font-extrabold tracking-tight text-slate-950 sm:text-4xl";
const sectionLeadClass = "mt-4 max-w-lg text-pretty text-base leading-relaxed text-slate-600 sm:text-lg";
const btnPrimary =
  "inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-purple-600 px-6 py-3 text-sm font-bold text-white shadow-md shadow-purple-500/20 transition-colors hover:bg-purple-700";
const btnSecondary =
  "inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-purple-200 bg-white px-6 py-3 text-sm font-bold text-purple-700 shadow-xs transition-colors hover:bg-purple-50";
const btnOnDark =
  "inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/5 px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-white/10 sm:w-auto";

function SectionIntro({
  kicker,
  title,
  subtitle,
  className,
}: {
  kicker: string;
  title: string;
  subtitle: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <p className={kickerClass}>{kicker}</p>
      <h2 className={sectionTitleClass}>{title}</h2>
      <p className={sectionLeadClass}>{subtitle}</p>
    </div>
  );
}

function ModalField({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-bold text-slate-700">
        {label}
        {required ? <span className="text-rose-500"> *</span> : null}
      </label>
      {children}
    </div>
  );
}

function ParallaxImage({
  src,
  alt,
  className,
  children,
}: {
  src: string;
  alt: string;
  className?: string;
  children?: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  const y = useTransform(scrollYProgress, [0, 1], reduce ? ["0%", "0%"] : ["-14%", "14%"]);
  const scale = useTransform(scrollYProgress, [0, 1], reduce ? [1.08, 1.08] : [1.2, 1.05]);

  return (
    <div ref={ref} className={`relative overflow-hidden ${className ?? ""}`}>
      <motion.img
        src={src}
        alt={alt}
        style={{ y, scale }}
        className="h-full w-full object-cover will-change-transform"
      />
      {children}
    </div>
  );
}

function BenefitStack() {
  const { t } = useTranslation("landing");
  const stackRef = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: stackRef,
    offset: ["start 28%", "end 72%"],
  });

  return (
    <div ref={stackRef} className="lg:col-span-7">
      {benefitCardDefs.map((card, index) => (
        <StackedBenefitCard
          key={card.titleKey}
          icon={card.icon}
          title={t(card.titleKey)}
          text={t(card.textKey)}
          index={index}
          total={benefitCardDefs.length}
          progress={scrollYProgress}
          reduce={reduce === true}
        />
      ))}
    </div>
  );
}

function StackedBenefitCard({
  icon: Icon,
  title,
  text,
  index,
  total,
  progress,
  reduce,
}: {
  icon: typeof DollarSign;
  title: string;
  text: string;
  index: number;
  total: number;
  progress: MotionValue<number>;
  reduce: boolean;
}) {
  const start = index / Math.max(total - 1, 1);
  const depth = total - 1 - index;
  const scale = useTransform(progress, [start, 1], [1, 1 - depth * 0.07]);
  const y = useTransform(progress, [start, 1], [0, depth * -6]);
  const boxShadow = useTransform(
    progress,
    [start, 1],
    [
      "0 1px 2px rgb(15 23 42 / 0.05), 0 12px 28px -10px rgb(15 23 42 / 0.14), 0 32px 56px -20px rgb(109 40 217 / 0.16)",
      `0 1px 1px rgb(15 23 42 / 0.04), 0 ${8 + depth * 3}px ${22 + depth * 8}px -12px rgb(15 23 42 / ${0.08 + depth * 0.02}), 0 ${18 + depth * 6}px ${40 + depth * 10}px -18px rgb(109 40 217 / ${0.06 + depth * 0.025})`,
    ],
  );

  return (
    <article
      className="mb-5 last:mb-0 lg:mb-0 lg:sticky lg:pb-6"
      style={{ top: `calc(7rem + ${index * 0.9}rem)`, zIndex: index + 1 }}
    >
      <motion.div
        style={reduce ? undefined : { scale, y, boxShadow, transformOrigin: "top center" }}
        className="origin-top rounded-3xl border border-slate-200/70 bg-white p-7 shadow-[0_1px_2px_rgb(15_23_42/0.05),0_12px_28px_-10px_rgb(15_23_42/0.12),0_28px_50px_-18px_rgb(109_40_217/0.12)] max-lg:!transform-none sm:p-8"
      >
        <div className="mb-6 flex items-center justify-between">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-purple-50 text-purple-600">
            <Icon size={26} />
          </div>
          <span className="text-xs font-black tracking-widest text-slate-300">0{index + 1}</span>
        </div>
        <h3 className="mb-3 text-balance text-lg font-bold text-slate-950 sm:text-xl">{title}</h3>
        <p className="text-pretty text-sm leading-relaxed text-slate-600">{text}</p>
      </motion.div>
    </article>
  );
}

function AudienceCards({
  onCompany,
  onCreator,
}: {
  onCompany: () => void;
  onCreator: () => void;
}) {
  const { t } = useTranslation("landing");
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start 92%", "start 38%"],
  });
  const enter = useSpring(scrollYProgress, { stiffness: 68, damping: 22, restDelta: 0.001 });
  const leftX = useTransform(enter, [0, 1], reduce ? ["0vw", "0vw"] : ["-20vw", "0vw"]);
  const rightX = useTransform(enter, [0.08, 1], reduce ? ["0vw", "0vw"] : ["20vw", "0vw"]);
  const leftOpacity = useTransform(enter, [0, 0.32, 1], reduce ? [1, 1, 1] : [0, 1, 1]);
  const rightOpacity = useTransform(enter, [0.08, 0.4, 1], reduce ? [1, 1, 1] : [0, 1, 1]);

  return (
    <div ref={ref} className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:gap-8">
      <motion.div
        id="para-empresas"
        style={{ x: leftX, opacity: leftOpacity }}
        className="flex scroll-mt-24 flex-col rounded-3xl border border-slate-200 bg-white p-7 shadow-xs sm:p-10"
      >
        <span className="inline-flex w-fit rounded-full border border-purple-100 bg-purple-50 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-purple-600">
          {t("audience.forCompanies")}
        </span>
        <h2 className="mt-5 mb-5 text-balance text-2xl font-extrabold tracking-tight text-slate-950 sm:text-3xl">
          {t("audience.companiesTitle")}
        </h2>
        <ul className="space-y-3.5">
          {(t("audience.companiesItems", { returnObjects: true }) as string[]).map((item) => (
            <li key={item} className="flex items-start gap-3 text-sm font-medium leading-relaxed text-slate-700">
              <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-purple-600" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
        <div className="relative mt-8 aspect-video overflow-hidden rounded-2xl border border-slate-200 bg-slate-900 shadow-md">
          <ParallaxImage
            src="https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=800&q=80"
            alt={t("audience.campaignsAlt")}
            className="h-full w-full"
          />
          <div className="absolute inset-0 flex items-end bg-gradient-to-t from-slate-950/80 via-transparent to-transparent p-4">
            <span className="flex items-center gap-1.5 text-xs font-bold text-white">
              <Building2 size={14} className="text-purple-400" />
              {t("audience.campaignsCaption")}
            </span>
          </div>
        </div>
        <button onClick={onCompany} className={`${btnPrimary} mt-8`}>
          {t("audience.registerCompany")} <ArrowRight size={16} />
        </button>
      </motion.div>

      <motion.div
        id="para-criadores"
        style={{ x: rightX, opacity: rightOpacity }}
        className="flex scroll-mt-24 flex-col rounded-3xl border border-slate-200 bg-white p-7 shadow-xs sm:p-10"
      >
        <span className="inline-flex w-fit rounded-full border border-purple-100 bg-purple-50 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-purple-600">
          {t("audience.forCreators")}
        </span>
        <h2 className="mt-5 mb-5 text-balance text-2xl font-extrabold tracking-tight text-slate-950 sm:text-3xl">
          {t("audience.creatorsTitle")}
        </h2>
        <ul className="space-y-3.5">
          {(t("audience.creatorsItems", { returnObjects: true }) as string[]).map((item) => (
            <li key={item} className="flex items-start gap-3 text-sm font-medium leading-relaxed text-slate-700">
              <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-purple-600" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
        <div className="relative mt-8 aspect-video overflow-hidden rounded-2xl border border-slate-200 bg-slate-900 shadow-md">
          <ParallaxImage
            src="https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=800&q=80"
            alt={t("audience.creatorAlt")}
            className="h-full w-full"
          />
          <div className="absolute inset-0 flex items-end bg-gradient-to-t from-slate-950/80 via-transparent to-transparent p-4">
            <span className="flex items-center gap-1.5 text-xs font-bold text-white">
              <Sparkles size={14} className="text-purple-400" />
              {t("audience.noMillions")}
            </span>
          </div>
        </div>
        <button onClick={onCreator} className={`${btnSecondary} mt-8`}>
          {t("audience.join")} <ArrowRight size={16} />
        </button>
      </motion.div>
    </div>
  );
}

export function LandingPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const tl = (key: string, options?: Record<string, unknown>) => t(`landing:${key}`, options);
  const ta = (key: string, options?: Record<string, unknown>) => t(`auth:${key}`, options);
  const tc = (key: string, options?: Record<string, unknown>) => t(`common:${key}`, options);
  const tList = (key: string) => {
    const value = tl(key, { returnObjects: true });
    return Array.isArray(value) ? (value as string[]) : [];
  };
  const [modal, setModal] = useState<Modal>("none");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [creatorStep, setCreatorStep] = useState(1);
  const [loading, setLoading] = useState(false);

  const [creator, setCreator] = useState({
    full_name: "",
    artistic_name: "",
    instagram: "",
    category: "UGC Content",
    whatsapp: "",
    city: "",
    state: "",
    email: "",
    password: "",
    password_confirmation: "",
    lgpd_accepted: false,
  });

  const [company, setCompany] = useState({
    name: "",
    responsible_name: "",
    email: "",
    whatsapp: "",
    segment: "",
    objective: "",
    password: "",
    password_confirmation: "",
    lgpd_accepted: false,
  });

  const [login, setLogin] = useState({ email: "", password: "" });
  const categoryLabels = t("auth:categories", { returnObjects: true }) as Record<string, string>;
  const creatorCategoryOptions = creatorCategoryValues.map((value) => ({
    value,
    label: categoryLabels[value] ?? value,
  }));

  const reduceMotion = useReducedMotion();
  const heroRef = useRef<HTMLElement>(null);
  const tiltX = useMotionValue(0);
  const tiltY = useMotionValue(0);
  const { scrollY, scrollYProgress } = useScroll();
  const { scrollYProgress: heroProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  });

  const progressX = useSpring(scrollYProgress, { stiffness: 120, damping: 28, restDelta: 0.001 });
  const headerBg = useTransform(scrollY, [0, 72], ["rgba(253,253,254,0.55)", "rgba(255,255,255,0.92)"]);
  const headerBorder = useTransform(scrollY, [0, 72], [0, 1]);
  const orbOneY = useTransform(scrollY, [0, 900], reduceMotion ? [0, 0] : [0, 220]);
  const orbTwoY = useTransform(scrollY, [0, 900], reduceMotion ? [0, 0] : [0, -160]);
  const heroImageY = useTransform(heroProgress, [0, 1], reduceMotion ? ["0%", "0%"] : ["0%", "22%"]);
  const heroImageScale = useTransform(heroProgress, [0, 1], reduceMotion ? [1, 1] : [1, 1.12]);
  const heroCardOneY = useTransform(heroProgress, [0, 1], reduceMotion ? ["0%", "0%"] : ["0%", "-18%"]);
  const heroCardTwoY = useTransform(heroProgress, [0, 1], reduceMotion ? ["0%", "0%"] : ["0%", "16%"]);
  const rotateX = useSpring(useTransform(tiltY, [-0.5, 0.5], [8, -8]), { stiffness: 160, damping: 18 });
  const rotateY = useSpring(useTransform(tiltX, [-0.5, 0.5], [-10, 10]), { stiffness: 160, damping: 18 });

  function onHeroPointerMove(event: MouseEvent<HTMLDivElement>) {
    if (reduceMotion) return;
    const rect = event.currentTarget.getBoundingClientRect();
    tiltX.set((event.clientX - rect.left) / rect.width - 0.5);
    tiltY.set((event.clientY - rect.top) / rect.height - 0.5);
  }

  function onHeroPointerLeave() {
    tiltX.set(0);
    tiltY.set(0);
  }

  useEffect(() => {
    document.body.style.overflow = modal !== "none" ? "hidden" : "unset";
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [modal]);

  function scrollTo(id: string) {
    setMobileOpen(false);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  }

  async function submitJson(path: string, body: unknown) {
    setLoading(true);
    try {
      const payload = await laravelFetch<AuthPayload>(path, {
        method: "POST",
        body: JSON.stringify(
          body && typeof body === "object" ? { ...(body as object), locale: getAppLocale() } : body,
        ),
      });
      router.push(persistAuth(payload, path === "/auth/register/creator"));
    } catch (err) {
      await alertApiError(err);
    } finally {
      setLoading(false);
    }
  }

  async function goCreatorStep(next: number) {
    if (creatorStep === 1) {
      if (!creator.full_name.trim() || !creator.artistic_name.trim() || instagramHandle(creator.instagram).length < 2) {
        await alertWarning(tc("alerts.incompleteTitle"), ta("creatorIncomplete"));
        return;
      }
      if (!creator.category) {
        await alertWarning(ta("styleRequiredTitle"), ta("styleRequired"));
        return;
      }
    }
    if (creatorStep === 2) {
      if (!isValidWhatsApp(creator.whatsapp)) {
        await alertWarning(tc("alerts.invalidWhatsappTitle"), tc("alerts.invalidWhatsapp"));
        return;
      }
      if (!creator.city.trim()) {
        await alertWarning(tc("alerts.cityRequiredTitle"), tc("alerts.cityRequired"));
        return;
      }
      if (!isValidUF(creator.state)) {
        await alertWarning(tc("alerts.ufRequiredTitle"), tc("alerts.ufRequired"));
        return;
      }
    }
    setCreatorStep(next);
  }

  async function onCreatorSubmit(event: FormEvent) {
    event.preventDefault();
    if (!isValidEmail(creator.email)) {
      await alertWarning(tc("alerts.invalidEmailTitle"), ta("invalidEmailCreate"));
      return;
    }
    const passwordIssue = passwordError(creator.password, creator.password_confirmation);
    if (passwordIssue) {
      await alertWarning(tc("alerts.invalidPasswordTitle"), tc(`password.${passwordIssue}`));
      return;
    }
    if (!creator.lgpd_accepted) {
      await alertWarning(tc("alerts.lgpdTitle"), tc("alerts.lgpdRequired"));
      return;
    }
    await submitJson("/auth/register/creator", {
      ...creator,
      instagram: instagramHandle(creator.instagram),
      state: formatUF(creator.state),
    });
  }

  async function onCompanySubmit(event: FormEvent) {
    event.preventDefault();
    if (!company.name.trim() || !company.responsible_name.trim()) {
      await alertWarning(tc("alerts.incompleteTitle"), ta("companyIncomplete"));
      return;
    }
    if (!isValidEmail(company.email)) {
      await alertWarning(tc("alerts.invalidEmailTitle"), ta("invalidEmailCompany"));
      return;
    }
    if (!isValidWhatsApp(company.whatsapp)) {
      await alertWarning(tc("alerts.invalidWhatsappTitle"), tc("alerts.invalidWhatsapp"));
      return;
    }
    const passwordIssue = passwordError(company.password, company.password_confirmation);
    if (passwordIssue) {
      await alertWarning(tc("alerts.invalidPasswordTitle"), tc(`password.${passwordIssue}`));
      return;
    }
    if (!company.lgpd_accepted) {
      await alertWarning(tc("alerts.lgpdTitle"), tc("alerts.lgpdRequired"));
      return;
    }
    await submitJson("/auth/register/company", company);
  }

  async function onLoginSubmit(event: FormEvent) {
    event.preventDefault();
    if (!isValidEmail(login.email) || !login.password) {
      await alertWarning(tc("alerts.incompleteTitle"), ta("loginIncomplete"));
      return;
    }
    await submitJson("/auth/login", login);
  }

  async function onForgotPassword() {
    await promptAndSendPasswordReset(login.email);
  }

  function openCreator() {
    setCreatorStep(1);
    setModal("creator");
  }

  return (
    <div className="relative flex min-h-screen w-full flex-col overflow-x-clip bg-[#FDFDFE] font-sans text-slate-900 antialiased selection:bg-purple-600 selection:text-white">
      <motion.header
        style={{ backgroundColor: headerBg }}
        className="sticky top-0 z-40 pt-[env(safe-area-inset-top,0px)] backdrop-blur-md"
      >
        <motion.div
          aria-hidden
          className="absolute inset-x-0 top-0 h-0.5 origin-left bg-gradient-to-r from-purple-600 via-indigo-500 to-purple-400"
          style={{ scaleX: progressX }}
        />
        <motion.div
          aria-hidden
          className="absolute inset-x-0 bottom-0 h-px bg-slate-100"
          style={{ opacity: headerBorder }}
        />
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:h-20 sm:gap-4 sm:px-6 lg:px-8">
          <RocketzLogo variant="light" size="md" href="/" />
          <nav className="hidden items-center gap-7 text-sm font-medium text-slate-600 lg:flex xl:gap-8">
            <button onClick={() => scrollTo("para-empresas")} className="hover:text-purple-600">{tl("nav.forCompanies")}</button>
            <button onClick={() => scrollTo("para-criadores")} className="hover:text-purple-600">{tl("nav.forCreators")}</button>
            <button onClick={() => scrollTo("como-funciona")} className="hover:text-purple-600">{tl("nav.howItWorks")}</button>
            <button onClick={() => scrollTo("recursos")} className="hover:text-purple-600">{tl("nav.features")}</button>
            <button onClick={() => scrollTo("marcas-parceiras")} className="hover:text-purple-600">{tl("nav.partnerBrands")}</button>
          </nav>
          <div className="flex min-w-0 items-center gap-1.5 sm:gap-2.5">
            <LanguageSwitcher theme="light" />
            <button onClick={() => setModal("login")} className="hidden h-10 items-center px-3 text-sm font-semibold text-slate-700 hover:text-purple-600 sm:inline-flex">
              {ta("login")}
            </button>
            <button
              onClick={() => openCreator()}
              className="inline-flex h-10 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl bg-purple-600 px-3 text-xs font-bold text-white transition-colors hover:bg-purple-700 sm:px-4 sm:text-sm"
            >
              {ta("signUp")} <ArrowRight size={14} className="hidden sm:inline" />
            </button>
            <button className="rounded-xl p-2 text-slate-700 lg:hidden" onClick={() => setMobileOpen((value) => !value)}>
              {mobileOpen ? <X /> : <Menu />}
            </button>
          </div>
        </div>
        {mobileOpen ? (
          <nav className="border-t border-slate-100/80 px-4 py-3 lg:hidden sm:px-6">
            <div className="mx-auto flex max-w-7xl flex-col gap-1 text-sm font-medium text-slate-700">
              {[
                { id: "para-empresas", label: tl("nav.forCompanies") },
                { id: "para-criadores", label: tl("nav.forCreators") },
                { id: "como-funciona", label: tl("nav.howItWorks") },
                { id: "recursos", label: tl("nav.features") },
                { id: "marcas-parceiras", label: tl("nav.partnerBrands") },
              ].map((link) => (
                <button
                  key={link.id}
                  onClick={() => scrollTo(link.id)}
                  className="rounded-lg px-2 py-2.5 text-left hover:bg-purple-50 hover:text-purple-700"
                >
                  {link.label}
                </button>
              ))}
              <button
                onClick={() => { setMobileOpen(false); setModal("login"); }}
                className="rounded-lg px-2 py-2.5 text-left hover:bg-purple-50 hover:text-purple-700 sm:hidden"
              >
                {ta("login")}
              </button>
            </div>
          </nav>
        ) : null}
      </motion.header>

      <section ref={heroRef} className="relative overflow-hidden bg-gradient-to-b from-purple-50/40 via-white to-white px-4 pb-16 pt-12 sm:px-6 md:pb-20 md:pt-16 lg:px-8 lg:pt-20">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <motion.div
            aria-hidden
            style={{ y: orbOneY }}
            className="absolute -left-24 top-8 h-80 w-80 rounded-full bg-purple-400/25 blur-3xl"
          />
          <motion.div
            aria-hidden
            style={{ y: orbTwoY }}
            className="absolute -right-16 top-32 h-72 w-72 rounded-full bg-indigo-400/20 blur-3xl"
          />
        </div>
        <div className="relative mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-12 lg:gap-16">
          <div className="lg:col-span-6">
            <h1 className="text-balance text-4xl font-black leading-[1.18] tracking-tight text-slate-950 sm:text-5xl lg:text-[52px] lg:leading-[1.15]">
              {tl("hero.titleBefore")}{" "}
              <span className="bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 bg-clip-text text-transparent">{tl("hero.titleHighlight")}</span>
            </h1>
            <p className="mt-6 max-w-xl text-pretty text-base leading-relaxed text-slate-600 sm:text-lg">
              {tl("hero.subtitle")}
            </p>
            <div className="mt-9 flex max-w-lg flex-col gap-4 sm:flex-row">
              <div className="min-w-0 flex-1">
                <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">{tl("hero.forCompanies")}</p>
                <button onClick={() => setModal("company")} className={btnPrimary}>
                  {tl("hero.imACompany")} <ArrowRight size={16} />
                </button>
              </div>
              <div className="min-w-0 flex-1">
                <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">{tl("hero.forCreators")}</p>
                <button onClick={() => openCreator()} className={btnSecondary}>
                  {tl("hero.wantCreator")} <ArrowRight size={16} />
                </button>
              </div>
            </div>
            <div className="mt-12 grid grid-cols-1 gap-5 border-t border-slate-100 pt-8 sm:grid-cols-3 sm:gap-6">
              {[
                { icon: Calendar, title: tl("hero.campaigns"), sub: tl("hero.campaignsSub") },
                { icon: Users, title: tl("hero.profiles"), sub: tl("hero.profilesSub") },
                { icon: BarChart3, title: tl("hero.moreContent"), sub: tl("hero.moreContentSub") },
              ].map((item) => (
                <div key={item.title} className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-purple-100 bg-purple-50 text-purple-600">
                    <item.icon size={16} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-900">{item.title}</p>
                    <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{item.sub}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="relative lg:col-span-6">
            <div
              className="relative mx-auto w-full max-w-[540px] [perspective:1400px]"
              onMouseMove={onHeroPointerMove}
              onMouseLeave={onHeroPointerLeave}
            >
              <motion.div
                style={{ rotateX, rotateY, transformStyle: "preserve-3d" }}
                className="relative aspect-[4/3.8] w-full overflow-hidden rounded-3xl border border-slate-100 bg-slate-100 shadow-2xl"
              >
                <motion.img
                  src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=1200&q=85"
                  alt={tl("hero.creatorAlt")}
                  style={{ y: heroImageY, scale: heroImageScale }}
                  className="h-full w-full object-cover will-change-transform"
                />
                <motion.div style={{ y: heroCardOneY }} className="absolute right-4 top-4 w-full max-w-[240px]">
                  <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-slate-100 bg-white/95 p-4 shadow-xl backdrop-blur-sm">
                    <div className="mb-3.5 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{tl("hero.campaign")}</p>
                        <p className="mt-0.5 text-xs font-black text-slate-900">{tl("hero.newLaunch")}</p>
                      </div>
                      <span className="shrink-0 rounded-full bg-purple-50 px-2 py-0.5 text-[9px] font-bold text-purple-700">{tl("hero.inProgress")}</span>
                    </div>
                    <div className="space-y-1.5">
                      {[tl("hero.briefing"), tl("hero.creatorsFound"), tl("hero.selected"), tl("hero.delivered")].map((label) => (
                        <div key={label} className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-2.5 py-1.5 text-[11px]">
                          <span className="font-medium">{label}</span>
                          <Check size={14} className="shrink-0 text-emerald-500" />
                        </div>
                      ))}
                    </div>
                  </motion.div>
                </motion.div>
                <motion.div style={{ y: heroCardTwoY }} className="absolute bottom-4 left-4 w-full max-w-[210px]">
                  <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-slate-100 bg-white/95 p-3.5 shadow-xl backdrop-blur-sm">
                    <p className="mb-2.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">{tl("hero.approvedContent")}</p>
                    <div className="relative mb-2.5 aspect-video overflow-hidden rounded-xl bg-slate-900">
                      <img
                        src="https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=600&q=80"
                        alt={tl("hero.approvedPreview")}
                        className="h-full w-full object-cover"
                      />
                      <div className="absolute inset-0 flex items-center justify-center bg-slate-900/20">
                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-purple-600 shadow-md">
                          <Video size={14} />
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-[11px] font-bold text-emerald-700">
                      <CheckCircle2 size={13} className="text-emerald-600" />
                      <span>{tl("hero.ready")}</span>
                    </div>
                  </motion.div>
                </motion.div>
              </motion.div>
            </div>
          </div>
        </div>
      </section>

      <section id="marcas-parceiras" className="scroll-mt-24 bg-white px-4 py-12 sm:px-6 md:py-14 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <p className="text-center text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
            {tl("brandsTrust")}
          </p>
          <div className="relative mt-8 overflow-hidden">
            <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r from-white to-transparent sm:w-24" />
            <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-white to-transparent sm:w-24" />
            <div className="landing-marquee flex w-max items-center gap-x-12 sm:gap-x-16">
              {[...trustedBrands, ...trustedBrands].map((brand, index) => (
                <span
                  key={`${brand.name}-${index}`}
                  className={`select-none whitespace-nowrap text-slate-500 ${brand.boxed ? "border border-slate-400 px-2 py-0.5" : ""} ${brand.className}`}
                >
                  {brand.name}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="recursos" className={`bg-[#FAFAFC] ${sectionY}`}>
        <div className={sectionInner}>
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-12 lg:gap-16">
            <SectionIntro
              kicker={tl("platform.kicker")}
              title={tl("platform.title")}
              subtitle={tl("platform.subtitle")}
              className="lg:sticky lg:top-28 lg:col-span-5 lg:self-start"
            />

            <BenefitStack />
          </div>

          <div className="mt-16 rounded-3xl border border-slate-200/80 bg-white p-7 shadow-xs sm:p-10">
            <div className="mb-8 max-w-2xl">
              <h2 className="text-balance text-2xl font-bold tracking-tight text-slate-950 sm:text-[1.65rem]">{tl("platform.onePlatform")}</h2>
              <p className="mt-3 text-pretty text-sm leading-relaxed text-slate-600 sm:text-base">
                {tl("platform.onePlatformText")}
              </p>
            </div>
            <div className="grid grid-cols-1 gap-5 md:grid-cols-3 md:gap-6">
              {[
                { icon: Users, title: tl("profiles.influencers"), text: tl("profiles.influencersText") },
                { icon: Smartphone, title: tl("profiles.ugc"), text: tl("profiles.ugcText") },
                { icon: Tv, title: tl("profiles.actors"), text: tl("profiles.actorsText") },
              ].map((profile) => (
                <div key={profile.title} className="rounded-2xl border border-slate-100 bg-slate-50 p-5 sm:p-6">
                  <div className="mb-3 flex items-center gap-2.5 text-base font-bold text-purple-700">
                    <profile.icon size={18} className="shrink-0" />
                    <span>{profile.title}</span>
                  </div>
                  <p className="text-pretty text-sm leading-relaxed text-slate-600">{profile.text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="como-funciona" className={`border-t border-slate-100 bg-white ${sectionY}`}>
        <div className={sectionInner}>
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-12 lg:gap-16">
            <SectionIntro
              kicker={tl("how.kicker")}
              title={tl("how.title")}
              subtitle={tl("how.subtitle")}
              className="lg:sticky lg:top-28 lg:col-span-5 lg:self-start"
            />
            <div className="lg:col-span-7">
              <article className="mb-6 last:mb-0 lg:mb-0 lg:sticky lg:top-28 lg:pb-6">
                <div className="flex flex-col rounded-3xl border border-purple-100/80 bg-gradient-to-br from-purple-50/50 via-white to-slate-50 p-7 shadow-lg shadow-purple-950/5 sm:p-10">
                  <div className="mb-5 flex items-center gap-3.5">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-purple-600 text-white shadow-md shadow-purple-200">
                      <Calendar size={22} />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-xl font-bold tracking-tight text-slate-950">{tl("how.oneOff")}</h3>
                      <p className="mt-0.5 text-xs font-semibold text-purple-600">{tl("how.oneOffSub")}</p>
                    </div>
                  </div>
                  <p className="mb-6 text-pretty text-sm leading-relaxed text-slate-600">
                    {tl("how.oneOffText")}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {tList("how.tagsOne").map((tag) => (
                      <span key={tag} className="rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </article>
              <article className="lg:sticky lg:top-36">
                <div className="flex flex-col rounded-3xl border border-indigo-100/80 bg-gradient-to-br from-indigo-50/80 via-white to-slate-50 p-7 shadow-lg shadow-indigo-950/5 sm:p-10">
                  <div className="mb-5 flex items-center gap-3.5">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-md shadow-indigo-200">
                      <Layers size={22} />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-xl font-bold tracking-tight text-slate-950">{tl("how.recurring")}</h3>
                      <p className="mt-0.5 text-xs font-semibold text-indigo-600">{tl("how.recurringSub")}</p>
                    </div>
                  </div>
                  <p className="mb-6 text-pretty text-sm leading-relaxed text-slate-600">
                    {tl("how.recurringText")}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {tList("how.tagsRecurring").map((tag) => (
                      <span key={tag} className="rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </article>
            </div>
          </div>
        </div>
      </section>

      <section className={`border-t border-slate-100 bg-[#FAFAFC] ${sectionY}`}>
        <div className={sectionInner}>
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-12 lg:gap-16">
            <SectionIntro
              kicker={tl("impact.kicker")}
              title={tl("impact.title")}
              subtitle={tl("impact.subtitle")}
              className="lg:sticky lg:top-28 lg:col-span-5 lg:self-start"
            />
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-6 lg:col-span-7">
              {[
                { label: tl("impact.reduce"), title: tl("impact.costs"), text: tl("impact.costsText") },
                { label: tl("impact.increase"), title: tl("impact.content"), text: tl("impact.contentText") },
                { label: tl("impact.decrease"), title: tl("impact.risks"), text: tl("impact.risksText") },
                { label: tl("impact.expand"), title: tl("impact.results"), text: tl("impact.resultsText") },
              ].map((item, index) => (
                <motion.div
                  key={item.title}
                  initial={{ opacity: 0, y: 28 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-40px" }}
                  transition={{ duration: 0.5, delay: index * 0.08, ease: [0.22, 1, 0.36, 1] }}
                  className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs sm:p-7"
                >
                  <p className="mb-2 text-sm font-extrabold text-purple-600">{item.label}</p>
                  <h3 className="mb-3 text-2xl font-black tracking-tight text-slate-950">{item.title}</h3>
                  <p className="text-pretty text-sm leading-relaxed text-slate-600">{item.text}</p>
                </motion.div>
              ))}
            </div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
            className="mt-16 rounded-3xl border border-slate-200/80 bg-white p-7 shadow-xs sm:p-10"
          >
            <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
              {[
                { icon: Users, value: "+12.000", label: tl("impact.statCreators") },
                { icon: Video, value: "+35.000", label: tl("impact.statContents") },
                { icon: Award, value: "+3.000", label: tl("impact.statCampaigns") },
                { icon: Sparkles, value: "50+", label: tl("impact.statSegments") },
              ].map((stat) => (
                <div key={stat.label} className="flex items-center gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-purple-50 text-purple-600">
                    <stat.icon size={24} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">{stat.value}</p>
                    <p className="mt-0.5 text-xs font-medium leading-relaxed text-slate-500">{stat.label}</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          <p className="mt-5 text-center text-[11px] leading-relaxed text-slate-400">
            {tl("impact.footnote")}
          </p>
        </div>
      </section>

      <section className="border-t border-slate-100 bg-white py-20 md:py-24">
        <div className={`${sectionInner} text-center`}>
          <h2 className="text-balance text-2xl font-extrabold tracking-tight text-slate-950 sm:text-3xl">
            {tl("channels.title")}
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-pretty text-sm leading-relaxed text-slate-600 sm:text-base">
            {tl("channels.subtitle")}
          </p>
          <div className="mx-auto mt-10 flex max-w-4xl flex-wrap items-center justify-center gap-2.5 sm:gap-3">
            {tList("channels.items").map((channel) => (
              <span
                key={channel}
                className="cursor-default rounded-xl border border-slate-200/80 bg-slate-50 px-4 py-2.5 text-xs font-bold text-slate-800 shadow-2xs transition-all hover:border-purple-300 hover:text-purple-700 sm:px-5 sm:text-sm"
              >
                {channel}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="overflow-x-clip border-t border-slate-100 bg-[#FAFAFC] py-20 md:py-28">
        <div className={sectionInner}>
          <AudienceCards onCompany={() => setModal("company")} onCreator={() => openCreator()} />
        </div>
      </section>

      <section className="bg-white py-20 md:py-24">
        <div className={sectionInner}>
          <div className="relative flex flex-col items-center justify-between gap-8 overflow-hidden rounded-3xl border border-slate-800 bg-slate-950 p-8 text-white shadow-2xl sm:gap-10 sm:p-12 lg:flex-row lg:p-14">
            <motion.div
              aria-hidden
              style={{ y: orbOneY }}
              className="pointer-events-none absolute -right-20 -bottom-20 h-80 w-80 rounded-full bg-purple-600/30 blur-3xl"
            />
            <motion.div
              aria-hidden
              style={{ y: orbTwoY }}
              className="pointer-events-none absolute -top-20 -left-20 h-80 w-80 rounded-full bg-indigo-600/20 blur-3xl"
            />
            <div className="relative z-10 max-w-xl text-center lg:text-left">
              <h2 className="text-balance text-2xl font-extrabold tracking-tight sm:text-3xl lg:text-4xl">
                {tl("cta.title")}
              </h2>
              <p className="mt-4 text-pretty text-sm leading-relaxed text-slate-400 sm:text-base">
                {tl("cta.subtitle")}
              </p>
            </div>
            <div className="relative z-10 flex w-full flex-col items-stretch gap-3 sm:w-auto sm:flex-row sm:items-center">
              <button onClick={() => setModal("company")} className={`${btnPrimary} sm:w-auto`}>
                {tl("cta.company")} <ArrowRight size={16} />
              </button>
              <button onClick={() => openCreator()} className={btnOnDark}>
                {tl("cta.creator")} <ArrowRight size={16} />
              </button>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-100 bg-white py-16 md:py-20">
        <div className={sectionInner}>
          <div className="grid grid-cols-1 gap-10 border-b border-slate-100 pb-12 md:grid-cols-12 md:gap-12">
            <div className="flex flex-col items-center text-center md:col-span-5 md:items-start md:text-left">
              <div className="mb-5">
                <RocketzLogo variant="light" size="md" href="/" />
              </div>
              <p className="max-w-sm text-pretty text-sm leading-relaxed text-slate-500">
                {tl("footer.tagline")}
              </p>
            </div>

            <div className="flex flex-col gap-2.5 md:col-span-3">
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-900">{tl("footer.platform")}</h3>
              {[
                { id: "para-empresas", label: tl("nav.forCompanies") },
                { id: "para-criadores", label: tl("nav.forCreators") },
                { id: "como-funciona", label: tl("nav.howItWorks") },
                { id: "recursos", label: tl("nav.features") },
                { id: "marcas-parceiras", label: tl("nav.partnerBrands") },
              ].map((link) => (
                <button
                  key={link.id}
                  onClick={() => scrollTo(link.id)}
                  className="text-left text-sm leading-relaxed text-slate-600 hover:text-purple-600"
                >
                  {link.label}
                </button>
              ))}
            </div>

            <div className="flex flex-col md:col-span-4">
              <h3 className="mb-4 text-xs font-bold uppercase tracking-wider text-slate-900">
                {tl("footer.follow")}
              </h3>
              <div className="mb-6 flex items-center gap-3">
                {[
                  { href: "https://instagram.com", icon: Instagram, label: "Instagram" },
                  { href: "https://tiktok.com", icon: null, label: "TikTok" },
                  { href: "https://youtube.com", icon: Youtube, label: "YouTube" },
                  { href: "https://linkedin.com", icon: Linkedin, label: "LinkedIn" },
                ].map((social) => (
                  <a
                    key={social.label}
                    href={social.href}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={social.label}
                    className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200/80 bg-slate-50 text-slate-600 transition-colors hover:bg-purple-50 hover:text-purple-600"
                  >
                    {social.icon ? <social.icon size={17} /> : <span className="text-xs font-bold">Tk</span>}
                  </a>
                ))}
              </div>
              <div className="space-y-1.5">
                <p className="text-xs text-slate-400">{tl("footer.support")}</p>
                <a href="mailto:contato@rocketzmkt.com.br" className="text-sm font-semibold text-slate-700 hover:text-purple-600">
                  contato@rocketzmkt.com.br
                </a>
              </div>
            </div>
          </div>

          <div className="flex flex-col items-center justify-between gap-4 pt-8 text-xs text-slate-400 sm:flex-row">
            <p>{tl("footer.rights")}</p>
            <div className="flex items-center gap-6">
              <span>{tl("footer.terms")}</span>
              <span>{tl("footer.privacy")}</span>
              <span>{tl("footer.security")}</span>
            </div>
          </div>
        </div>
      </footer>

      <AnimatePresence>
        {modal !== "none" ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="app-modal-overlay fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/70 p-0 backdrop-blur-sm sm:p-4">
            <motion.div initial={{ y: 24, opacity: 0, scale: 0.95 }} animate={{ y: 0, opacity: 1, scale: 1 }} className="app-modal-panel relative my-0 max-h-[100dvh] w-full max-w-lg overflow-y-auto rounded-none border-0 bg-white p-5 shadow-2xl sm:my-8 sm:max-h-[90vh] sm:rounded-3xl sm:border sm:border-slate-200 sm:p-8">
              <button
                type="button"
                onClick={() => setModal("none")}
                className="absolute top-5 right-5 rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
              >
                <X size={20} />
              </button>

              {modal === "login" ? (
                <>
                  <h3 className="mb-4 text-2xl font-black text-slate-950">{ta("login")}</h3>
                  <form className="space-y-3" noValidate onSubmit={onLoginSubmit}>
                    <input type="email" placeholder={ta("email")} autoComplete="email" className={modalInput} value={login.email} onChange={(e) => setLogin({ ...login, email: e.target.value })} />
                    <PasswordField placeholder={ta("password")} autoComplete="current-password" inputClassName={modalInput} value={login.password} onChange={(e) => setLogin({ ...login, password: e.target.value })} />
                    <button type="button" onClick={onForgotPassword} className="text-left text-sm font-semibold text-purple-700 hover:text-purple-800">
                      {ta("forgotPassword")}
                    </button>
                    <button disabled={loading} className="w-full rounded-xl bg-purple-600 py-3 font-bold text-white">{loading ? ta("loggingIn") : ta("login")}</button>
                    <p className="text-center text-sm text-slate-500">
                      {ta("noAccount")} <button type="button" className="font-bold text-purple-700" onClick={() => openCreator()}>{ta("signUp")}</button>
                    </p>
                  </form>
                </>
              ) : null}

              {modal === "creator" ? (
                <>
                  <div className="mb-6 pr-8">
                    <span className="rounded-full border border-purple-100 bg-purple-50 px-2.5 py-1 text-[10px] font-black tracking-wider text-purple-600 uppercase">
                      {ta("castingOfficial")}
                    </span>
                    <h3 className="mt-2 text-2xl font-black text-slate-950">{ta("wantCreatorTitle")}</h3>
                    <p className="mt-1 text-xs text-slate-500">
                      {ta("creatorStepHint", { step: creatorStep })}
                    </p>
                    <div className="mt-4 flex gap-2">
                      <div className={`h-1.5 flex-1 rounded-full ${creatorStep >= 1 ? "bg-purple-600" : "bg-slate-100"}`} />
                      <div className={`h-1.5 flex-1 rounded-full ${creatorStep >= 2 ? "bg-purple-600" : "bg-slate-100"}`} />
                      <div className={`h-1.5 flex-1 rounded-full ${creatorStep >= 3 ? "bg-purple-600" : "bg-slate-100"}`} />
                    </div>
                  </div>
                  <form className="space-y-4" noValidate onSubmit={onCreatorSubmit}>
                    {creatorStep === 1 ? (
                      <>
                        <ModalField label={ta("fields.fullName")} required>
                          <input placeholder={ta("fields.fullNamePh")} autoComplete="name" className={modalInput} value={creator.full_name} onChange={(e) => setCreator({ ...creator, full_name: e.target.value })} />
                        </ModalField>
                        <ModalField label={ta("fields.artisticName")} required>
                          <input placeholder={ta("fields.artisticNamePh")} className={modalInput} value={creator.artistic_name} onChange={(e) => setCreator({ ...creator, artistic_name: e.target.value })} />
                        </ModalField>
                        <ModalField label={ta("fields.instagram")} required>
                          <div className="relative">
                            <span className="absolute top-1/2 left-3.5 -translate-y-1/2 text-sm font-bold text-slate-400">@</span>
                            <input
                              placeholder={ta("fields.instagramPh")}
                              className={`${modalInput} pl-8`}
                              value={instagramHandle(creator.instagram)}
                              onChange={(e) => setCreator({ ...creator, instagram: formatInstagram(e.target.value) })}
                            />
                          </div>
                        </ModalField>
                        <ModalField label={ta("fields.style")} required>
                          <Select2Field
                            theme="light"
                            placeholder={ta("fields.stylePh")}
                            searchable
                            value={creator.category}
                            options={creatorCategoryOptions}
                            onChange={(value) => setCreator({ ...creator, category: value })}
                          />
                        </ModalField>
                        <button type="button" onClick={() => goCreatorStep(2)} className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-purple-600 py-3 text-sm font-bold text-white hover:bg-purple-700">
                          {tc("next")} <ArrowRight size={16} />
                        </button>
                      </>
                    ) : creatorStep === 2 ? (
                      <>
                        <ModalField label={ta("fields.whatsapp")} required>
                          <input placeholder={ta("fields.whatsappPh")} inputMode="tel" autoComplete="tel" className={modalInput} value={creator.whatsapp} onChange={(e) => setCreator({ ...creator, whatsapp: formatWhatsApp(e.target.value) })} />
                        </ModalField>
                        <div className="grid grid-cols-3 gap-3">
                          <div className="col-span-2">
                            <ModalField label={ta("fields.city")} required>
                              <input placeholder={ta("fields.cityPh")} autoComplete="address-level2" className={modalInput} value={creator.city} onChange={(e) => setCreator({ ...creator, city: e.target.value })} />
                            </ModalField>
                          </div>
                          <ModalField label={ta("fields.uf")} required>
                            <Select2Field
                              theme="light"
                              placeholder={ta("fields.uf")}
                              value={creator.state}
                              options={UF_OPTIONS}
                              onChange={(value) => setCreator({ ...creator, state: value })}
                            />
                          </ModalField>
                        </div>
                        <div className="flex items-center gap-3 pt-2">
                          <button type="button" onClick={() => setCreatorStep(1)} className="w-1/3 rounded-xl bg-slate-100 py-3 text-sm font-bold text-slate-700 hover:bg-slate-200">{tc("back")}</button>
                          <button type="button" onClick={() => goCreatorStep(3)} className="flex w-2/3 items-center justify-center gap-2 rounded-xl bg-purple-600 py-3 text-sm font-bold text-white hover:bg-purple-700">
                            {tc("next")} <ArrowRight size={16} />
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <ModalField label={ta("fields.bestEmail")} required>
                          <input type="email" placeholder={ta("fields.emailPh")} autoComplete="email" className={modalInput} value={creator.email} onChange={(e) => setCreator({ ...creator, email: e.target.value })} />
                        </ModalField>
                        <ModalField label={ta("fields.createPassword")} required>
                          <PasswordField placeholder={ta("minChars")} autoComplete="new-password" inputClassName={modalInput} value={creator.password} onChange={(e) => setCreator({ ...creator, password: e.target.value })} />
                        </ModalField>
                        <ModalField label={ta("fields.confirmYourPassword")} required>
                          <PasswordField placeholder={ta("repeatPassword")} autoComplete="new-password" inputClassName={modalInput} value={creator.password_confirmation} onChange={(e) => setCreator({ ...creator, password_confirmation: e.target.value })} />
                        </ModalField>
                        <label className="flex cursor-pointer items-start gap-2.5 pt-2">
                          <input type="checkbox" checked={creator.lgpd_accepted} onChange={(e) => setCreator({ ...creator, lgpd_accepted: e.target.checked })} className="mt-1 rounded text-purple-600" />
                          <span className="text-[11px] leading-snug text-slate-600">
                            {ta("lgpdCreator")}
                          </span>
                        </label>
                        <div className="flex items-center gap-3 pt-2">
                          <button type="button" onClick={() => setCreatorStep(2)} className="w-1/3 rounded-xl bg-slate-100 py-3 text-sm font-bold text-slate-700 hover:bg-slate-200">{tc("back")}</button>
                          <button disabled={loading} className="w-2/3 rounded-xl bg-purple-600 py-3 text-sm font-bold text-white shadow-md shadow-purple-200 hover:bg-purple-700 disabled:opacity-50">
                            {loading ? ta("creating") : ta("finishSignup")}
                          </button>
                        </div>
                      </>
                    )}
                  </form>
                </>
              ) : null}

              {modal === "company" ? (
                <>
                  <div className="mb-6 pr-8">
                    <span className="rounded-full border border-purple-100 bg-purple-50 px-2.5 py-1 text-[10px] font-black tracking-wider text-purple-600 uppercase">
                      {ta("companyBadge")}
                    </span>
                    <h3 className="mt-2 text-2xl font-black text-slate-950">{ta("companyTitle")}</h3>
                    <p className="mt-1 text-xs text-slate-500">
                      {ta("companyHint")}
                    </p>
                  </div>
                  <form className="space-y-4" noValidate onSubmit={onCompanySubmit}>
                    <ModalField label={ta("fields.companyName")} required>
                      <input placeholder={ta("fields.companyNamePh")} className={modalInput} value={company.name} onChange={(e) => setCompany({ ...company, name: e.target.value })} />
                    </ModalField>
                    <ModalField label={ta("fields.responsible")} required>
                      <input placeholder={ta("fields.responsiblePh")} autoComplete="name" className={modalInput} value={company.responsible_name} onChange={(e) => setCompany({ ...company, responsible_name: e.target.value })} />
                    </ModalField>
                    <ModalField label={ta("fields.corporateEmail")} required>
                      <input type="email" placeholder={ta("email")} autoComplete="email" className={modalInput} value={company.email} onChange={(e) => setCompany({ ...company, email: e.target.value })} />
                    </ModalField>
                    <ModalField label={ta("fields.whatsapp")} required>
                      <input placeholder={ta("fields.whatsappPh")} inputMode="tel" autoComplete="tel" className={modalInput} value={company.whatsapp} onChange={(e) => setCompany({ ...company, whatsapp: formatWhatsApp(e.target.value) })} />
                    </ModalField>
                    <ModalField label={ta("fields.segment")}>
                      <input placeholder={ta("fields.segment")} className={modalInput} value={company.segment} onChange={(e) => setCompany({ ...company, segment: e.target.value })} />
                    </ModalField>
                    <ModalField label={ta("fields.createPassword")} required>
                      <PasswordField placeholder={ta("minChars")} autoComplete="new-password" inputClassName={modalInput} value={company.password} onChange={(e) => setCompany({ ...company, password: e.target.value })} />
                    </ModalField>
                    <ModalField label={ta("fields.confirmYourPassword")} required>
                      <PasswordField placeholder={ta("repeatPassword")} autoComplete="new-password" inputClassName={modalInput} value={company.password_confirmation} onChange={(e) => setCompany({ ...company, password_confirmation: e.target.value })} />
                    </ModalField>
                    <label className="flex cursor-pointer items-start gap-2.5">
                      <input type="checkbox" checked={company.lgpd_accepted} onChange={(e) => setCompany({ ...company, lgpd_accepted: e.target.checked })} className="mt-1 rounded text-purple-600" />
                      <span className="text-[11px] leading-snug text-slate-600">{ta("lgpdShort")}</span>
                    </label>
                    <button disabled={loading} className="w-full rounded-xl bg-purple-600 py-3 text-sm font-bold text-white hover:bg-purple-700 disabled:opacity-50">{loading ? ta("sending") : ta("registerCompany")}</button>
                  </form>
                </>
              ) : null}
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
