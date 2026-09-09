"use client";
import { useEffect, useState } from "react";
import { GroupManager } from "./group-manager";

export type GroupPerson = { id: string; persistedId?: string; name: string };
export type ExpenseGroup = { id: string; name: string; people: GroupPerson[] };

export function GroupPicker({ onSelect }: { onSelect: (group: ExpenseGroup | null) => void }) {
  const [groups, setGroups] = useState<ExpenseGroup[]>([]);
  const [creating, setCreating] = useState(false);
  const [selectedId, setSelectedId] = useState("");
  async function load() {
    try {
      const response = await fetch("/api/groups");
      if (response.ok) setGroups((await response.json()).groups ?? []);
    } catch { /* group loading must not discard an expense draft */ }
  }
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, []);
  function created(group: ExpenseGroup) {
    setGroups((current) => [...current, group]); setSelectedId(group.id); setCreating(false); onSelect(group);
  }
  return <section className="group-picker"><label>Group<select value={selectedId} onChange={(event) => { setSelectedId(event.target.value); onSelect(groups.find((group) => group.id === event.target.value) ?? null); }}><option value="">No saved group</option>{groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select></label>{creating ? <GroupManager compact onCreated={created} /> : <button type="button" className="button-quiet" onClick={() => setCreating(true)}>Create group</button>}</section>;
}
