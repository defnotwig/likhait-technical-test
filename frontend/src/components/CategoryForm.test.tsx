import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { CategoryForm } from "./CategoryForm";

describe("CategoryForm", () => {
  it("validates a blank name before submitting", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(<CategoryForm onSubmit={onSubmit} onCancel={vi.fn()} />);
    await user.type(screen.getByRole("textbox", { name: "Category name" }), "   ");
    await user.click(screen.getByRole("button", { name: "Create Category" }));

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Category name is required",
    );
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("normalizes the name and preserves it when the server rejects it", async () => {
    const user = userEvent.setup();
    const onSubmit = vi
      .fn<(name: string) => Promise<void>>()
      .mockRejectedValue(new Error("Name has already been taken"));

    render(<CategoryForm onSubmit={onSubmit} onCancel={vi.fn()} />);
    const input = screen.getByRole("textbox", { name: "Category name" });
    await user.type(input, "  Subscriptions  ");
    await user.click(screen.getByRole("button", { name: "Create Category" }));

    expect(onSubmit).toHaveBeenCalledWith("Subscriptions");
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Name has already been taken",
    );
    expect(input).toHaveValue("  Subscriptions  ");
  });
});
