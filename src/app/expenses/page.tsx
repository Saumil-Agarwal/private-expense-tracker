import { AppNav } from "@/components/app-nav";
import { LedgerView } from "@/components/ledger-view";
import Link from "next/link";

export default function ExpensesPage() { return <main className="app-shell"><header className="app-header"><div><p className="eyebrow">Ledgerly</p><h1>Expenses</h1></div><Link className="button-quiet" href="/expenses/trash">View Trash</Link></header><LedgerView /><AppNav /></main>; }
