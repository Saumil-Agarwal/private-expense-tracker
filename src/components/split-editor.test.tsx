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
});
