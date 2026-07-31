import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import HistoryPage from "./HistoryPage";
import {
  createCategory,
  fetchCategories,
  getExpenses,
} from "../services/api";

vi.mock("../services/api", () => ({
  createCategory: vi.fn(),
  createExpense: vi.fn(),
  deleteExpense: vi.fn(),
  fetchCategories: vi.fn(),
  getExpenses: vi.fn(),
  updateExpense: vi.fn(),
}));

describe("HistoryPage category management", () => {
  beforeEach(() => {
    vi.mocked(getExpenses).mockResolvedValue([]);
    vi.mocked(fetchCategories).mockResolvedValue([{ id: 1, name: "Food" }]);
    vi.mocked(createCategory).mockResolvedValue({
      id: 7,
      name: "Subscriptions",
    });
  });

  it("adds a category to the expense form without reloading", async () => {
    const user = userEvent.setup();
    render(<HistoryPage />);

    await screen.findByRole("button", { name: "Add Expense" });
    await user.click(screen.getByRole("button", { name: "Add Category" }));
    await user.type(screen.getByLabelText("Category name"), "Subscriptions");
    await user.click(screen.getByRole("button", { name: "Create Category" }));

    expect(
      await screen.findByText("Category Subscriptions created."),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Add Expense" }));

    expect(
      screen.getByRole("option", { name: "Subscriptions" }),
    ).toBeInTheDocument();
    expect(fetchCategories).toHaveBeenCalledOnce();
  });

  it("keeps expense creation unavailable when categories fail to load", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(fetchCategories).mockRejectedValueOnce(new Error("offline"));
    render(<HistoryPage />);

    expect(
      await screen.findByText("Unable to load categories. Please try again."),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Add Expense" })).toBeDisabled(),
    );
    expect(screen.getByRole("button", { name: "Retry" })).toBeEnabled();
    consoleError.mockRestore();
  });
});
