import { describe, expect, it } from "vitest";
import {
  calculateTotal,
  formatCurrency,
  formatDate,
  getDaysInMonth,
} from "./expenseUtils";
import { Expense } from "../types";

const expense = (amount: number): Expense => ({
  id: amount,
  amount,
  description: "Test expense",
  category: "Other",
  date: "2026-07-31",
  created_at: "2026-07-31T00:00:00Z",
  updated_at: "2026-07-31T00:00:00Z",
});

describe("expense utilities", () => {
  it("calculates and formats monetary totals", () => {
    expect(calculateTotal([expense(10.5), expense(4.25)])).toBe(14.75);
    expect(formatCurrency(14.75)).toBe("$14.75");
  });

  it("formats local calendar dates without dropping leading zeroes", () => {
    expect(formatDate(new Date(2026, 0, 5))).toBe("2026-01-05");
  });

  it("handles leap years when calculating month length", () => {
    expect(getDaysInMonth(2024, 2)).toBe(29);
    expect(getDaysInMonth(2025, 2)).toBe(28);
  });
});
