"use client";

import { useEffect } from "react";

// Registra el Service Worker (public/sw.js) apenas carga la app — es lo
// que hace falta, junto con el manifest, para que el navegador ofrezca
// "Instalar app"/"Agregar a inicio". No renderiza nada.
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    navigator.serviceWorker.register("/sw.js").catch(() => {
      // No hay nada útil que mostrarle a la usuaria acá — la app sigue
      // funcionando igual sin el SW, solo no queda instalable/con cache.
    });
  }, []);

  return null;
}
