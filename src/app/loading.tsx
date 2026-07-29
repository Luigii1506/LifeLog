import { Bloque, RejillaTarjetas } from "@/components/shell/skeleton";

export default function Cargando() {
  return (
    <main className="py-6">
      <Bloque className="h-4 w-28" />
      <Bloque className="mt-2 h-7 w-52" />
      <Bloque className="mt-7 h-6 w-56" />
      <Bloque className="mt-3 h-14" />
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Bloque className="h-24" />
        <Bloque className="h-24" />
      </div>
      <div className="mt-2">
        <RejillaTarjetas filas={3} columnas={3} />
      </div>
    </main>
  );
}
