import type { MetadataRoute } from "next";

// Convención especial de Next.js: este archivo se sirve solo en
// /manifest.webmanifest, con el <link rel="manifest"> ya agregado
// automáticamente al <head> — no hace falta cablearlo a mano en
// layout.tsx. Colores acordes a la paleta "Betty": fondo de la app
// (blanco cálido) y ciruela intenso como color de marca/tema.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Farmasi Bella — Gestión",
    short_name: "Farmasi Bella",
    description: "Catálogo, inventario, pedidos, ventas, préstamos y finanzas del negocio Farmasi.",
    start_url: "/",
    display: "standalone",
    background_color: "#fbf7f4",
    theme_color: "#733865",
    lang: "es",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
