/**
 * API service for communicating with the backend
 */

import { Category, Expense, ExpenseFormData } from "../types";

const configuredApiOrigin = (
  import.meta.env.VITE_API_URL || "http://localhost:3000"
).replace(/\/+$/, "");
const API_BASE_URL = configuredApiOrigin.endsWith("/api")
  ? configuredApiOrigin
  : `${configuredApiOrigin}/api`;

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function requestJson<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, options);

  if (!response.ok) {
    let message = "Request failed. Please try again.";
    try {
      const payload = (await response.json()) as { errors?: string[] };
      if (payload.errors?.length) message = payload.errors.join(". ");
    } catch {
      // Preserve the safe fallback when the server does not return JSON.
    }
    throw new ApiError(message, response.status);
  }

  return response.json() as Promise<T>;
}

export async function fetchExpenses(): Promise<Expense[]> {
  return requestJson<Expense[]>("/expenses");
}

export async function getExpenses(
  year: number,
  month: number,
): Promise<Expense[]> {
  return requestJson<Expense[]>(
    `/expenses?year=${encodeURIComponent(year)}&month=${encodeURIComponent(month)}`,
  );
}

export async function fetchCategories(): Promise<Category[]> {
  return requestJson<Category[]>("/categories");
}

export async function createCategory(name: string): Promise<Category> {
  return requestJson<Category>("/categories", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ category: { name } }),
  });
}

export async function createExpense(data: ExpenseFormData): Promise<Expense> {
  return requestJson<Expense>("/expenses", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      expense: {
        description: data.description,
        amount: data.amount,
        category_id: Number(data.categoryId),
        date: data.date,
      },
    }),
  });
}

export async function updateExpense(
  id: number,
  data: Partial<ExpenseFormData>,
): Promise<Expense> {
  const expense = {
    ...(data.description !== undefined && { description: data.description }),
    ...(data.amount !== undefined && { amount: data.amount }),
    ...(data.categoryId !== undefined && {
      category_id: Number(data.categoryId),
    }),
    ...(data.date !== undefined && { date: data.date }),
  };

  return requestJson<Expense>(`/expenses/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ expense }),
  });
}

export async function deleteExpense(id: number): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/expenses/${id}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    throw new ApiError("Failed to delete expense", response.status);
  }
}
