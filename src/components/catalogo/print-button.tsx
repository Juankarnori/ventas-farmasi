"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

// Dispara el diálogo de impresión nativo del navegador — desde ahí la
// persona elige "Guardar como PDF". No hay generación de PDF del lado
// del servidor (nada de navegador headless que mantener en Vercel):
// esta página ya viene con su propio @media print, así que imprimir tal
// cual da un resultado limpio.
export function PrintButton() {
  return (
    <Button type="button" onClick={() => window.print()} className="print:hidden">
      <Printer className="h-4 w-4" /> Imprimir / Guardar como PDF
    </Button>
  );
}
