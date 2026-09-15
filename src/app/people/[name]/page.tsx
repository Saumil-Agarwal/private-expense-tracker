import Link from "next/link";

import { AppNav } from "@/components/app-nav";
import { PersonExpenses } from "@/components/person-expenses";

type Props = { params: Promise<{ name: string }> };

export default async function PersonExpensesPage({ params }: Props) {
  const { name } = await params;
  const person = decodeURIComponent(name);

  return <main className="app-shell">
    <header className="app-header compact-header"><div><p className="eyebrow">Person</p><h1>{person}</h1></div><Link className="button-quiet" href="/summary">Back to overview</Link></header>
    <PersonExpenses person={person} />
    <AppNav />
  </main>;
}
