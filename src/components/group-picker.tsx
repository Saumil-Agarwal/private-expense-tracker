"use client";
import { useEffect, useState } from "react";

export type GroupPerson = { id: string; persistedId?: string; name: string };
export type ExpenseGroup = { id: string; name: string; people: GroupPerson[] };

export function GroupPicker({ onSelect, onUnauthorized }: { onSelect: (group: ExpenseGroup | null) => void; onUnauthorized: () => void }) {
  const [groups, setGroups] = useState<ExpenseGroup[]>([]);
  const [name, setName] = useState("");
  const [members, setMembers] = useState("Me");
  const [creating, setCreating] = useState(false);
  async function load() {
    try {
      const response = await fetch("/api/groups", { headers: { "x-telegram-init-data": window.Telegram?.WebApp?.initData ?? "" } });
      if (response.status === 401) return onUnauthorized();
      if (response.ok) setGroups((await response.json()).groups ?? []);
    } catch { /* group loading must not discard an expense draft */ }
  }
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  async function create() {
    const response = await fetch("/api/groups", { method: "POST", headers: { "content-type": "application/json", "x-telegram-init-data": window.Telegram?.WebApp?.initData ?? "" }, body: JSON.stringify({ name, memberNames: members.split(",").map((item) => item.trim()).filter(Boolean) }) });
    if (response.status === 401) return onUnauthorized();
    if (!response.ok) return;
    const group = (await response.json()).group as ExpenseGroup;
    setGroups((current) => [...current, group]); setName(""); setMembers("Me"); setCreating(false); onSelect(group);
  }
  return <section className="group-picker"><label>Group<select defaultValue="" onChange={(event) => onSelect(groups.find((group) => group.id === event.target.value) ?? null)}><option value="">No saved group</option>{groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select></label>{creating ? <div className="group-create"><label>Group name<input value={name} onChange={(event) => setName(event.target.value)} /></label><label>Members, comma separated<input value={members} onChange={(event) => setMembers(event.target.value)} /></label><button type="button" className="button-quiet" onClick={create}>Save group</button></div> : <button type="button" className="button-quiet" onClick={() => setCreating(true)}>Create group</button>}</section>;
}
