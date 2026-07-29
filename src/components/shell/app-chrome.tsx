"use client";

import { usePathname } from "next/navigation";
import { BottomNav } from "./bottom-nav";
import { TopBar } from "./top-bar";

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
    <>
      {/* La barra inferior es fija: se reserva su alto para que nunca tape el
          último elemento de la página. */}
      <div className="mx-auto w-full max-w-2xl flex-1 px-5 pb-24">
        <TopBar />
        {children}
      </div>
      <BottomNav />
    </>
  );
}
