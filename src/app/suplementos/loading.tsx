import { Bloque, RejillaTarjetas } from "@/components/shell/skeleton";

export default function Cargando() {
  return (
    <main className="py-6">
      <Bloque className="mb-5 h-8 w-40" />
      <RejillaTarjetas filas={2} columnas={2} />
    </main>
  );
}
