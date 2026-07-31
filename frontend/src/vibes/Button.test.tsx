import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Button } from "./Button";

describe("Button", () => {
  it("renders an accessible button and invokes its handler", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();

    render(<Button onClick={onClick}>Save</Button>);
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(onClick).toHaveBeenCalledOnce();
  });
});
