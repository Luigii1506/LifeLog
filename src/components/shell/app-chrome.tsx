"use client";

import { Suspense } from "react";
import { usePathname } from "next/navigation";
import { VoiceProvider } from "@/components/voice/registry";
import { StatusProvider } from "./status-slot";
import { SwipeSections } from "./swipe-sections";
import { BottomNav } from "./bottom-nav";
import { TopBar } from "./top-bar";
import { VoiceFab } from "./voice-fab";

/**
 * Envoltorio de la aplicación.
 *
 * El login queda fuera del marco a propósito: sin sesión no hay adónde
 * navegar, y una barra con pestañas que no llevan a ningún sitio es peor que
 * no tener barra.
 */
export function AppChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname.startsWith("/login")) return <>{children}</>;

  return (
    // El proveedor envuelve TODO, no solo el botón: las pantallas de dentro
    // son las que declaran qué hace la voz, y sin un ancestro común no habría
    // dónde registrarlo.
    <VoiceProvider>
      <StatusProvider>
        {/* La barra inferior y el botón de voz son fijos: se reserva su alto
          para que nunca tapen el último elemento de la página. 9rem cubre la
          barra (4rem) más el botón flotante (4rem) y su holgura. */}
        <SwipeSections>
          <div className="mx-auto w-full max-w-2xl flex-1 px-5 pb-36">
            {/* La barra y el botón leen los parámetros de la URL —ahí vive la
            profundidad del gimnasio— y `useSearchParams` obliga a un límite de
            Suspense: al prerenderizar una página estática esos parámetros aún
            no existen. Sin esto el build falla en `/_not-found`.
            El respaldo es vacío a propósito: son adornos del marco, y un
            esqueleto parpadeando donde va el botón de atrás molesta más que su
            ausencia durante un instante. */}
            <Suspense fallback={null}>
              <TopBar />
            </Suspense>
            {children}
          </div>
        </SwipeSections>
        <BottomNav />
        <Suspense fallback={null}>
          <VoiceFab />
        </Suspense>
      </StatusProvider>
    </VoiceProvider>
  );
}
