import { Bloque, RejillaTarjetas } from "@/components/shell/skeleton";

export default function Cargando() {
  return (
    <main className="py-4">
      <Bloque className="h-1" />
      <Bloque className="mt-6 h-7 w-56" />
      <div className="mt-6">
        <RejillaTarjetas filas={4} columnas={2} />
      </div>
    </main>
  );
}
