import { afterEach, describe, expect, it, vi } from "vitest";
import { updateExpense } from "./api";

describe("expense API validation errors", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("preserves structured Rails validation messages for the form", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({ errors: ["Date cannot be in the future"] }),
          {
            status: 422,
            headers: { "Content-Type": "application/json" },
          },
        ),
      ),
    );

    await expect(
      updateExpense(42, { date: "2026-08-01" }),
    ).rejects.toMatchObject({
      name: "ApiError",
      message: "Date cannot be in the future",
      status: 422,
    });
  });
});
