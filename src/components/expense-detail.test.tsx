import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const push = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

import { ExpenseDetail } from "./expense-detail";

const expense = {
  id: "expense-1",
  occurred_on: "2026-09-09",
  merchant: "Market",
  amount_paise: 12500,
  currency: "INR",
  status: "confirmed",
  notes: "Weekly groceries",
  source: "receipt",
  deleted_at: null,
  categories: { name: "Groceries" },
  groups: { id: "group-1", name: "Home" },
  items: [{ id: "item-1", name: "Milk", quantity: 2, amount_paise: 10000, owner: "Me" }],
  allocations: [{ person: "Me", amount_paise: 12500 }],
};

afterEach(() => vi.unstubAllGlobals());
beforeEach(() => push.mockReset());

describe("ExpenseDetail", () => {
  it("shows expense metadata, receipt items, and allocations", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ expense }), { status: 200, headers: { "content-type": "application/json" } })));

    render(<ExpenseDetail id="expense-1" />);

    expect(await screen.findByRole("heading", { name: "Market" })).toBeInTheDocument();
    expect(screen.getByText("Weekly groceries")).toBeInTheDocument();
    expect(screen.getByText("Milk").closest("li")).toHaveTextContent("2 ×");
    expect(screen.getByText("Milk").closest("li")).toHaveTextContent("Me");
    expect(screen.getByText("Me", { selector: ".allocation-list span" }).closest("li")).toHaveTextContent("₹125.00");
  });

  it("moves an active expense to trash after confirmation", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ expense }), { status: 200, headers: { "content-type": "application/json" } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ expense: { ...expense, deleted_at: "2026-09-14T00:00:00Z" } }), { status: 200, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("confirm", vi.fn().mockReturnValue(true));

    render(<ExpenseDetail id="expense-1" />);
    fireEvent.click(await screen.findByRole("button", { name: "Move to Trash" }));

    await vi.waitFor(() => expect(fetchMock).toHaveBeenLastCalledWith("/api/expenses/expense-1", expect.objectContaining({ method: "PATCH", body: JSON.stringify({ action: "trash" }) })));
    await vi.waitFor(() => expect(push).toHaveBeenCalledWith("/expenses"));
  });

  it("restores or permanently deletes an archived expense", async () => {
    const archived = { ...expense, deleted_at: "2026-09-14T00:00:00Z" };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ expense: archived }), { status: 200, headers: { "content-type": "application/json" } }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("confirm", vi.fn().mockReturnValue(true));

    render(<ExpenseDetail id="expense-1" />);
    fireEvent.click(await screen.findByRole("button", { name: "Delete permanently" }));

    await vi.waitFor(() => expect(fetchMock).toHaveBeenLastCalledWith("/api/expenses/expense-1", { method: "DELETE" }));
    expect(confirm).toHaveBeenCalledWith(expect.stringMatching(/cannot be undone/i));
    await vi.waitFor(() => expect(push).toHaveBeenCalledWith("/expenses/trash"));
  });
});
