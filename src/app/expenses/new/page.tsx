import { AppNav } from "@/components/app-nav";
import { ExpenseEntry } from "@/components/expense-entry";

export default async function NewExpensePage({ searchParams }: { searchParams: Promise<{ text?: string }> }) {
  const params = await searchParams;
  return <main className="app-shell"><header className="app-header"><div><p className="eyebrow">Ledgerly</p><h1>Add expense</h1></div><span className="local-badge">Processed on this device</span></header><ExpenseEntry initialText={params.text ?? ""} /><AppNav /></main>;
}
