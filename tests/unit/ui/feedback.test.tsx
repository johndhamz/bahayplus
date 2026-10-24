import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ConfirmationDialog } from "@bahayplus/ui/components/feedback/confirmation-dialog";
import { EmptyState } from "@bahayplus/ui/components/feedback/empty-state";
import { ErrorState } from "@bahayplus/ui/components/feedback/error-state";
import { LoadingSkeleton } from "@bahayplus/ui/components/feedback/loading-skeleton";
import { SampleDataBadge, SampleDataNotice } from "@bahayplus/ui/components/feedback/sample-data";
import { humanizeStatus, StatusBadge } from "@bahayplus/ui/components/feedback/status-badge";
import { Button } from "@bahayplus/ui/components/ui/button";

describe("EmptyState", () => {
  it("renders title, description and action as a status region", () => {
    render(<EmptyState title="No pets yet" description="Add your first pet." action={<button>Add pet</button>} />);
    const region = screen.getByRole("status");
    expect(region).toHaveTextContent("No pets yet");
    expect(region).toHaveTextContent("Add your first pet.");
    expect(screen.getByRole("button", { name: "Add pet" })).toBeInTheDocument();
  });
});

describe("ErrorState", () => {
  it("announces as an alert, shows a reference and retries", async () => {
    const onRetry = vi.fn();
    render(<ErrorState reference="abc123" onRetry={onRetry} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Something went wrong");
    expect(screen.getByText(/abc123/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /try again/i }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("omits the retry button when no handler is given", () => {
    render(<ErrorState />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});

describe("LoadingSkeleton", () => {
  it.each(["cards", "list", "table", "page", "stats"] as const)("%s variant is busy and labelled", (variant) => {
    render(<LoadingSkeleton variant={variant} label="Loading bills…" />);
    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("aria-busy", "true");
    expect(status).toHaveTextContent("Loading bills…");
  });
});

describe("StatusBadge", () => {
  it("maps known statuses to tones and humanizes labels", () => {
    render(<StatusBadge status="partially_paid" />);
    const badge = screen.getByText("Partially paid").closest("[data-status]");
    expect(badge).toHaveAttribute("data-tone", "warning");
  });

  it("falls back to neutral for unknown statuses", () => {
    render(<StatusBadge status="brand_new_state" />);
    expect(screen.getByText("Brand new state").closest("[data-status]")).toHaveAttribute("data-tone", "neutral");
  });

  it("supports explicit tone and label", () => {
    render(<StatusBadge status="x" tone="danger" label="Blocked" />);
    expect(screen.getByText("Blocked").closest("[data-status]")).toHaveAttribute("data-tone", "danger");
    expect(humanizeStatus("under_review")).toBe("Under review");
  });
});

describe("Sample data markers", () => {
  it("are visibly labelled and machine-detectable", () => {
    render(
      <>
        <SampleDataBadge />
        <SampleDataNotice />
      </>,
    );
    expect(screen.getByText("Sample data")).toBeInTheDocument();
    expect(screen.getByRole("note")).toHaveTextContent(/sample data only/i);
    expect(document.querySelectorAll('[data-sample-data="true"]')).toHaveLength(2);
  });
});

describe("ConfirmationDialog", () => {
  it("opens from its trigger and confirms", async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    render(
      <ConfirmationDialog
        title="Archive property?"
        description="You can restore it later."
        confirmLabel="Archive"
        tone="destructive"
        onConfirm={onConfirm}
        trigger={<Button>Archive</Button>}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Archive" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveTextContent("Archive property?");
    await userEvent.click(screen.getAllByRole("button", { name: "Archive" }).at(-1)!);
    expect(onConfirm).toHaveBeenCalledOnce();
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
  });

  it("stays open when the action returns false", async () => {
    render(
      <ConfirmationDialog
        title="Remove member?"
        description="They lose access."
        confirmLabel="Remove"
        onConfirm={() => false}
        open
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Remove" }));
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
  });

  it("shows an error and stays open when the action throws", async () => {
    render(
      <ConfirmationDialog
        title="Delete?"
        description="Permanent."
        confirmLabel="Delete"
        onConfirm={async () => {
          throw new Error("boom");
        }}
        open
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/didn't work/i);
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
  });

  it("cancels without calling the action", async () => {
    const onConfirm = vi.fn();
    const onOpenChange = vi.fn();
    render(<ConfirmationDialog title="T" description="D" onConfirm={onConfirm} open onOpenChange={onOpenChange} />);
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onConfirm).not.toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
