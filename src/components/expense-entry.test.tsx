import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ExpenseEntry } from "./expense-entry";

afterEach(() => vi.unstubAllGlobals());

describe("ExpenseEntry receipt input", () => {
  it("reads a pasted screenshot with Ollama and displays its proposed split", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      draft: { merchant: "Blinkit", amountPaise: 10400, currency: "INR", category: "Groceries", date: "2026-09-07", status: "draft", source: "ollama" },
      items: [
        { name: "Parle-G Gold Biscuits", amountPaise: 1000, personal: true },
        { name: "Fresh Bottle Gourd", amountPaise: 1900, personal: false },
        { name: "Vedaka Tapioca Sago", amountPaise: 6500, personal: false },
        { name: "Britannia Good Day Butter Cookies", amountPaise: 1000, personal: true },
      ],
      allocations: [
        { personId: "me", amountPaise: 4800 },
        { personId: "name:Anish", amountPaise: 2800 },
        { personId: "name:Sanjeev", amountPaise: 2800 },
      ],
      people: [{ id: "me", name: "Me" }, { id: "name:Anish", name: "Anish" }, { id: "name:Sanjeev", name: "Sanjeev" }],
      status: "confirmed",
      model: "qwen3.5:9b-q4_K_M",
    }), { status: 200, headers: { "content-type": "application/json" } })));
    render(<ExpenseEntry initialText="Biscuits are for me; split the rest with 201" />);
    const image = new File([new Uint8Array([1])], "receipt.png", { type: "image/png" });

    fireEvent.paste(screen.getByLabelText("Expense details and split instructions"), {
      clipboardData: { items: [{ kind: "file", type: "image/png", getAsFile: () => image }] },
    });

    expect(await screen.findByText("Parle-G Gold Biscuits")).toBeInTheDocument();
    expect(screen.getByText("Qwen 3.5 9B (local Ollama)")).toBeInTheDocument();
    const allocations = screen.getByRole("heading", { name: "Proposed allocation" }).nextElementSibling as HTMLElement;
    expect(within(allocations).getByText("Me").closest("li")).toHaveTextContent("₹48.00");
    expect(within(allocations).getByText("Anish").closest("li")).toHaveTextContent("₹28.00");
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
  });
});
