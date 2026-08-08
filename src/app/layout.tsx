import type { Metadata, Viewport } from "next";
import { fraunces, manrope, spaceGrotesk } from "@/fonts";
import { ServiceWorkerRegister } from "@/components/shared/service-worker-register";
import "./globals.css";

export const metadata: Metadata = {
  title: "Farmasi Bella — Gestión",
  description: "Catálogo, inventario, pedidos, ventas, préstamos y finanzas del negocio Farmasi.",
  // iOS no lee bien el manifest para "Agregar a inicio" — necesita estos
  // metadatos propios para instalar en pantalla completa con el nombre e
  // ícono correctos (apple-icon.png ya se sirve solo, ver ese archivo).
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Farmasi Bella",
  },
};

// Color de tema acorde a la paleta "Betty" (ciruela intenso) — pinta la
// barra del navegador/status bar cuando la app corre instalada.
export const viewport: Viewport = {
  themeColor: "#733865",
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
      <body className="min-h-full flex flex-col font-sans">
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
