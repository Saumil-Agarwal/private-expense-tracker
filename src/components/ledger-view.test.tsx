import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LedgerView } from "./ledger-view";

afterEach(() => vi.unstubAllGlobals());

describe("LedgerView reconciliation", () => {
  it("links ledger rows to their expense details", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ transactions: [
      { id: "expense-1", occurred_on: "2026-09-09", merchant: "Dinner", amount_paise: 9000, status: "confirmed", categories: null, groups: null, allocations: [] },
    ] }), { status: 200, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);

    render(<LedgerView />);

    expect(await screen.findByRole("link", { name: /Dinner/ })).toHaveAttribute("href", "/expenses/expense-1");
    expect(fetchMock).toHaveBeenCalledWith("/api/expenses");
  });

  it("loads archived expenses in trash mode", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ transactions: [] }), { status: 200, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);

    render(<LedgerView trash />);

    expect(await screen.findByText("Trash is empty.")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith("/api/expenses?trash=true");
  });

  it("moves an expense to trash directly from the ledger and removes it immediately", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ transactions: [
        { id: "expense-1", occurred_on: "2026-09-09", created_at: "2026-09-09T12:00:00Z", merchant: "Dinner", amount_paise: 9000, status: "confirmed", categories: null, groups: null, allocations: [] },
      ] }), { status: 200, headers: { "content-type": "application/json" } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "expense-1", deleted_at: "2026-09-15T00:00:00Z" }), { status: 200, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("confirm", vi.fn().mockReturnValue(true));

    render(<LedgerView />);
    fireEvent.click(await screen.findByRole("button", { name: "Delete Dinner" }));

    await vi.waitFor(() => expect(fetchMock).toHaveBeenLastCalledWith("/api/expenses/expense-1", expect.objectContaining({ method: "PATCH", body: JSON.stringify({ action: "trash" }) })));
    await vi.waitFor(() => expect(screen.queryByText("Dinner")).not.toBeInTheDocument());
    expect(screen.getByText("No expenses yet.")).toBeInTheDocument();
  });

  it("shows the verified aggregate equation and per-expense result", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ transactions: [
      { id: "1", occurred_on: "2026-09-09", merchant: "Dinner", amount_paise: 9000, status: "confirmed", categories: null, groups: null, allocations: [{ person: "Me", amount_paise: 3000 }, { person: "Anish", amount_paise: 6000 }] },
      { id: "2", occurred_on: "2026-09-09", merchant: "Unknown", amount_paise: 1000, status: "needs_review", categories: null, groups: null, allocations: [] },
    ] }), { status: 200, headers: { "content-type": "application/json" } })));

    render(<LedgerView summary />);

    expect(await screen.findByText("All totals verified")).toBeInTheDocument();
    expect(screen.getByText("₹90.00 confirmed + ₹10.00 unresolved = ₹100.00 recorded")).toBeInTheDocument();
    expect(screen.getByText("Dinner").closest("article")).toHaveTextContent("Verified");
  });

  it("links each participant summary to that person's expense page", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ transactions: [
      { id: "1", occurred_on: "2026-09-09", merchant: "Dinner", amount_paise: 9000, status: "confirmed", categories: null, groups: null, allocations: [{ person: "Anish Mehta", amount_paise: 9000 }] },
    ] }), { status: 200, headers: { "content-type": "application/json" } })));

    render(<LedgerView summary />);

    expect(await screen.findByRole("link", { name: /Anish Mehta/ })).toHaveAttribute("href", "/people/Anish%20Mehta");
  });

  it("surfaces a one-paise stored mismatch", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ transactions: [
      { id: "1", occurred_on: "2026-09-09", merchant: "Dinner", amount_paise: 10000, status: "confirmed", categories: null, groups: null, allocations: [{ person: "Me", amount_paise: 9999 }] },
    ] }), { status: 200, headers: { "content-type": "application/json" } })));

    render(<LedgerView summary />);

    expect(await screen.findByText("Totals need attention")).toBeInTheDocument();
    expect(screen.getByText("Dinner").closest("article")).toHaveTextContent("Mismatch by ₹0.01");
  });

  it("opens the overview with a year-to-date date range", async () => {
    const today = new Date().toISOString().slice(0, 10);
    const yearStart = `${today.slice(0, 4)}-01-01`;
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ transactions: [] }), { status: 200, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);

    render(<LedgerView summary />);

    expect(await screen.findByLabelText("From")).toHaveValue(yearStart);
    expect(fetchMock).toHaveBeenCalledWith(`/api/expenses?from=${yearStart}&to=${today}`);
  });
});
