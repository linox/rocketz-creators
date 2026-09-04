import type { Metadata, Viewport } from "next";
import { I18nProvider } from "@/i18n/I18nProvider";
import { LOCALE_BOOTSTRAP_SCRIPT } from "@/i18n/locales";
import { APP_TITLE } from "@/lib/brand";
import "./globals.css";

export const metadata: Metadata = {
  title: APP_TITLE,
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
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#8A3FFC",
};

const BLOCK_PINCH_ZOOM_SCRIPT = `
document.addEventListener("gesturestart", function (event) { event.preventDefault(); });
document.addEventListener("gesturechange", function (event) { event.preventDefault(); });
document.addEventListener("gestureend", function (event) { event.preventDefault(); });
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className="scroll-smooth" suppressHydrationWarning>
      <body className="min-h-screen font-sans antialiased">
        <script
          id="rocktz-locale"
          dangerouslySetInnerHTML={{ __html: LOCALE_BOOTSTRAP_SCRIPT }}
        />
        <script
          id="rocktz-block-pinch-zoom"
          dangerouslySetInnerHTML={{ __html: BLOCK_PINCH_ZOOM_SCRIPT }}
        />
        <I18nProvider>{children}</I18nProvider>
      </body>
    </html>
  );
}
