import { Bloque, RejillaTarjetas } from "@/components/shell/skeleton";

export default function Cargando() {
  return (
    <main className="space-y-5 py-6">
      <Bloque className="h-8 w-24" />
      <Bloque className="h-28 rounded-2xl" />
      <RejillaTarjetas filas={4} columnas={3} />
    </main>
  );
}
