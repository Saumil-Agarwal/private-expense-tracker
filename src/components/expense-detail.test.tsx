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
  groups: { id: "11111111-1111-4111-8111-111111111111", name: "Home" },
  items: [{ id: "item-1", name: "Milk", quantity: 2, amount_paise: 10000, owner: "Me", owner_person_id: "me-id" }],
  allocations: [{ personId: "me-id", person: "Me", amount_paise: 12500 }],
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

  it("edits all saved fields and submits the complete replacement", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ expense }), { status: 200, headers: { "content-type": "application/json" } }))
      .mockImplementation((url: string) => Promise.resolve(new Response(JSON.stringify(
        url === "/api/groups" ? { groups: [{ id: "11111111-1111-4111-8111-111111111111", name: "Home", people: [{ id: "me-id", name: "Me" }] }] }
          : url === "/api/people" ? { people: [{ id: "me-id", name: "Me" }] }
            : { id: "expense-1" },
      ), { status: 200, headers: { "content-type": "application/json" } })));
    vi.stubGlobal("fetch", fetchMock);

    render(<ExpenseDetail id="expense-1" />);
    fireEvent.click(await screen.findByRole("button", { name: "Edit expense" }));

    const merchant = screen.getByRole("textbox", { name: "Merchant" });
    expect(merchant).toHaveValue("Market");
    expect(screen.getByRole("spinbutton", { name: "Amount" })).toHaveValue(125);
    expect(screen.getByRole("textbox", { name: "Notes" })).toHaveValue("Weekly groceries");
    expect(screen.getByRole("textbox", { name: "Item name" })).toHaveValue("Milk");
    expect(screen.getByRole("spinbutton", { name: "Item quantity" })).toHaveValue(2);

    fireEvent.change(merchant, { target: { value: "Updated market" } });
    fireEvent.change(screen.getByRole("spinbutton", { name: "Amount" }), { target: { value: "150" } });
    fireEvent.change(screen.getByRole("textbox", { name: "Notes" }), { target: { value: "Updated note" } });
    fireEvent.click(screen.getByRole("button", { name: "Only me" }));
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/expenses/expense-1", expect.objectContaining({ method: "PATCH" })));
    const call = fetchMock.mock.calls.find(([url, options]) => url === "/api/expenses/expense-1" && options?.method === "PATCH")!;
    expect(JSON.parse(call[1].body)).toMatchObject({
      merchant: "Updated market", amountPaise: 15000, notes: "Updated note", groupId: "11111111-1111-4111-8111-111111111111",
      allocations: [{ personId: "me", amountPaise: 15000 }],
      items: [{ name: "Milk", quantity: 2, amountPaise: 10000, personal: true }],
    });
    await vi.waitFor(() => expect(push).toHaveBeenCalledWith("/expenses/expense-1"));
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
