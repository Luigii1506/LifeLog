"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Barra inferior fija.
 *
 * Abajo y no arriba porque es la única zona que el pulgar alcanza sin
 * recolocar el teléfono, y esta app se usa de pie, con una mano, con prisa.
 *
 * Siempre visible: en un bucle de registro no debe haber ninguna pantalla sin
 * salida.
 *
 * El micrófono ya no vive aquí. Compartía fila con las pestañas, así que era
 * pequeño y estaba pegado a tres enlaces que no querías tocar mientras hablas.
 * Ahora es un botón flotante propio (`VoiceFab`), más grande y sin vecinos.
 */
export function BottomNav() {
  const pathname = usePathname();

  const tabs = [
    { href: "/", label: "Hoy", icon: "☀️" },
    { href: "/gym", label: "Gimnasio", icon: "🏋️" },
    { href: "/food", label: "Comida", icon: "🍽️" },
  ];

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface/95 backdrop-blur"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      aria-label="Navegación principal"
    >
      <div className="mx-auto flex w-full max-w-2xl items-stretch">
        {tabs.map((tab) => {
          const activo =
            tab.href === "/" ? pathname === "/" : pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={activo ? "page" : undefined}
              className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 transition ${
                activo ? "text-accent" : "text-muted"
              }`}
            >
              <span className="text-xl leading-none">{tab.icon}</span>
              <span className="text-[11px] font-medium">{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
