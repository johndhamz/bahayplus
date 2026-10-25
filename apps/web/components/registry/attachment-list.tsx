"use client";

import { FileText, ImageIcon, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { FileView } from "@bahayplus/modules/files";
import { ConfirmationDialog } from "@bahayplus/ui/components/feedback/confirmation-dialog";
import { Button } from "@bahayplus/ui/components/ui/button";
import { deleteFileAction } from "@/lib/actions/registry";

const sizeLabel = (bytes: number) =>
  bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;

export function AttachmentList({ files, canManage }: { files: FileView[]; canManage: boolean }) {
  const router = useRouter();
  if (files.length === 0) return <p className="text-sm text-muted-foreground">No files yet.</p>;
  return (
    <ul className="flex flex-col divide-y divide-border">
      {files.map((f) => {
        const Icon = f.contentType.startsWith("image/") ? ImageIcon : FileText;
        return (
          <li key={f.id} className="flex items-center gap-3 py-2">
            <Icon aria-hidden="true" className="size-5 shrink-0 text-brand" />
            <div className="min-w-0 flex-1">
              {f.url ? (
                <a
                  href={f.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block truncate text-sm font-medium hover:underline"
                >
                  {f.fileName}
                </a>
              ) : (
                <span className="block truncate text-sm">{f.fileName}</span>
              )}
              <span className="text-xs text-muted-foreground">
                {f.purpose.replace("_", " ")} · {sizeLabel(f.sizeBytes)}
              </span>
            </div>
            {canManage && (
              <ConfirmationDialog
                title={`Delete ${f.fileName}?`}
                description="The file is removed permanently."
                confirmLabel="Delete"
                tone="destructive"
                onConfirm={async () => {
                  const r = await deleteFileAction({ fileId: f.id });
                  if (!r.ok) {
                    toast.error(r.error.message);
                    return false;
                  }
                  toast.success("File deleted.");
                  router.refresh();
                }}
                trigger={
                  <Button variant="ghost" size="icon-sm" aria-label={`Delete ${f.fileName}`}>
                    <Trash2 aria-hidden="true" />
                  </Button>
                }
              />
            )}
          </li>
        );
      })}
    </ul>
  );
}
