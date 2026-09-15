"use client";

import { Check, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { ConfirmedExpenseSchema, rupeesToPaise } from "@/domain/expense";
import { GroupPicker, type ExpenseGroup } from "./group-picker";
import { SplitEditor } from "./split-editor";

const categories = ["Restaurants", "Uber", "Cab", "Groceries", "Supermarkets", "Amazon groceries", "Internet", "Gifts", "Badminton game", "Bus", "Shows", "Flight", "Electricity", "Trip", "Activities", "Maid"];

export type EditableExpense = {
  id: string; occurred_on: string; merchant: string; amount_paise: number; currency: "INR"; status: "confirmed" | "needs_review";
  notes: string | null; source: "manual" | "receipt" | "ollama" | "on_device_model"; deleted_at: string | null;
  categories?: { name: string } | null; groups?: { id: string; name: string } | null;
  items: Array<{ id: string; name: string; quantity: number; amount_paise: number; owner: string | null; owner_person_id: string | null }>;
  allocations: Array<{ personId: string; person: string; amount_paise: number }>;
};

type ItemDraft = { key: string; name: string; quantity: string; amount: string; personal: boolean };

export function ExpenseEditor({ expense, onCancel }: { expense: EditableExpense; onCancel: () => void }) {
  const router = useRouter();
  const [merchant, setMerchant] = useState(expense.merchant);
  const [amount, setAmount] = useState(String(expense.amount_paise / 100));
  const [date, setDate] = useState(expense.occurred_on);
  const [category, setCategory] = useState(expense.categories?.name ?? "");
  const [notes, setNotes] = useState(expense.notes ?? "");
  const [groups, setGroups] = useState<ExpenseGroup[]>([]);
  const [people, setPeople] = useState<Array<{ id: string; name: string }>>(expense.allocations.map(({ personId, person }) => ({ id: personId, name: person })));
  const [group, setGroup] = useState<ExpenseGroup | null>(expense.groups ? { ...expense.groups, people: [] } : null);
  const [split, setSplit] = useState({ status: expense.status, allocations: expense.allocations.map(({ personId, amount_paise }) => ({ personId, amountPaise: amount_paise })) });
  const [items, setItems] = useState<ItemDraft[]>(expense.items.map((item) => ({ key: item.id, name: item.name, quantity: String(item.quantity), amount: String(item.amount_paise / 100), personal: item.owner === "Me" })));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    void Promise.all([fetch("/api/groups"), fetch("/api/people")]).then(async ([groupResponse, peopleResponse]) => {
      if (!active) return;
      if (groupResponse.ok) {
        const loaded = (await groupResponse.json()).groups ?? [];
        setGroups(loaded);
        setGroup(loaded.find((item: ExpenseGroup) => item.id === expense.groups?.id) ?? null);
      }
      if (peopleResponse.ok) setPeople((await peopleResponse.json()).people ?? []);
    }).catch(() => { if (active) setMessage("Saved groups or people could not be loaded."); });
    return () => { active = false; };
  }, [expense.groups?.id]);

  function updateItem(key: string, patch: Partial<ItemDraft>) { setItems((current) => current.map((item) => item.key === key ? { ...item, ...patch } : item)); }

  async function save() {
    setMessage("");
    let amountPaise: number;
    try { amountPaise = rupeesToPaise(amount); } catch { setMessage("Enter a valid amount."); return; }
    const parsed = ConfirmedExpenseSchema.safeParse({
      merchant, amountPaise, currency: expense.currency, date, category: category || undefined, groupId: group?.id,
      notes: notes || undefined, status: split.status, source: expense.source, allocations: split.allocations,
      items: items.map((item) => ({ name: item.name, quantity: Number(item.quantity), amountPaise: rupeesToPaise(item.amount), personal: item.personal })),
    });
    if (!parsed.success) { setMessage("Check the expense details, items, and split totals."); return; }
    setBusy(true);
    try {
      const response = await fetch(`/api/expenses/${expense.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(parsed.data) });
      if (!response.ok) throw new Error((await response.json()).error ?? "Update failed");
      router.push(`/expenses/${expense.id}`); router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Update failed"); }
    finally { setBusy(false); }
  }

  const amountPaise = (() => { try { return rupeesToPaise(amount); } catch { return 0; } })();
  return <div className="entry-card expense-editor">
    <section className="form-section"><div className="section-heading"><div><span className="step">1</span><h2>Edit details</h2></div></div>
      <div className="field-grid">
        <label>Merchant<input value={merchant} onChange={(event) => setMerchant(event.target.value)} /></label>
        <label>Amount<input aria-label="Amount" type="number" min="0.01" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} /></label>
        <label>Date<input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label>
        <label>Category<select value={category} onChange={(event) => setCategory(event.target.value)}><option value="">Uncategorized</option>{categories.map((item) => <option key={item}>{item}</option>)}</select></label>
      </div>
      <label className="notes-field">Notes<textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} /></label>
    </section>
    <GroupPicker groups={groups} selectedId={group?.id ?? ""} onCreated={(created) => setGroups((current) => [...current, created])} onSelect={setGroup} />
    <section className="form-section"><div className="section-heading"><div><span className="step">2</span><h2>Receipt items</h2></div><button type="button" className="button-quiet" onClick={() => setItems((current) => [...current, { key: crypto.randomUUID(), name: "", quantity: "1", amount: "0", personal: false }])}><Plus size={16} />Add item</button></div>
      <div className="item-editor-list">{items.map((item) => <div className="item-editor-row" key={item.key}>
        <label>Item name<input aria-label="Item name" value={item.name} onChange={(event) => updateItem(item.key, { name: event.target.value })} /></label>
        <label>Quantity<input aria-label="Item quantity" type="number" min="0.001" step="0.001" value={item.quantity} onChange={(event) => updateItem(item.key, { quantity: event.target.value })} /></label>
        <label>Amount<input aria-label="Item amount" type="number" min="0" step="0.01" value={item.amount} onChange={(event) => updateItem(item.key, { amount: event.target.value })} /></label>
        <label className="checkbox-label"><input type="checkbox" checked={item.personal} onChange={(event) => updateItem(item.key, { personal: event.target.checked })} />Only me</label>
        <button type="button" className="icon-button" aria-label={`Remove ${item.name || "item"}`} onClick={() => setItems((current) => current.filter((currentItem) => currentItem.key !== item.key))}><Trash2 size={16} /></button>
      </div>)}</div>
    </section>
    <SplitEditor key={amountPaise} amountPaise={amountPaise} people={people.length ? people : [{ id: "me", name: "Me" }]} availablePeople={people} initialAllocations={split.allocations} onChange={setSplit} />
    {message && <p className="form-message" role="status">{message}</p>}
    <div className="editor-actions"><button type="button" className="button-quiet" disabled={busy} onClick={onCancel}>Cancel</button><button type="button" className="save-button" disabled={busy} onClick={() => void save()}><Check size={18} />Save changes</button></div>
  </div>;
}
