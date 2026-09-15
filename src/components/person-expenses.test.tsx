import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PersonExpenses } from "./person-expenses";

afterEach(() => vi.unstubAllGlobals());

describe("PersonExpenses", () => {
  it("shows only the selected person's expenses and allocated total", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ transactions: [
      { id: "expense-1", occurred_on: "2026-09-09", merchant: "Dinner", amount_paise: 9000, status: "confirmed", categories: null, groups: { id: "group-1", name: "Friends" }, allocations: [{ person: "Anish", amount_paise: 6000 }, { person: "Me", amount_paise: 3000 }] },
      { id: "expense-2", occurred_on: "2026-09-10", merchant: "Cab", amount_paise: 4000, status: "confirmed", categories: null, groups: null, allocations: [{ person: "Me", amount_paise: 4000 }] },
      { id: "expense-3", occurred_on: "2026-09-11", merchant: "Coffee", amount_paise: 2500, status: "confirmed", categories: null, groups: null, allocations: [{ person: " anish ", amount_paise: 2500 }] },
    ] }), { status: 200, headers: { "content-type": "application/json" } })));

    render(<PersonExpenses person="Anish" />);

    expect(await screen.findByText("₹85.00")).toBeInTheDocument();
    expect(screen.getByText("2 expenses")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Dinner/ })).toHaveAttribute("href", "/expenses/expense-1");
    expect(screen.getByRole("link", { name: /Dinner/ })).toHaveTextContent("Your share ₹60.00");
    expect(screen.getByRole("link", { name: /Dinner/ })).toHaveTextContent("Full amount ₹90.00");
    expect(screen.getByRole("link", { name: /Coffee/ })).toBeInTheDocument();
    expect(screen.queryByText("Cab")).not.toBeInTheDocument();
  });

  it("reloads the person's expenses when the date range changes", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ transactions: [] }), { status: 200, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);
    render(<PersonExpenses person="Anish" />);
    await screen.findByText("No expenses for Anish in these dates.");

    fireEvent.change(screen.getByLabelText("From"), { target: { value: "2026-09-01" } });

    await vi.waitFor(() => expect(fetchMock).toHaveBeenLastCalledWith(expect.stringContaining("from=2026-09-01")));
  });
});
