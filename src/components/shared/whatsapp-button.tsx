import { whatsappLink } from "@/lib/utils/whatsapp";
import { cn } from "@/lib/utils/cn";

// Abre un chat directo de WhatsApp con la clienta (click-to-chat de
// wa.me), sin mensaje precargado. Si no hay teléfono válido, no renderiza
// nada — el "Sin teléfono" que ya se muestra al lado alcanza para
// comunicar que no hay número, así que un botón deshabilitado ahí sería
// redundante.
export function WhatsAppButton({
  phone,
  className,
}: {
  phone: string | null | undefined;
  className?: string;
}) {
  const href = whatsappLink(phone);

  if (!href) return null;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Escribir por WhatsApp"
      title="Escribir por WhatsApp"
      onClick={(e) => e.stopPropagation()}
      className={cn(
        "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[#25D366] transition-colors hover:bg-[#25D366]/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold",
        className,
      )}
    >
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4" aria-hidden="true">
        <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.81.48 3.53 1.4 5.03L2 22l5.24-1.37a9.9 9.9 0 0 0 4.8 1.23h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.86 9.86 0 0 0 12.04 2Zm5.8 14.16c-.24.68-1.4 1.32-1.93 1.4-.5.08-1.11.11-1.79-.11-.41-.13-.94-.31-1.62-.6-2.86-1.24-4.72-4.13-4.87-4.32-.14-.19-1.17-1.55-1.17-2.97 0-1.41.74-2.1 1-2.39.26-.28.57-.36.76-.36.19 0 .38 0 .55.01.18.01.41-.07.64.49.24.58.81 2 .88 2.15.07.15.12.32.02.51-.09.19-.14.31-.28.48-.14.17-.29.37-.42.5-.14.14-.28.29-.12.57.16.28.71 1.17 1.52 1.9 1.05.94 1.93 1.23 2.21 1.37.28.14.44.12.6-.07.17-.19.71-.83.9-1.11.19-.28.38-.24.64-.14.26.09 1.66.78 1.94.93.28.14.47.21.54.33.07.12.07.68-.17 1.36Z" />
      </svg>
    </a>
  );
}
