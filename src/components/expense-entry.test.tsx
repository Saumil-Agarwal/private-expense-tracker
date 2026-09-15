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
      group: { id: "11111111-1111-4111-8111-111111111111", name: "Flatmates", people: [{ id: "me", name: "Me" }, { id: "name:Anish", name: "Anish" }, { id: "name:Sanjeev", name: "Sanjeev" }] },
      status: "confirmed",
      model: "qwen3.5:9b-q4_K_M",
    };
    vi.stubGlobal("fetch", vi.fn().mockImplementation((url: string) => Promise.resolve(new Response(JSON.stringify(url === "/api/groups" ? { groups: [receiptBody.group] } : url === "/api/people" ? { people: receiptBody.people } : receiptBody), { status: 200, headers: { "content-type": "application/json" } }))));
    render(<ExpenseEntry initialText="Biscuits are for me; split the rest with 201" />);
    const image = new File([new Uint8Array([1])], "receipt.png", { type: "image/png" });

    const second = new File([new Uint8Array([2])], "second.png", { type: "image/png" });
    fireEvent.paste(screen.getByLabelText("Expense details and split instructions"), {
      clipboardData: { items: [image, second].map((file) => ({ kind: "file", type: "image/png", getAsFile: () => file })) },
    });

    expect(vi.mocked(fetch).mock.calls.some(([url]) => url === "/api/inference/receipt")).toBe(false);
    expect(screen.getByText("receipt.png")).toBeInTheDocument();
    expect(screen.getByText("second.png")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Create draft" }));
    expect(await screen.findByText("Parle-G Gold Biscuits")).toBeInTheDocument();
    expect(screen.getByText("Qwen 3.5 9B (local Ollama)")).toBeInTheDocument();
    const allocations = screen.getByRole("heading", { name: "Proposed allocation" }).nextElementSibling as HTMLElement;
    expect(within(allocations).getByText("Me").closest("li")).toHaveTextContent("₹48.00");
    expect(within(allocations).getByText("Anish").closest("li")).toHaveTextContent("₹28.00");
    expect(screen.getByRole("combobox", { name: "Group" })).toHaveValue(receiptBody.group.id);
    await waitFor(() => expect(vi.mocked(fetch).mock.calls.some(([url]) => url === "/api/groups")).toBe(true));
    const receiptCall = vi.mocked(fetch).mock.calls.find(([url]) => url === "/api/inference/receipt")!;
    const form = receiptCall[1]?.body as FormData;
    expect(form.getAll("images")).toHaveLength(2);

    fireEvent.click(screen.getByRole("button", { name: "Confirm and save" }));
    await screen.findByText("Expense saved.");
    const saveCall = vi.mocked(fetch).mock.calls.find(([url]) => url === "/api/expenses")!;
    expect(JSON.parse(saveCall[1]?.body as string).items).toEqual(receiptBody.items.map((item) => ({ ...item, quantity: 1 })));
  });

  it("shows a field error and does not save a blank merchant", async () => {
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(new Response(JSON.stringify({ groups: [], people: [] }), { status: 200, headers: { "content-type": "application/json" } })));
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

  it("selects an instructed saved group and submits its inferred equal split", async () => {
    const group = { id: "11111111-1111-4111-8111-111111111111", name: "Flatmates", people: [{ id: "me", name: "Me" }, { id: "rahul-id", name: "Rahul" }] };
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url === "/api/groups") return Promise.resolve(new Response(JSON.stringify({ groups: [group] }), { status: 200 }));
      if (url === "/api/people") return Promise.resolve(new Response(JSON.stringify({ people: group.people }), { status: 200 }));
      return Promise.resolve(new Response(JSON.stringify({ id: "expense-1" }), { status: 201 }));
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<ExpenseEntry initialText="Dinner ₹100 split with Flatmates" />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/people"));

    fireEvent.click(screen.getByRole("button", { name: "Create draft" }));

    expect(await screen.findByRole("combobox", { name: "Group" })).toHaveValue(group.id);
    fireEvent.click(screen.getByRole("button", { name: "Confirm and save" }));
    await screen.findByText("Expense saved.");
    const saveCall = fetchMock.mock.calls.find(([url]) => url === "/api/expenses")!;
    expect(JSON.parse(saveCall[1]?.body as string)).toMatchObject({
      groupId: group.id,
      allocations: [{ personId: "me", amountPaise: 5000 }, { personId: "rahul-id", amountPaise: 5000 }],
    });
  });

  it("does not retain a previous split when a replacement draft has no split instruction", async () => {
    const group = { id: "11111111-1111-4111-8111-111111111111", name: "Flatmates", people: [{ id: "me", name: "Me" }, { id: "rahul-id", name: "Rahul" }] };
    const fetchMock = vi.fn().mockImplementation((url: string) => Promise.resolve(new Response(JSON.stringify(url === "/api/groups" ? { groups: [group] } : url === "/api/people" ? { people: group.people } : { id: "expense-1" }), { status: url === "/api/expenses" ? 201 : 200 })));
    vi.stubGlobal("fetch", fetchMock);
    render(<ExpenseEntry initialText="Dinner ₹100 split with Flatmates" />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/people"));
    fireEvent.click(screen.getByRole("button", { name: "Create draft" }));
    await screen.findByRole("combobox", { name: "Group" });

    fireEvent.change(screen.getByLabelText("Expense details and split instructions"), { target: { value: "Lunch ₹100" } });
    fireEvent.click(screen.getByRole("button", { name: "Create draft" }));
    await waitFor(() => expect(screen.getByRole("combobox", { name: "Group" })).toHaveValue(""));
    fireEvent.click(screen.getByRole("button", { name: "Confirm and save" }));

    await screen.findByText("Expense saved.");
    const saveCall = fetchMock.mock.calls.find(([url]) => url === "/api/expenses")!;
    expect(JSON.parse(saveCall[1]?.body as string)).toMatchObject({ status: "needs_review", allocations: [] });
  });

  it("persists a newly added person and uses their database ID in the split", async () => {
    const fetchMock = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      if (url === "/api/groups") return Promise.resolve(new Response(JSON.stringify({ groups: [] }), { status: 200 }));
      if (url === "/api/people" && init?.method === "POST") return Promise.resolve(new Response(JSON.stringify({ person: { id: "navi-id", persistedId: "navi-id", name: "Navi" } }), { status: 201 }));
      if (url === "/api/people") return Promise.resolve(new Response(JSON.stringify({ people: [{ id: "me", name: "Me" }] }), { status: 200 }));
      return Promise.resolve(new Response(JSON.stringify({ id: "expense-1" }), { status: 201 }));
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<ExpenseEntry initialText="Dinner ₹100" />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/people"));
    fireEvent.click(screen.getByRole("button", { name: "Create draft" }));

    fireEvent.change(await screen.findByLabelText("Participant name"), { target: { value: "Navi" } });
    fireEvent.click(screen.getByRole("button", { name: "Add person" }));
    expect(await screen.findByRole("checkbox", { name: "Navi" })).toBeChecked();
    fireEvent.click(screen.getByRole("button", { name: "Split equally" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm and save" }));

    await screen.findByText("Expense saved.");
    const personCall = fetchMock.mock.calls.find(([url, init]) => url === "/api/people" && init?.method === "POST")!;
    expect(JSON.parse(personCall[1]?.body as string)).toEqual({ name: "Navi" });
    const saveCall = fetchMock.mock.calls.find(([url]) => url === "/api/expenses")!;
    expect(JSON.parse(saveCall[1]?.body as string).allocations).toEqual([
      { personId: "me", amountPaise: 5000 },
      { personId: "navi-id", amountPaise: 5000 },
    ]);
  });

  it("blocks saving an expense older than six months and asks for a corrected date", async () => {
    const fetchMock = vi.fn().mockImplementation((url: string) => Promise.resolve(new Response(JSON.stringify(url === "/api/groups" ? { groups: [] } : { people: [{ id: "me", name: "Me" }] }), { status: 200 })));
    vi.stubGlobal("fetch", fetchMock);
    render(<ExpenseEntry initialText="Dinner ₹100" />);
    fireEvent.click(screen.getByRole("button", { name: "Create draft" }));

    fireEvent.change(await screen.findByLabelText("Date"), { target: { value: "2024-08-07" } });
    fireEvent.click(screen.getByRole("button", { name: "Only me" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm and save" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Expense date must be within the last 6 months. Correct the date before saving.");
    expect(fetchMock.mock.calls.some(([url]) => url === "/api/expenses")).toBe(false);
  });
});
