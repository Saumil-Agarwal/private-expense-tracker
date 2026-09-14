import Link from "next/link";

import { AppNav } from "@/components/app-nav";
import { LedgerView } from "@/components/ledger-view";

export default function TrashPage() {
  return <main className="app-shell"><header className="app-header"><div><p className="eyebrow">Expenses</p><h1>Trash</h1></div><Link className="button-quiet" href="/expenses">Back to Expenses</Link></header><LedgerView trash /><AppNav /></main>;
}
