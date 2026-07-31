import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ExpenseForm } from "./ExpenseForm";

describe("ExpenseForm", () => {
  it("submits the stable category identifier", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);

    render(
      <ExpenseForm
        categories={[
          { id: 1, name: "Food" },
          { id: 7, name: "Subscriptions" },
        ]}
        onSubmit={onSubmit}
      />,
    );

    await user.type(screen.getByLabelText("Amount"), "19.99");
    await user.type(screen.getByLabelText("Description"), "Music plan");
    await user.selectOptions(screen.getByLabelText("Category"), "7");
    await user.click(screen.getByRole("button", { name: "Add Expense" }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: "19.99",
        description: "Music plan",
        categoryId: "7",
      }),
    );
  });
});
