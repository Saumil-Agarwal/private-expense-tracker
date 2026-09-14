"use client";
import { useState } from "react";
import { GroupManager } from "./group-manager";

export type GroupPerson = { id: string; persistedId?: string; name: string };
export type ExpenseGroup = { id: string; name: string; people: GroupPerson[] };

export function GroupPicker({ groups, selectedId, onSelect, onCreated }: { groups: ExpenseGroup[]; selectedId: string; onSelect: (group: ExpenseGroup | null) => void; onCreated: (group: ExpenseGroup) => void }) {
  const [creating, setCreating] = useState(false);
  function created(group: ExpenseGroup) {
    onCreated(group); setCreating(false); onSelect(group);
  }
  return <section className="group-picker"><label>Group<select value={selectedId} onChange={(event) => onSelect(groups.find((group) => group.id === event.target.value) ?? null)}><option value="">No saved group</option>{groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select></label>{creating ? <GroupManager compact onCreated={created} /> : <button type="button" className="button-quiet" onClick={() => setCreating(true)}>Create group</button>}</section>;
}
