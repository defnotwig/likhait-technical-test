import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ApiError } from "../services/api";
import { formatDate } from "../utils/expenseUtils";
import { ExpenseForm } from "./ExpenseForm";

describe("ExpenseForm future-date protection", () => {
  const today = formatDate(new Date());
  const offsetDate = (days: number) => {
    const value = new Date();
    value.setDate(value.getDate() + days);
    return formatDate(value);
  };

  function renderForm(onSubmit = vi.fn().mockResolvedValue(undefined)) {
    const result = render(<ExpenseForm onSubmit={onSubmit} />);
    const dateInput = result.container.querySelector(
      'input[type="date"]',
    ) as HTMLInputElement;
    const form = result.container.querySelector("form") as HTMLFormElement;

    return { ...result, dateInput, form, onSubmit };
  }

  function fillRequiredFields(dateInput: HTMLInputElement) {
    fireEvent.change(screen.getByPlaceholderText("0.00"), {
      target: { value: "25" },
    });
    fireEvent.change(screen.getByPlaceholderText("Enter description"), {
      target: { value: "Lunch" },
    });
    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: "Food" },
    });
    fireEvent.change(dateInput, { target: { value: today } });
  }

  it("defaults and caps the date at the browser's local today", () => {
    const { dateInput } = renderForm();

    expect(dateInput).toHaveValue(today);
    expect(dateInput).toHaveAttribute("max", today);
  });

  it("blocks a manually supplied future date before calling the API", async () => {
    const { dateInput, form, onSubmit } = renderForm();
    fillRequiredFields(dateInput);
    fireEvent.change(dateInput, { target: { value: offsetDate(1) } });

    fireEvent.submit(form);

    expect(
      await screen.findByText("Expense date cannot be in the future"),
    ).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("allows yesterday and today", async () => {
    const first = renderForm();
    fillRequiredFields(first.dateInput);
    fireEvent.change(first.dateInput, { target: { value: offsetDate(-1) } });
    fireEvent.submit(first.form);
    await waitFor(() => expect(first.onSubmit).toHaveBeenCalledOnce());

    first.unmount();
    const second = renderForm();
    fillRequiredFields(second.dateInput);
    fireEvent.submit(second.form);
    await waitFor(() => expect(second.onSubmit).toHaveBeenCalledOnce());
  });

  it("preserves values, shows server errors, and re-enables submit", async () => {
    const onSubmit = vi
      .fn()
      .mockRejectedValue(new ApiError("Date cannot be in the future", 422));
    const { dateInput, form } = renderForm(onSubmit);
    fillRequiredFields(dateInput);

    fireEvent.submit(form);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Date cannot be in the future",
    );
    expect(screen.getByPlaceholderText("0.00")).toHaveValue(25);
    expect(screen.getByPlaceholderText("Enter description")).toHaveValue(
      "Lunch",
    );
    expect(dateInput).toHaveValue(today);
    expect(screen.getByRole("button", { name: "Add Expense" })).toBeEnabled();
  });
});
