import { WaterTracker } from "@/components/water/water-tracker";
import {
  EXCELENTE_ML,
  META_ML,
  vesselPresets,
  waterForDay,
} from "@/lib/water/queries";

export const dynamic = "force-dynamic";

export default async function AguaPage() {
  const now = new Date();
  const [dia, presets] = await Promise.all([waterForDay(now), vesselPresets()]);

  return (
    <main className="py-6">
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">Agua</h1>
      <WaterTracker
        totalMl={dia.totalMl}
        goalMl={META_ML}
        excellentMl={EXCELENTE_ML}
        presets={presets}
        entries={dia.entries.map((e) => ({
          id: e.id,
          ml: e.ml,
          at: e.at.toISOString(),
          vessel: e.vessel,
        }))}
      />
    </main>
  );
}
