import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { GroupManager } from "./group-manager";

afterEach(() => vi.unstubAllGlobals());

describe("GroupManager", () => {
  it("creates a group from individually managed members", async () => {
    const group = { id: "group-1", name: "Flatmates", people: [{ id: "me", name: "Me" }, { id: "person-1", name: "Rahul" }] };
    const fetchMock = vi.fn().mockImplementation((_url: string, init?: RequestInit) => Promise.resolve(new Response(JSON.stringify(init?.method === "POST" ? { group } : { groups: [] }), { status: init?.method === "POST" ? 201 : 200, headers: { "content-type": "application/json" } })));
    vi.stubGlobal("fetch", fetchMock);
    const onCreated = vi.fn();
    render(<GroupManager onCreated={onCreated} />);

    fireEvent.change(screen.getByLabelText("Group name"), { target: { value: "Flatmates" } });
    fireEvent.change(screen.getByLabelText("New member"), { target: { value: "Rahul" } });
    fireEvent.click(screen.getByRole("button", { name: "Add member" }));
    expect(screen.getByRole("button", { name: "Remove Rahul" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Save group" }));

    await waitFor(() => expect(onCreated).toHaveBeenCalledWith(group));
    const post = fetchMock.mock.calls.find(([, init]) => init?.method === "POST")!;
    expect(JSON.parse(post[1]?.body as string)).toEqual({ name: "Flatmates", memberNames: ["Me", "Rahul"] });
    expect(await screen.findByText("Flatmates")).toBeInTheDocument();
  });

  it("allows Me to be excluded", () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ groups: [] }), { status: 200 })));
    render(<GroupManager />);
    fireEvent.click(screen.getByRole("button", { name: "Remove Me" }));
    expect(screen.queryByRole("button", { name: "Remove Me" })).not.toBeInTheDocument();
  });
});
