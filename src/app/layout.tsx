import type { Metadata } from "next";
import { fraunces, manrope, spaceGrotesk } from "@/fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: "Farmasi Bella — Gestión",
  description: "Catálogo, inventario, pedidos, ventas, préstamos y finanzas del negocio Farmasi.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${fraunces.variable} ${manrope.variable} ${spaceGrotesk.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
