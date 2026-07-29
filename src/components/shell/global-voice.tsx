"use client";

import { useRouter, usePathname } from "next/navigation";
import { VoiceMic } from "@/components/guided/voice-mic";
import { matchOption } from "@/lib/match-option";
import { ORDENES_NAVEGACION, parentOf } from "@/lib/navigation";
import { QUICK_FLOWS } from "@/lib/quick/catalog";

/**
 * Micrófono global: navega y lanza flujos desde cualquier pantalla.
 *
 * Las órdenes de navegación («inicio», «atrás») y los destinos de registro
 * («gasto», «gimnasio») están en la MISMA lista a propósito: quien habla no
 * distingue entre navegar y registrar, y no debería tener que hacerlo.
 */
export function GlobalVoice() {
  const router = useRouter();
  const pathname = usePathname();

  const destinos = [
    ...ORDENES_NAVEGACION,
    { value: "/gym", label: "gimnasio pesas entrenar entrenamiento" },
    { value: "/food", label: "comida comer desayuno cena almuerzo" },
    ...QUICK_FLOWS.map((f) => ({ value: `/registrar/${f.id}`, label: f.label })),
  ];

  return (
    <VoiceMic
      onTranscript={(texto) => {
        const destino = matchOption(texto, destinos);
        if (!destino) return false;
        router.push(
          destino.value === "__atras" ? (parentOf(pathname) ?? "/") : destino.value,
        );
        return true;
      }}
    />
  );
}
