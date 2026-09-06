import { ArrowRight, LockKeyhole, ReceiptText, Users } from "lucide-react";

export default function Home() {
  return (
    <main className="shell">
      <header className="topbar">
        <span className="wordmark">Ledgerly</span>
        <span className="privacy-pill"><LockKeyhole size={14} /> On-device processing</span>
      </header>

      <section className="hero">
        <p className="eyebrow">Private expense tracking</p>
        <h1>Capture the purchase.<br />Sort the split later.</h1>
        <p className="lede">
          Turn a message or receipt into a clean expense, keep uncertain shares unresolved,
          and see where the month went.
        </p>
        <a className="primary" href="/expenses/new">Add an expense <ArrowRight size={18} /></a>
      </section>

      <section className="feature-grid" aria-label="Features">
        <article><ReceiptText /><h2>Receipt to draft</h2><p>Images are read on this device and stay off the server.</p></article>
        <article><Users /><h2>Flexible splits</h2><p>Equal, exact, weighted, personal, or unresolved.</p></article>
        <article><LockKeyhole /><h2>Confirm before save</h2><p>Only the structured record reaches your private ledger.</p></article>
      </section>
    </main>
  );
}
