import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ExpenseEntry } from "./expense-entry";

afterEach(() => vi.unstubAllGlobals());

describe("ExpenseEntry receipt input", () => {
  it("queues pasted screenshots and creates one combined draft only on command", async () => {
    const receiptBody = {
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
    };
    vi.stubGlobal("fetch", vi.fn().mockImplementation((url: string) => Promise.resolve(new Response(JSON.stringify(url === "/api/groups" ? { groups: [] } : receiptBody), { status: 200, headers: { "content-type": "application/json" } }))));
    render(<ExpenseEntry initialText="Biscuits are for me; split the rest with 201" />);
    const image = new File([new Uint8Array([1])], "receipt.png", { type: "image/png" });

    const second = new File([new Uint8Array([2])], "second.png", { type: "image/png" });
    fireEvent.paste(screen.getByLabelText("Expense details and split instructions"), {
      clipboardData: { items: [image, second].map((file) => ({ kind: "file", type: "image/png", getAsFile: () => file })) },
    });

    expect(fetch).not.toHaveBeenCalled();
    expect(screen.getByText("receipt.png")).toBeInTheDocument();
    expect(screen.getByText("second.png")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Create draft" }));
    expect(await screen.findByText("Parle-G Gold Biscuits")).toBeInTheDocument();
    expect(screen.getByText("Qwen 3.5 9B (local Ollama)")).toBeInTheDocument();
    const allocations = screen.getByRole("heading", { name: "Proposed allocation" }).nextElementSibling as HTMLElement;
    expect(within(allocations).getByText("Me").closest("li")).toHaveTextContent("₹48.00");
    expect(within(allocations).getByText("Anish").closest("li")).toHaveTextContent("₹28.00");
    await waitFor(() => expect(vi.mocked(fetch).mock.calls.some(([url]) => url === "/api/groups")).toBe(true));
    const receiptCall = vi.mocked(fetch).mock.calls.find(([url]) => url === "/api/inference/receipt")!;
    const form = receiptCall[1]?.body as FormData;
    expect(form.getAll("images")).toHaveLength(2);
  });

  it("shows a field error and does not save a blank merchant", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ groups: [] }), { status: 200, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);
    render(<ExpenseEntry initialText="Dinner ₹100" />);

    fireEvent.click(screen.getByRole("button", { name: "Create draft" }));
    const merchant = await screen.findByRole("textbox", { name: "Merchant" });
    fireEvent.change(merchant, { target: { value: "   " } });
    fireEvent.click(screen.getByRole("button", { name: "Only me" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm and save" }));

    expect(await screen.findByText("Enter a merchant name")).toBeInTheDocument();
    expect(merchant).toHaveAttribute("aria-invalid", "true");
    expect(fetchMock.mock.calls.filter(([url]) => url === "/api/expenses")).toHaveLength(0);
  });

  it("saves a valid expense without identity headers", async () => {
    const fetchMock = vi.fn().mockImplementation((url: string) => Promise.resolve(new Response(JSON.stringify(url === "/api/groups" ? { groups: [] } : { id: "expense-1" }), { status: url === "/api/groups" ? 200 : 201, headers: { "content-type": "application/json" } })));
    vi.stubGlobal("fetch", fetchMock);
    render(<ExpenseEntry initialText="Dinner ₹100" />);

    fireEvent.click(screen.getByRole("button", { name: "Create draft" }));
    await screen.findByRole("textbox", { name: "Merchant" });
    fireEvent.click(screen.getByRole("button", { name: "Only me" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm and save" }));
    expect(await screen.findByText("Expense saved.")).toBeInTheDocument();

    const saveCall = fetchMock.mock.calls.find(([url]) => url === "/api/expenses")!;
    expect(saveCall[1]?.headers).toEqual({ "content-type": "application/json" });
  });
});
