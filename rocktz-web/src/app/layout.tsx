import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { I18nProvider } from "@/i18n/I18nProvider";
import { LOCALE_BOOTSTRAP_SCRIPT } from "@/i18n/locales";
import "./globals.css";

export const metadata: Metadata = {
  title: "Rocketz Creators",
  description:
    "Plataforma para gestão de casting de criadores, campanhas publicitárias e trabalhos recorrentes.",
  formatDetection: {
    telephone: false,
    email: false,
    address: false,
    date: false,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#8A3FFC",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className="scroll-smooth" suppressHydrationWarning>
      <body className="min-h-screen font-sans antialiased">
        <Script id="rocktz-locale" strategy="beforeInteractive">
          {LOCALE_BOOTSTRAP_SCRIPT}
        </Script>
        <I18nProvider>{children}</I18nProvider>
      </body>
    </html>
  );
}
