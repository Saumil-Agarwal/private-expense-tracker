"use client";

import { type ClipboardEvent, useEffect, useState } from "react";
import { Camera, Check, ClipboardPaste, LoaderCircle, Sparkles, X } from "lucide-react";

import { ConfirmedExpenseSchema, correctInferredExpenseYear, formatInr, type ExpenseDraft } from "@/domain/expense";
import { calculateAllocations } from "@/domain/splits";
import { extractReceiptText } from "@/inference/ocr";
import { parseExpenseInstruction } from "@/inference/parser";
import { resolveSplitIntent, type CatalogPerson } from "@/inference/split-intent";
import { createOnDeviceExtractor } from "@/inference/web-model";
import type { ReceiptResult } from "@/inference/receipt";
import { SplitEditor } from "./split-editor";
import { GroupPicker, type ExpenseGroup } from "./group-picker";

const categories = ["Restaurants", "Uber", "Cab", "Groceries", "Supermarkets", "Amazon groceries", "Internet", "Gifts", "Badminton game", "Bus", "Shows", "Flight", "Electricity", "Trip", "Activities", "Maid"];

export function ExpenseEntry({ initialText = "" }: { initialText?: string }) {
  const [text, setText] = useState(initialText);
  const [draft, setDraft] = useState<ExpenseDraft | null>(null);
  const [split, setSplit] = useState<{ status: "confirmed" | "needs_review"; allocations: Array<{ personId: string; amountPaise: number }> }>({ status: "needs_review", allocations: [] });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [merchantError, setMerchantError] = useState("");
  const [dateWarning, setDateWarning] = useState("");
  const [receipt, setReceipt] = useState<ReceiptResult | null>(null);
  const [images, setImages] = useState<File[]>([]);
  const [group, setGroup] = useState<ExpenseGroup | null>(null);
  const [groups, setGroups] = useState<ExpenseGroup[]>([]);
  const [savedPeople, setSavedPeople] = useState<CatalogPerson[]>([]);
  const [inferredPeople, setInferredPeople] = useState<CatalogPerson[] | null>(null);
  const [catalogWarning, setCatalogWarning] = useState("");

  function withCorrectedInferredYear(nextDraft: ExpenseDraft): ExpenseDraft {
    const correction = correctInferredExpenseYear(nextDraft.date);
    setDateWarning(correction.corrected ? `The extracted year looked incorrect, so it was changed to ${correction.date.slice(0, 4)}. Please check the date before saving.` : "");
    return correction.corrected ? { ...nextDraft, date: correction.date } : nextDraft;
  }

  useEffect(() => {
    let active = true;
    void Promise.allSettled([fetch("/api/groups"), fetch("/api/people")]).then(async ([groupResult, peopleResult]) => {
      if (!active) return;
      if (groupResult.status === "fulfilled" && groupResult.value.ok) setGroups((await groupResult.value.json()).groups ?? []);
      else setCatalogWarning("Saved groups could not be loaded; review the split manually.");
      if (peopleResult.status === "fulfilled" && peopleResult.value.ok) setSavedPeople((await peopleResult.value.json()).people ?? []);
      else setCatalogWarning("Saved people could not be loaded; review the split manually.");
    });
    return () => { active = false; };
  }, []);

  function applyTextInference(expenseText: string, parsedDraft?: ExpenseDraft) {
    const result = parseExpenseInstruction(expenseText, parsedDraft?.date ?? new Date().toISOString().slice(0, 10), { groups, people: savedPeople });
    const nextDraft = withCorrectedInferredYear(parsedDraft ?? result.draft);
    setDraft(nextDraft);
    if (!result.splitIntent) { setGroup(null); setInferredPeople(null); setSplit({ status: "needs_review", allocations: [] }); return; }
    const resolved = resolveSplitIntent(result.splitIntent, nextDraft.amountPaise, { groups, people: savedPeople });
    setGroup(resolved.group as ExpenseGroup | null);
    setInferredPeople(resolved.people);
    setSplit({ status: resolved.status, allocations: resolved.allocations });
    if (resolved.warning) setMessage(resolved.warning);
  }

  function applyResolvedInference(nextDraft: ExpenseDraft, splitIntent?: Parameters<typeof resolveSplitIntent>[0]) {
    nextDraft = withCorrectedInferredYear(nextDraft);
    setDraft(nextDraft);
    if (!splitIntent) { setGroup(null); setInferredPeople(null); setSplit({ status: "needs_review", allocations: [] }); return; }
    const resolved = resolveSplitIntent(splitIntent, nextDraft.amountPaise, { groups, people: savedPeople });
    setGroup(resolved.group as ExpenseGroup | null); setInferredPeople(resolved.people);
    setSplit({ status: resolved.status, allocations: resolved.allocations });
    if (resolved.warning) setMessage(resolved.warning);
  }

  async function extract(useModel = false) {
    if (images.length > 0) return readReceipts();
    setBusy(true); setMessage("");
    try {
      if (useModel) {
        const result = await createOnDeviceExtractor().extract({ text }, { groups, people: savedPeople });
        if (result.splitIntent) applyResolvedInference(result.draft, result.splitIntent);
        else applyTextInference(text, result.draft);
      }
      else applyTextInference(text);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not read expense"); }
    finally { setBusy(false); }
  }

  async function readReceipts() {
    if (images.length === 0) return;
    setBusy(true); setMessage("Reading receipt with local Ollama…"); setReceipt(null);
    try {
      const form = new FormData();
      images.forEach((image) => form.append("images", image));
      form.set("instructions", text);
      const response = await fetch("/api/inference/receipt", { method: "POST", body: form });
      if (!response.ok) throw new Error((await response.json()).error ?? "Ollama could not read the receipt");
      const result = await response.json() as ReceiptResult;
      const correctedDraft = withCorrectedInferredYear(result.draft);
      setReceipt(result); setDraft(correctedDraft);
      setGroup(result.group as ExpenseGroup | null);
      setInferredPeople(result.people);
      setSplit({ status: result.status, allocations: result.allocations });
      setMessage(result.warning ?? "Receipt read locally. Check the items and split before saving.");
    } catch (ollamaError) {
      try {
        const receiptText = (await Promise.all(images.map((image) => extractReceiptText(image)))).join("\n\n");
        setText(receiptText); applyTextInference(receiptText);
        setMessage(`${ollamaError instanceof Error ? ollamaError.message : "Ollama unavailable"} Used on-device OCR instead; please check the result.`);
      } catch { setMessage("Automatic reading failed. Open Ollama or type the expense below."); }
    }
    finally { setBusy(false); }
  }

  function pasteReceipt(event: ClipboardEvent<HTMLTextAreaElement>) {
    const pasted = [...event.clipboardData.items].filter((item) => item.kind === "file" && item.type.startsWith("image/")).map((item) => item.getAsFile()).filter((file): file is File => Boolean(file));
    if (!pasted.length) return;
    event.preventDefault();
    setImages((current) => [...current, ...pasted].slice(0, 10));
  }

  function updateReceiptItem(index: number, personal: boolean) {
    if (!receipt || !draft) return;
    const items = receipt.items.map((item, itemIndex) => itemIndex === index ? { ...item, personal } : item);
    const people = inferredPeople ?? group?.people ?? receipt.people;
    const owner = people.find((person) => person.id === "me" || person.name.toLowerCase() === "me");
    if (!owner || people.length < 2) {
      setReceipt({ ...receipt, items });
      setSplit({ status: "needs_review", allocations: [] });
      return;
    }
    const personalPaise = items.filter((item) => item.personal).reduce((sum, item) => sum + item.amountPaise, 0);
    const result = calculateAllocations({ mode: "shared-remainder", totalPaise: draft.amountPaise, ownerId: owner.id, personalPaise, personIds: people.map((person) => person.id) });
    setReceipt({ ...receipt, items, allocations: result.allocations, status: "confirmed" });
    setSplit({ status: "confirmed", allocations: result.allocations });
  }

  async function save() {
    if (!draft) return;
    setMessage(""); setMerchantError("");
    const parsed = ConfirmedExpenseSchema.safeParse({ ...draft, ...split, groupId: group?.id, items: receipt?.items ?? [] });
    if (!parsed.success) {
      if (parsed.error.issues.some((issue) => issue.path[0] === "merchant")) setMerchantError("Enter a merchant name");
      else setMessage("Check the highlighted expense details.");
      return;
    }
    setBusy(true);
    try {
      const response = await fetch("/api/expenses", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(parsed.data) });
      if (!response.ok) throw new Error((await response.json()).error ?? "Save failed");
      setMessage("Expense saved."); setText(""); setDraft(null); setReceipt(null); setImages([]); setDateWarning("");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Save failed"); }
    finally { setBusy(false); }
  }

  return <div className="entry-card">
    <section className="form-section">
      <div className="section-heading"><div><span className="step">1</span><h2>What did you buy?</h2></div></div>
      <label className="sr-only" htmlFor="expense-input">Expense details and split instructions</label>
      <textarea id="expense-input" aria-label="Expense details and split instructions" value={text} onPaste={pasteReceipt} onChange={(event) => setText(event.target.value)} placeholder="Paste a receipt, or type: biscuits are for me; split the rest with 201" rows={4} />
      <p className="paste-hint"><ClipboardPaste size={15} /> Paste a screenshot here, or choose a receipt image.</p>
      {images.length > 0 && <ul className="image-queue" aria-label="Queued screenshots">{images.map((image, index) => <li key={`${image.name}-${index}`}><span>{image.name}</span><button type="button" aria-label={`Remove ${image.name}`} onClick={() => setImages((current) => current.filter((_, itemIndex) => itemIndex !== index))}><X size={14} /></button></li>)}</ul>}
      <div className="entry-actions">
        <button className="button-primary" type="button" disabled={(!text.trim() && images.length === 0) || busy} onClick={() => extract(false)}>{busy ? <LoaderCircle className="spin" size={17} /> : <Sparkles size={17} />}Create draft</button>
        <button className="button-quiet" type="button" disabled={!text.trim() || busy} onClick={() => extract(true)}>Use on-device model</button>
        <label className="button-quiet"><Camera size={17} />Choose receipts<input type="file" accept="image/*" multiple hidden onChange={(event) => setImages((current) => [...current, ...Array.from(event.target.files ?? [])].slice(0, 10))} /></label>
      </div>
    </section>
    {draft && <>
      <section className="form-section">
        <div className="section-heading"><div><span className="step">2</span><h2>Check the details</h2></div><strong>{formatInr(draft.amountPaise)}</strong></div>
        <div className="field-grid"><label>Merchant<input value={draft.merchant} aria-invalid={Boolean(merchantError)} aria-describedby={merchantError ? "merchant-error" : undefined} onChange={(event) => { setDraft({ ...draft, merchant: event.target.value }); setMerchantError(""); }} />{merchantError && <small id="merchant-error" role="alert">{merchantError}</small>}</label><label>Date<input type="date" value={draft.date} onChange={(event) => { setDraft({ ...draft, date: event.target.value }); setDateWarning(""); }} /></label><label>Category<select value={draft.category ?? ""} onChange={(event) => setDraft({ ...draft, category: event.target.value })}><option value="">Uncategorized</option>{categories.map((category) => <option key={category}>{category}</option>)}</select></label></div>
      </section>
      <GroupPicker groups={groups} selectedId={group?.id ?? ""} onCreated={(created) => { setGroups((current) => [...current, created]); setSavedPeople((current) => [...current, ...created.people.filter((person) => !current.some((item) => item.id === person.id))]); }} onSelect={(selectedGroup) => { setGroup(selectedGroup); setInferredPeople(selectedGroup?.people ?? null); setSplit({ status: "needs_review", allocations: [] }); }} />
      {receipt && <section className="form-section receipt-review">
        <div className="section-heading"><div><span className="step">3</span><h2>Receipt items</h2></div><span className="model-badge">Qwen 3.5 9B (local Ollama)</span></div>
        <ul className="receipt-items">{receipt.items.map((item, index) => <li key={`${item.name}-${index}`}><span>{item.name}<label className="checkbox-label"><input aria-label={`Only me for ${item.name}`} type="checkbox" checked={item.personal} onChange={(event) => updateReceiptItem(index, event.target.checked)} />Only me</label></span><strong>{formatInr(item.amountPaise)}</strong></li>)}</ul>
        {split.allocations.length > 0 && <><h3>Proposed allocation</h3><ul className="allocation-list">{split.allocations.map((allocation) => <li key={allocation.personId}><span>{receipt.people.find((person) => person.id === allocation.personId)?.name ?? allocation.personId}</span><strong>{formatInr(allocation.amountPaise)}</strong></li>)}</ul></>}
      </section>}
      <SplitEditor key={`${draft.amountPaise}-${group?.id ?? "none"}-${(inferredPeople ?? []).map((person) => person.id).join("-")}`} amountPaise={draft.amountPaise} people={inferredPeople ?? group?.people ?? receipt?.people ?? [{ id: "me", name: "Me" }]} availablePeople={savedPeople} initialAllocations={split.allocations} onChange={setSplit} />
      <button className="save-button" type="button" onClick={save} disabled={busy}><Check size={18} />Confirm and save</button>
    </>}
    {message && <p className="form-message" role="status">{message}</p>}
    {dateWarning && <p className="form-message" role="status">{dateWarning}</p>}
    {catalogWarning && <p className="form-message" role="status">{catalogWarning}</p>}
  </div>;
}
