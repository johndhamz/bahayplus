import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Droplets } from "lucide-react";
import { useForm } from "react-hook-form";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { formatRating, ProviderCard } from "@bahayplus/ui/components/domain/provider-card";
import { ServiceCard } from "@bahayplus/ui/components/domain/service-card";
import { FormAlert } from "@bahayplus/ui/components/forms/form-alert";
import { FieldShell, FormField } from "@bahayplus/ui/components/forms/form-field";
import { SubmitButton } from "@bahayplus/ui/components/forms/submit-button";
import { Input } from "@bahayplus/ui/components/ui/input";
import { zodResolver } from "@bahayplus/ui/lib/zod-resolver";

const Schema = z.object({ name: z.string().min(2, "Enter at least 2 characters.") });

function NameForm() {
  const form = useForm<z.input<typeof Schema>, unknown, z.output<typeof Schema>>({
    resolver: zodResolver(Schema),
    defaultValues: { name: "" },
  });
  return (
    <form onSubmit={form.handleSubmit(() => undefined)} noValidate>
      <FormField control={form.control} name="name" label="Household name" required description="Shown to members.">
        {(field, a11y) => <Input {...field} {...a11y} />}
      </FormField>
      <button type="submit">Save</button>
    </form>
  );
}

describe("FormField", () => {
  it("links label, description and input", () => {
    render(<NameForm />);
    const input = screen.getByRole("textbox", { name: /household name/i });
    expect(input).toHaveAttribute("aria-invalid", "false");
    expect(input).toHaveAccessibleDescription("Shown to members.");
    expect(input).toHaveAttribute("aria-required", "true");
  });

  it("shows validation errors from the Zod contract and marks the input invalid", async () => {
    render(<NameForm />);
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    const input = screen.getByRole("textbox", { name: /household name/i });
    expect(await screen.findByRole("alert")).toHaveTextContent("Enter at least 2 characters.");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription("Enter at least 2 characters.");
  });

  it("FieldShell marks optional fields", () => {
    render(
      <FieldShell id="x" label="Notes">
        <input id="x" />
      </FieldShell>,
    );
    expect(screen.getByText("(optional)")).toBeInTheDocument();
  });
});

describe("FormAlert & SubmitButton", () => {
  it("renders nothing without a message", () => {
    const { container } = render(<FormAlert message={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("uses alert role for errors and status for success", () => {
    render(
      <>
        <FormAlert message="Failed" />
        <FormAlert message="Saved" tone="success" />
      </>,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Failed");
    expect(screen.getByRole("status")).toHaveTextContent("Saved");
  });

  it("disables and labels the submit button while pending", () => {
    render(
      <SubmitButton pending pendingLabel="Saving…">
        Save
      </SubmitButton>,
    );
    const button = screen.getByRole("button", { name: "Saving…" });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
  });
});

describe("ServiceCard", () => {
  it("renders a tile link", () => {
    render(<ServiceCard variant="tile" name="Plumbing" icon={Droplets} href="/app/services?category=plumbing" />);
    expect(screen.getByRole("link", { name: "Plumbing" })).toHaveAttribute("href", "/app/services?category=plumbing");
  });

  it("renders a row with division and urgent availability", () => {
    render(
      <ServiceCard
        name="Plumbing"
        icon={Droplets}
        href="/x"
        division="Home Services"
        description="Leaks"
        urgentEligible
      />,
    );
    const link = screen.getByRole("link");
    expect(link).toHaveTextContent("Home Services");
    expect(link).toHaveTextContent("Urgent help available");
  });
});

describe("ProviderCard", () => {
  it("states exactly what was verified", () => {
    render(
      <ProviderCard
        name="Acme Plumbing"
        href="/p/acme"
        verification={{ status: "verified", items: ["DTI registration", "Mayor's permit"] }}
        rating={{ averageTenths: 47, count: 12 }}
        categories={["Plumbing"]}
        serviceArea="Quezon City"
      />,
    );
    expect(screen.getByRole("heading", { name: "Acme Plumbing" })).toBeInTheDocument();
    expect(screen.getByText("Verified by Bahay+")).toBeInTheDocument();
    expect(screen.getByText(/Checked: DTI registration, Mayor's permit/)).toBeInTheDocument();
    expect(screen.getByText("4.7")).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Services offered" })).toHaveTextContent("Plumbing");
  });

  it("never invents ratings or verification", () => {
    render(<ProviderCard name="New Co" href="/p/new" verification={{ status: "unverified" }} rating={null} />);
    expect(screen.getByText("No reviews yet")).toBeInTheDocument();
    expect(screen.getByText("Not yet verified")).toBeInTheDocument();
    expect(screen.queryByText(/Verified by/)).not.toBeInTheDocument();
  });

  it("formats tenths without float math", () => {
    expect(formatRating(50)).toBe("5.0");
    expect(formatRating(43)).toBe("4.3");
  });
});
