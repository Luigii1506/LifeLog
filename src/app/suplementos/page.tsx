import { SupplementGrid } from "@/components/supplements/supplement-grid";
import { supplementsForDay } from "@/lib/supplements/queries";

export const dynamic = "force-dynamic";

export default async function SuplementosPage() {
  const dia = await supplementsForDay(new Date());

  return (
    <main className="py-6">
      <h1 className="mb-5 text-2xl font-semibold tracking-tight">Suplementos</h1>
      <SupplementGrid
        items={dia.map((d) => ({
          id: d.supplement.id,
          name: d.supplement.name,
          icon: d.supplement.icon,
          dosing: d.supplement.dosing,
          count: d.count,
          total: d.total,
          summary: d.summary,
          entries: d.entries.map((e) => ({
            id: e.id,
            dose: e.dose,
            at: e.at.toISOString(),
          })),
        }))}
      />
    </main>
  );
}
