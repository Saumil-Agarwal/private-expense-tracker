import Link from "next/link";

import { AppNav } from "@/components/app-nav";
import { ExpenseDetail } from "@/components/expense-detail";

export default async function ExpenseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <main className="app-shell"><header className="app-header compact-header"><div><p className="eyebrow">Expense details</p><h1>Expense</h1></div><Link className="button-quiet" href="/expenses">Back</Link></header><ExpenseDetail id={id} /><AppNav /></main>;
}
