import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { AppNav } from "@/components/app-nav";
import { LedgerView } from "@/components/ledger-view";

export default function SummaryPage() { return <main className="app-shell"><header className="app-header"><div><p className="eyebrow">September 2026</p><h1>Overview</h1></div><Link className="button-primary" href="/expenses/new">Add expense <ArrowRight size={17} /></Link></header><LedgerView summary /><section className="insight-card"><p className="eyebrow">Private by design</p><h2>Receipts are interpreted on your device.</h2><p>Only the transaction you approve is written to Supabase.</p></section><AppNav /></main>; }
