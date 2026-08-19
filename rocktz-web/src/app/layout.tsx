import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Rocketz Creators",
  description:
    "Plataforma para gestão de casting de criadores, campanhas publicitárias e trabalhos recorrentes.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen font-sans antialiased">{children}</body>
    </html>
  );
}
