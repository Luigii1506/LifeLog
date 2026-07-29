import { notFound } from "next/navigation";
import { QuickFlowRunner } from "@/components/quick/quick-flow-runner";
import { buildQuickFlow, type QuickFlowId } from "@/lib/quick/flows";

export const dynamic = "force-dynamic";

export default async function RegistrarPage({
  params,
}: {
  params: Promise<{ flujo: string }>;
}) {
  const { flujo } = await params;
  const spec = await buildQuickFlow(flujo as QuickFlowId);
  if (!spec) notFound();

  return (
    <main className="py-4">

      <QuickFlowRunner
        flowId={spec.id}
        icon={spec.icon}
        done={spec.done}
        steps={spec.steps}
      />
    </main>
  );
}
