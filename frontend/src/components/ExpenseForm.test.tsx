import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ApiError } from "../services/api";
import { formatDate } from "../utils/expenseUtils";
import { ExpenseForm } from "./ExpenseForm";

const categories = [
  { id: 1, name: "Food" },
  { id: 7, name: "Subscriptions" },
];

describe("ExpenseForm", () => {
  const today = formatDate(new Date());
  const offsetDate = (days: number) => {
    const value = new Date();
    value.setDate(value.getDate() + days);
    return formatDate(value);
  };

  function renderForm(onSubmit = vi.fn().mockResolvedValue(undefined)) {
    const result = render(
      <ExpenseForm categories={categories} onSubmit={onSubmit} />,
    );
    const dateInput = result.container.querySelector(
      'input[type="date"]',
    ) as HTMLInputElement;
    const form = result.container.querySelector("form") as HTMLFormElement;

    return { ...result, dateInput, form, onSubmit };
  }

  function fillRequiredFields(dateInput: HTMLInputElement) {
    fireEvent.change(screen.getByLabelText("Amount"), {
      target: { value: "25" },
    });
    fireEvent.change(screen.getByLabelText("Description"), {
      target: { value: "Lunch" },
    });
    fireEvent.change(screen.getByLabelText("Category"), {
      target: { value: "1" },
    });
    fireEvent.change(dateInput, { target: { value: today } });
  }

  it("submits the stable category identifier", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<ExpenseForm categories={categories} onSubmit={onSubmit} />);

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
    expect(screen.getByLabelText("Amount")).toHaveValue(25);
    expect(screen.getByLabelText("Description")).toHaveValue("Lunch");
    expect(dateInput).toHaveValue(today);
    expect(screen.getByRole("button", { name: "Add Expense" })).toBeEnabled();
  });
});
