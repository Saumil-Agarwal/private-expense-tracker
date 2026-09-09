"use client";

import { useEffect, useState } from "react";
import type { ExpenseGroup } from "./group-picker";

export function GroupManager({ compact = false, onCreated }: { compact?: boolean; onCreated?: (group: ExpenseGroup) => void }) {
  const [groups, setGroups] = useState<ExpenseGroup[]>([]);
  const [name, setName] = useState("");
  const [newMember, setNewMember] = useState("");
  const [members, setMembers] = useState(["Me"]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    void fetch("/api/groups").then(async (response) => {
      if (active && response.ok) setGroups((await response.json()).groups ?? []);
    }).catch(() => { /* creation remains available if loading fails */ });
    return () => { active = false; };
  }, []);

  function addMember() {
    const member = newMember.trim();
    if (!member) return;
    if (members.some((current) => current.toLocaleLowerCase() === member.toLocaleLowerCase())) return setError("That member is already in the group.");
    setMembers((current) => [...current, member]); setNewMember(""); setError("");
  }

  async function create() {
    if (!name.trim()) return setError("Enter a group name.");
    if (!members.length) return setError("Add at least one member.");
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/groups", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: name.trim(), memberNames: members }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Group could not be saved");
      const group = body.group as ExpenseGroup;
      setGroups((current) => [...current, group]); setName(""); setNewMember(""); setMembers(["Me"]); onCreated?.(group);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Group could not be saved"); }
    finally { setBusy(false); }
  }

  return <section className={compact ? "group-create" : "form-section"}>
    {!compact && <div className="section-heading"><div><h2>Create a group</h2><p>Add the people you commonly split expenses with.</p></div></div>}
    <label>Group name<input value={name} onChange={(event) => setName(event.target.value)} placeholder="Flatmates" /></label>
    <div className="participant-row"><label>New member<input value={newMember} onChange={(event) => setNewMember(event.target.value)} placeholder="Rahul" /></label><button type="button" className="button-quiet" onClick={addMember}>Add member</button></div>
    <div className="people-chips">{members.map((member) => <span key={member}>{member}<button type="button" aria-label={`Remove ${member}`} onClick={() => setMembers((current) => current.filter((item) => item !== member))}>×</button></span>)}</div>
    <button type="button" className="button-primary" disabled={busy} onClick={create}>{busy ? "Saving…" : "Save group"}</button>
    {error && <p role="alert">{error}</p>}
    {!compact && <div className="group-list"><h2>Saved groups</h2>{groups.length ? groups.map((group) => <article key={group.id}><strong>{group.name}</strong><p>{group.people.map((person) => person.name).join(", ")}</p></article>) : <p>No saved groups yet.</p>}</div>}
  </section>;
}
