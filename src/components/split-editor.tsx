"use client";

import { useState } from "react";
import { calculateAllocations } from "@/domain/splits";
import { formatInr, rupeesToPaise } from "@/domain/expense";

type Person = { id: string; name: string };
type SplitValue = { status: "confirmed" | "needs_review"; allocations: Array<{ personId: string; amountPaise: number }> };

export function SplitEditor({ amountPaise, people, onChange }: { amountPaise: number; people: Person[]; onChange: (value: SplitValue) => void }) {
  const [participants, setParticipants] = useState(people);
  const [newName, setNewName] = useState("");
  const [custom, setCustom] = useState(false);
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  function personal() {
    setCustom(false);
    const result = calculateAllocations({ mode: "personal", totalPaise: amountPaise, ownerId: participants[0]?.id ?? "me" });
    onChange({ status: "confirmed", allocations: result.allocations });
  }
  function equal() {
    setCustom(false);
    const result = calculateAllocations({ mode: "equal", totalPaise: amountPaise, personIds: participants.map((person) => person.id) });
    onChange({ status: "confirmed", allocations: result.allocations });
  }
  function addPerson() {
    const name = newName.trim();
    if (!name || participants.some((person) => person.name.toLowerCase() === name.toLowerCase())) return;
    setParticipants([...participants, { id: `name:${name}`, name }]);
    setNewName("");
  }
  function updateExact(personId: string, value: string) {
    const next = { ...amounts, [personId]: value };
    setAmounts(next);
    try {
      const result = calculateAllocations({ mode: "exact", totalPaise: amountPaise, amounts: Object.fromEntries(participants.map((person) => [person.id, rupeesToPaise(next[person.id] || 0)])) });
      onChange({ status: result.resolved ? "confirmed" : "needs_review", allocations: result.allocations });
    } catch { onChange({ status: "needs_review", allocations: [] }); }
  }
  return (
    <section className="form-section">
      <div className="section-heading"><div><span className="step">3</span><h2>Who shares it?</h2></div><span className="amount-caption">{formatInr(amountPaise)}</span></div>
      <div className="choice-grid">
        <button type="button" onClick={personal}>Only me</button>
        <button type="button" onClick={equal} disabled={participants.length < 2}>Split equally</button>
        <button type="button" onClick={() => setCustom(true)} disabled={participants.length < 2}>Custom amounts</button>
        <button type="button" onClick={() => onChange({ status: "needs_review", allocations: [] })}>Decide later</button>
      </div>
      <div className="participant-row"><label>Participant name<input value={newName} onChange={(event) => setNewName(event.target.value)} placeholder="Rahul" /></label><button type="button" className="button-quiet" onClick={addPerson}>Add person</button></div>
      <div className="people-chips">{participants.map((person) => <span key={person.id}>{person.name}</span>)}</div>
      {custom && <div className="custom-split">{participants.map((person) => <label key={person.id}>{person.name}<input inputMode="decimal" value={amounts[person.id] ?? ""} onChange={(event) => updateExact(person.id, event.target.value)} placeholder="0.00" /></label>)}</div>}
    </section>
  );
}
