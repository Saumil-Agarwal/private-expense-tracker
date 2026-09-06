"use client";

import { useState } from "react";
import { Camera, Check, LoaderCircle, Sparkles } from "lucide-react";

import { ConfirmedExpenseSchema, formatInr, type ExpenseDraft } from "@/domain/expense";
import { extractReceiptText } from "@/inference/ocr";
import { parseExpenseText } from "@/inference/parser";
import { createOnDeviceExtractor } from "@/inference/web-model";
import { SplitEditor } from "./split-editor";

const categories = ["Restaurants", "Uber", "Groceries", "Amazon groceries", "Internet", "Gifts", "Badminton game", "Bus", "Shows", "Flight", "Electricity", "Trip", "Activities", "Maid"];

export function ExpenseEntry({ initialText = "" }: { initialText?: string }) {
  const [text, setText] = useState(initialText);
  const [draft, setDraft] = useState<ExpenseDraft | null>(null);
  const [split, setSplit] = useState<{ status: "confirmed" | "needs_review"; allocations: Array<{ personId: string; amountPaise: number }> }>({ status: "needs_review", allocations: [] });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function extract(useModel = false) {
    setBusy(true); setMessage("");
    try {
      setDraft(useModel ? await createOnDeviceExtractor().extract({ text }) : parseExpenseText(text));
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not read expense"); }
    finally { setBusy(false); }
  }

  async function readReceipt(file?: File) {
    if (!file) return;
    setBusy(true); setMessage("Reading receipt on this device…");
    try { const receiptText = await extractReceiptText(file); setText(receiptText); setDraft(parseExpenseText(receiptText)); setMessage("Receipt stayed on this device."); }
    catch { setMessage("Automatic reading failed. You can still type the expense below."); }
    finally { setBusy(false); }
  }

  async function save() {
    if (!draft) return;
    setBusy(true); setMessage("");
    try {
      const payload = ConfirmedExpenseSchema.parse({ ...draft, ...split });
      const initData = window.Telegram?.WebApp?.initData ?? "";
      const response = await fetch("/api/expenses", { method: "POST", headers: { "content-type": "application/json", "x-telegram-init-data": initData }, body: JSON.stringify(payload) });
      if (!response.ok) throw new Error((await response.json()).error ?? "Save failed");
      setMessage("Expense saved."); setText(""); setDraft(null);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Save failed"); }
    finally { setBusy(false); }
  }

  return <div className="entry-card">
    <section className="form-section">
      <div className="section-heading"><div><span className="step">1</span><h2>What did you buy?</h2></div></div>
      <textarea value={text} onChange={(event) => setText(event.target.value)} placeholder="₹2,400 at Amazon Fresh, split unknown" rows={4} />
      <div className="entry-actions">
        <button className="button-primary" type="button" disabled={!text.trim() || busy} onClick={() => extract(false)}>{busy ? <LoaderCircle className="spin" size={17} /> : <Sparkles size={17} />}Create draft</button>
        <button className="button-quiet" type="button" disabled={!text.trim() || busy} onClick={() => extract(true)}>Use on-device model</button>
        <label className="button-quiet"><Camera size={17} />Read receipt<input type="file" accept="image/*" hidden onChange={(event) => readReceipt(event.target.files?.[0])} /></label>
      </div>
    </section>
    {draft && <>
      <section className="form-section">
        <div className="section-heading"><div><span className="step">2</span><h2>Check the details</h2></div><strong>{formatInr(draft.amountPaise)}</strong></div>
        <div className="field-grid"><label>Merchant<input value={draft.merchant} onChange={(event) => setDraft({ ...draft, merchant: event.target.value })} /></label><label>Date<input type="date" value={draft.date} onChange={(event) => setDraft({ ...draft, date: event.target.value })} /></label><label>Category<select value={draft.category ?? ""} onChange={(event) => setDraft({ ...draft, category: event.target.value })}><option value="">Uncategorized</option>{categories.map((category) => <option key={category}>{category}</option>)}</select></label></div>
      </section>
      <SplitEditor amountPaise={draft.amountPaise} people={[{ id: "me", name: "Me" }]} onChange={setSplit} />
      <button className="save-button" type="button" onClick={save} disabled={busy}><Check size={18} />Confirm and save</button>
    </>}
    {message && <p className="form-message" role="status">{message}</p>}
  </div>;
}

declare global { interface Window { Telegram?: { WebApp?: { initData?: string; ready?: () => void; expand?: () => void } } } }
