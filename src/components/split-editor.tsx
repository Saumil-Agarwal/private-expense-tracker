"use client";

import { useState } from "react";
import { calculateAllocations } from "@/domain/splits";
import { formatInr, rupeesToPaise } from "@/domain/expense";

type Person = { id: string; name: string };
type SplitValue = { status: "confirmed" | "needs_review"; allocations: Array<{ personId: string; amountPaise: number }> };

export function SplitEditor({ amountPaise, people, availablePeople = people, initialAllocations = [], onChange }: { amountPaise: number; people: Person[]; availablePeople?: Person[]; initialAllocations?: Array<{ personId: string; amountPaise: number }>; onChange: (value: SplitValue) => void }) {
  const [participants, setParticipants] = useState(people);
  const [selected, setSelected] = useState(() => new Set(people.map((person) => person.id)));
  const [newName, setNewName] = useState("");
  const [custom, setCustom] = useState(false);
  const [amounts, setAmounts] = useState<Record<string, string>>(() => Object.fromEntries(initialAllocations.map((allocation) => [allocation.personId, String(allocation.amountPaise / 100)])));
  const [existingPersonId, setExistingPersonId] = useState("");
  function personal() {
    setCustom(false);
    const result = calculateAllocations({ mode: "personal", totalPaise: amountPaise, ownerId: "me" });
    onChange({ status: "confirmed", allocations: result.allocations });
  }
  function equal() {
    setCustom(false);
    const result = calculateAllocations({ mode: "equal", totalPaise: amountPaise, personIds: participants.filter((person) => selected.has(person.id)).map((person) => person.id) });
    onChange({ status: "confirmed", allocations: result.allocations });
  }
  function addPerson() {
    const name = newName.trim();
    if (!name || participants.some((person) => person.name.toLowerCase() === name.toLowerCase())) return;
    const person = { id: `name:${name}`, name };
    setParticipants([...participants, person]);
    setSelected((current) => new Set(current).add(person.id));
    setNewName("");
    onChange({ status: "needs_review", allocations: [] });
  }
  function addExistingPerson() {
    const person = availablePeople.find((candidate) => candidate.id === existingPersonId);
    if (!person || participants.some((candidate) => candidate.id === person.id || candidate.name.toLowerCase() === person.name.toLowerCase())) return;
    setParticipants((current) => [...current, person]);
    setSelected((current) => new Set(current).add(person.id));
    setExistingPersonId("");
    onChange({ status: "needs_review", allocations: [] });
  }
  function updateExact(personId: string, value: string) {
    const next = { ...amounts, [personId]: value };
    setAmounts(next);
    try {
      const result = calculateAllocations({ mode: "exact", totalPaise: amountPaise, amounts: Object.fromEntries(participants.filter((person) => selected.has(person.id)).map((person) => [person.id, rupeesToPaise(next[person.id] || 0)])) });
      onChange({ status: result.resolved ? "confirmed" : "needs_review", allocations: result.allocations });
    } catch { onChange({ status: "needs_review", allocations: [] }); }
  }
  return (
    <section className="form-section">
      <div className="section-heading"><div><span className="step">3</span><h2>Who shares it?</h2></div><span className="amount-caption">{formatInr(amountPaise)}</span></div>
      <div className="choice-grid">
        <button type="button" onClick={personal}>Only me</button>
        <button type="button" onClick={equal} disabled={selected.size < 1}>Split equally</button>
        <button type="button" onClick={() => setCustom(true)} disabled={selected.size < 1}>Custom amounts</button>
        <button type="button" onClick={() => onChange({ status: "needs_review", allocations: [] })}>Decide later</button>
      </div>
      {initialAllocations.length > 0 && <ul className="allocation-list" aria-label="Proposed split">{initialAllocations.map((allocation) => <li key={allocation.personId}><span>{participants.find((person) => person.id === allocation.personId)?.name ?? allocation.personId}</span><strong>{formatInr(allocation.amountPaise)}</strong></li>)}</ul>}
      {availablePeople.some((person) => !participants.some((current) => current.id === person.id)) && <div className="participant-row"><label>Existing person<select value={existingPersonId} onChange={(event) => setExistingPersonId(event.target.value)}><option value="">Select a person</option>{availablePeople.filter((person) => !participants.some((current) => current.id === person.id)).map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}</select></label><button type="button" className="button-quiet" disabled={!existingPersonId} onClick={addExistingPerson}>Add existing person</button></div>}
      <div className="participant-row"><label>Participant name<input value={newName} onChange={(event) => setNewName(event.target.value)} placeholder="Rahul" /></label><button type="button" className="button-quiet" onClick={addPerson}>Add person</button></div>
      <div className="people-chips">{participants.map((person) => <label key={person.id}><input type="checkbox" checked={selected.has(person.id)} onChange={() => { setSelected((current) => { const next = new Set(current); if (next.has(person.id)) next.delete(person.id); else next.add(person.id); return next; }); onChange({ status: "needs_review", allocations: [] }); }} />{person.name}</label>)}</div>
      {custom && <div className="custom-split">{participants.filter((person) => selected.has(person.id)).map((person) => <label key={person.id}>{person.name}<input inputMode="decimal" value={amounts[person.id] ?? ""} onChange={(event) => updateExact(person.id, event.target.value)} placeholder="0.00" /></label>)}</div>}
    </section>
  );
}
