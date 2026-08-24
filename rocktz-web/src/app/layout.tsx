import type { Metadata, Viewport } from "next";
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
        <script
          id="rocktz-locale"
          dangerouslySetInnerHTML={{ __html: LOCALE_BOOTSTRAP_SCRIPT }}
        />
        <I18nProvider>{children}</I18nProvider>
      </body>
    </html>
  );
}
