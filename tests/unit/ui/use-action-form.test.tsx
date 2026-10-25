import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { useActionForm } from "@bahayplus/ui/hooks/use-action-form";

const Schema = z.object({
  name: z.string().trim().min(1, "Required"),
  barangay: z
    .string()
    .trim()
    .default("")
    .transform((v) => v || null),
});

function Harness({
  action,
}: {
  action: (
    v: unknown,
  ) => Promise<
    | { ok: true; data: undefined }
    | { ok: false; error: { code: "VALIDATION_FAILED"; message: string; fieldErrors?: Record<string, string> } }
  >;
}) {
  const { form, onSubmit, formError } = useActionForm({
    schema: Schema,
    defaultValues: { name: "", barangay: "" },
    action,
  });
  return (
    <form onSubmit={onSubmit}>
      <input aria-label="name" {...form.register("name")} />
      <input aria-label="barangay" {...form.register("barangay")} />
      {form.formState.errors.name && <p role="alert">{form.formState.errors.name.message}</p>}
      {formError && <p role="status">{formError}</p>}
      <button type="submit">Save</button>
    </form>
  );
}

describe("useActionForm", () => {
  it("validates on the client and sends the RAW input (transforms run once, on the server)", async () => {
    const action = vi.fn().mockResolvedValue({ ok: true, data: undefined });
    render(<Harness action={action} />);
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Required");
    expect(action).not.toHaveBeenCalled();
    await userEvent.type(screen.getByLabelText("name"), "  Home ");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(action).toHaveBeenCalledWith({ name: "  Home ", barangay: "" }));
    // The raw value is still valid input for the server-side parse.
    expect(Schema.parse(action.mock.calls[0]![0])).toEqual({ name: "Home", barangay: null });
  });

  it("shows server errors that don't map to a field", async () => {
    const action = vi
      .fn()
      .mockResolvedValue({ ok: false, error: { code: "VALIDATION_FAILED", message: "Server says no." } });
    render(<Harness action={action} />);
    await userEvent.type(screen.getByLabelText("name"), "x");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Server says no.");
  });
});
