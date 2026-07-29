import { Bloque, RejillaTarjetas } from "@/components/shell/skeleton";

export default function Cargando() {
  return (
    <main className="py-4">
      <Bloque className="h-6 w-52" />
      <div className="mt-4">
        <RejillaTarjetas filas={4} columnas={2} />
      </div>
    </main>
  );
}
