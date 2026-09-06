"use client";

import { calculateAllocations } from "@/domain/splits";
import { formatInr } from "@/domain/expense";

type Person = { id: string; name: string };
type SplitValue = { status: "confirmed" | "needs_review"; allocations: Array<{ personId: string; amountPaise: number }> };

export function SplitEditor({ amountPaise, people, onChange }: { amountPaise: number; people: Person[]; onChange: (value: SplitValue) => void }) {
  function personal() {
    const result = calculateAllocations({ mode: "personal", totalPaise: amountPaise, ownerId: people[0]?.id ?? "me" });
    onChange({ status: "confirmed", allocations: result.allocations });
  }
  function equal() {
    const result = calculateAllocations({ mode: "equal", totalPaise: amountPaise, personIds: people.map((person) => person.id) });
    onChange({ status: "confirmed", allocations: result.allocations });
  }
  return (
    <section className="form-section">
      <div className="section-heading"><div><span className="step">3</span><h2>Who shares it?</h2></div><span className="amount-caption">{formatInr(amountPaise)}</span></div>
      <div className="choice-grid">
        <button type="button" onClick={personal}>Only me</button>
        <button type="button" onClick={equal} disabled={people.length < 2}>Split equally</button>
        <button type="button" onClick={() => onChange({ status: "needs_review", allocations: [] })}>Decide later</button>
      </div>
    </section>
  );
}
