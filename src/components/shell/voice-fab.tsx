"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useVoice } from "@/components/voice/use-voice";
import { useVoiceRegistry } from "@/components/voice/registry";
import { matchOption } from "@/lib/match-option";
import { ORDENES_NAVEGACION, parentOf } from "@/lib/navigation";
import { QUICK_FLOWS } from "@/lib/quick/catalog";

/**
 * El micrófono de toda la aplicación. Uno, y siempre en el mismo sitio.
 *
 * Flota sobre el contenido, arriba a la derecha de la barra inferior: la zona
 * que el pulgar alcanza sin recolocar el teléfono. Que no se mueva nunca es el
 * punto entero — mantener pulsado y hablar tiene que ser un reflejo, y un
 * reflejo no sobrevive a un botón que cambia de sitio según la pantalla.
 *
 * Lo que cambia es el SIGNIFICADO, no el sitio:
 *
 *   en Hoy          → «gasto», «gimnasio» y entras al flujo
 *   eligiendo opción → «pecho», «huevo» y la eliges
 *   pidiendo número  → «setenta kilos» y lo escribe
 *   en cualquiera    → «atrás», «inicio» siguen funcionando
 *
 * El orden importa: primero la pantalla, después la navegación. Si fuera al
 * revés, decir «comida» dentro del flujo de comida te sacaría de él.
 */
export function VoiceFab() {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const registro = useVoiceRegistry();
  const activo = registro?.activo ?? null;

  const destinos = [
    ...ORDENES_NAVEGACION,
    { value: "/gym", label: "gimnasio pesas entrenar entrenamiento" },
    { value: "/food", label: "comida comer desayuno cena almuerzo" },
    { value: "/agua", label: "agua tomar beber vaso hidratacion" },
    ...QUICK_FLOWS.map((f) => ({ value: `/registrar/${f.id}`, label: f.label })),
  ];

  const { soportado, escuchando, oido, error, gestos } = useVoice({
    onTranscript: (texto) => {
      // 1. Lo que haya pedido la pantalla.
      if (activo && activo.handler(texto) !== false) return true;

      // 2. Navegación, que vale en todas partes. Es lo que permite salir de
      //    un flujo sin buscar el botón de atrás.
      const destino = matchOption(texto, destinos);
      if (!destino) return false;
      router.push(
        destino.value === "__atras" ? (parentOf(pathname, search) ?? "/") : destino.value,
      );
      return true;
    },
  });

  // Un botón que no funciona es peor que un botón que no está.
  if (!soportado) return null;

  const pista = activo?.hint ?? "Dime adónde";

  const hablando = escuchando || Boolean(oido) || Boolean(error);

  return (
    // La pista va AL LADO del botón, no encima: apilada crecía hacia arriba y
    // tapaba la última línea de la página. Al lado, el bloque mide lo que mide
    // el botón, y el `pb` del contenido basta para que nada quede oculto.
    <div
      className="pointer-events-none fixed inset-x-0 bottom-0 z-30 flex items-center justify-end gap-2 px-4"
      style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 4.5rem)" }}
    >
      {hablando ? (
        <p
          role="status"
          aria-live="polite"
          className={`pointer-events-none max-w-[60%] truncate rounded-xl px-3 py-2 text-sm shadow-lg ${
            error ? "bg-accent text-white" : "bg-foreground text-background"
          }`}
        >
          {error ?? (oido ? `«${oido}»` : "Escuchando…")}
        </p>
      ) : (
        <span className="pointer-events-none max-w-[60%] truncate rounded-full border border-line bg-surface/95 px-2.5 py-1 text-[11px] font-medium text-muted shadow-sm backdrop-blur">
          {pista}
        </span>
      )}

      <button
        type="button"
        {...gestos}
        aria-label={`Mantener pulsado para hablar. ${pista}`}
        className={`pointer-events-auto flex size-16 shrink-0 touch-none items-center justify-center rounded-full text-2xl shadow-lg transition select-none ${
          escuchando
            ? "scale-110 bg-accent ring-4 ring-accent/30"
            : "bg-accent/90 active:scale-95"
        }`}
      >
        <span className={escuchando ? "animate-pulse" : ""}>🎙️</span>
      </button>
    </div>
  );
}
