import { ExpenseScreen } from "@/components/expenses/expense-screen";
import { expensesForDay, recentMerchants } from "@/lib/expenses/queries";

export const dynamic = "force-dynamic";

export default async function GastoPage() {
  const [dia, lugares] = await Promise.all([
    expensesForDay(new Date()),
    recentMerchants(),
  ]);

  return (
    <main className="space-y-5 py-6">
      <h1 className="text-2xl font-semibold tracking-tight">Gasto</h1>
      <ExpenseScreen
        total={dia.total}
        lugares={lugares}
        gastos={dia.gastos.map((g) => ({
          id: g.id,
          amount: g.amount,
          category: g.category,
          merchant: g.merchant,
          at: g.at.toISOString(),
        }))}
      />
    </main>
  );
}
