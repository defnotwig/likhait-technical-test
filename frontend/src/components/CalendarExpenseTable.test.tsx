import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CalendarExpenseTable } from "./CalendarExpenseTable";
import { updateExpense } from "../services/api";

vi.mock("../services/api", () => ({
  deleteExpense: vi.fn(),
  updateExpense: vi.fn(),
}));

describe("CalendarExpenseTable", () => {
  beforeEach(() => {
    vi.mocked(updateExpense).mockReset();
    vi.mocked(updateExpense).mockResolvedValue({
      id: 42,
      amount: 25,
      description: "Train",
      category_id: 7,
      category: "Subscriptions",
      date: "2026-07-30",
      created_at: "2026-07-30T12:00:00Z",
      updated_at: "2026-07-30T12:00:00Z",
    });
  });

  it("updates an existing expense using the selected category id", async () => {
    const user = userEvent.setup();
    const onExpenseUpdated = vi.fn();

    render(
      <CalendarExpenseTable
        expenses={[
          {
            id: 42,
            amount: 25,
            description: "Train",
            category_id: 2,
            category: "Transport",
            date: "2026-07-30",
            created_at: "2026-07-30T12:00:00Z",
            updated_at: "2026-07-30T12:00:00Z",
          },
        ]}
        categories={[
          { id: 2, name: "Transport" },
          { id: 7, name: "Subscriptions" },
        ]}
        onExpenseUpdated={onExpenseUpdated}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Edit" }));
    await user.selectOptions(screen.getByLabelText("Category"), "7");
    await user.click(screen.getByRole("button", { name: "Update Expense" }));

    expect(updateExpense).toHaveBeenCalledWith(
      42,
      expect.objectContaining({ categoryId: "7", date: "2026-07-30" }),
    );
    expect(onExpenseUpdated).toHaveBeenCalledOnce();
  });
});
