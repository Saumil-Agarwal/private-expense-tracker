import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { SplitEditor } from "./split-editor";

describe("SplitEditor", () => {
  it("emits a personal allocation", () => {
    const onChange = vi.fn();
    render(<SplitEditor amountPaise={240000} people={[{ id: "me", name: "Me" }]} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Only me" }));
    expect(onChange).toHaveBeenLastCalledWith({ status: "confirmed", allocations: [{ personId: "me", amountPaise: 240000 }] });
  });

  it("can mark a split unresolved", () => {
    const onChange = vi.fn();
    render(<SplitEditor amountPaise={420000} people={[{ id: "me", name: "Me" }]} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Decide later" }));
    expect(onChange).toHaveBeenLastCalledWith({ status: "needs_review", allocations: [] });
  });

  it("adds a participant and splits equally", () => {
    const onChange = vi.fn();
    render(<SplitEditor amountPaise={10000} people={[{ id: "me", name: "Me" }]} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText("Participant name"), { target: { value: "Rahul" } });
    fireEvent.click(screen.getByRole("button", { name: "Add person" }));
    fireEvent.click(screen.getByRole("button", { name: "Split equally" }));
    expect(onChange).toHaveBeenLastCalledWith({ status: "confirmed", allocations: [{ personId: "me", amountPaise: 5000 }, { personId: "name:Rahul", amountPaise: 5000 }] });
  });

  it("allows Me to be explicitly excluded from an equal split", () => {
    const onChange = vi.fn();
    render(<SplitEditor amountPaise={10001} people={[{ id: "me", name: "Me" }, { id: "name:Rahul", name: "Rahul" }, { id: "name:Jo", name: "Jo" }]} onChange={onChange} />);
    expect(screen.getByRole("checkbox", { name: "Me" })).toBeChecked();
    fireEvent.click(screen.getByRole("checkbox", { name: "Me" }));
    fireEvent.click(screen.getByRole("button", { name: "Split equally" }));
    expect(onChange).toHaveBeenLastCalledWith({ status: "confirmed", allocations: [
      { personId: "name:Rahul", amountPaise: 5001 },
      { personId: "name:Jo", amountPaise: 5000 },
    ] });
  });

  it("assigns Only me to the owner even when Me is not first", () => {
    const onChange = vi.fn();
    render(<SplitEditor amountPaise={10000} people={[{ id: "name:Rahul", name: "Rahul" }, { id: "me", name: "Me" }]} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Only me" }));
    expect(onChange).toHaveBeenLastCalledWith({ status: "confirmed", allocations: [{ personId: "me", amountPaise: 10000 }] });
  });

  it("still assigns Only me to the stable owner when the selected group excludes Me", () => {
    const onChange = vi.fn();
    render(<SplitEditor amountPaise={10000} people={[{ id: "name:Rahul", name: "Rahul" }]} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Only me" }));
    expect(onChange).toHaveBeenLastCalledWith({ status: "confirmed", allocations: [{ personId: "me", amountPaise: 10000 }] });
  });
});
