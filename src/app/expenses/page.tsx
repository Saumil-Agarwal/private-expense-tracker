import { AppNav } from "@/components/app-nav";
import { LedgerView } from "@/components/ledger-view";

export default function ExpensesPage() { return <main className="app-shell"><header className="app-header"><div><p className="eyebrow">Ledgerly</p><h1>Expenses</h1></div></header><LedgerView /><AppNav /></main>; }
