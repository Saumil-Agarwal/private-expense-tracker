import { render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

import PersonExpensesPage from "./page";

afterEach(() => vi.unstubAllGlobals());

it("decodes a multi-word person's name from the route", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ transactions: [] }), { status: 200, headers: { "content-type": "application/json" } })));

  render(await PersonExpensesPage({ params: Promise.resolve({ name: "Sanjeev%20bro" }) }));

  expect(screen.getByRole("heading", { name: "Sanjeev bro" })).toBeInTheDocument();
});
