"use client";

import { Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { FormAlert } from "@bahayplus/ui/components/forms/form-alert";
import { Button } from "@bahayplus/ui/components/ui/button";
import {
  ALLOWED_FILE_TYPES,
  FILE_PURPOSES,
  MAX_FILE_BYTES,
  type FileEntityType,
} from "@bahayplus/validation/registry/files";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { prepareUploadAction, registerFileAction, setPetPhotoAction } from "@/lib/actions/registry";

type Props = {
  householdId: string;
  entityType: FileEntityType;
  entityId: string;
  purpose: (typeof FILE_PURPOSES)[number];
  label?: string;
  imagesOnly?: boolean;
  /** When set, the uploaded image becomes this pet's photo. */
  setAsPetPhoto?: string;
};

/**
 * Uploads directly to the private bucket (Storage RLS checks the path), then asks the server to
 * verify and register the file. Client checks here are only for fast feedback.
 */
export function FileUpload({
  householdId,
  entityType,
  entityId,
  purpose,
  label = "Upload file",
  imagesOnly,
  setAsPetPhoto,
}: Props) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const types = Object.keys(ALLOWED_FILE_TYPES).filter((t) => !imagesOnly || t.startsWith("image/"));

  const onFile = (file: File) => {
    setError(null);
    if (!types.includes(file.type))
      return setError(
        imagesOnly ? "Choose a JPG, PNG, WEBP or HEIC image." : "Choose a JPG, PNG, WEBP, HEIC image or a PDF.",
      );
    if (file.size > MAX_FILE_BYTES) return setError("Files must be 10 MB or smaller.");
    startTransition(async () => {
      const meta = {
        householdId,
        entityType,
        entityId,
        purpose,
        fileName: file.name,
        contentType: file.type,
        sizeBytes: file.size,
      };
      const prepared = await prepareUploadAction(meta);
      if (!prepared.ok) return setError(prepared.error.message);
      const { error: uploadError } = await getSupabaseBrowserClient()
        .storage.from("household-files")
        .upload(prepared.data.objectPath, file, { contentType: file.type, upsert: false });
      if (uploadError) return setError("Upload failed. Check your connection and try again.");
      const registered = await registerFileAction({ ...meta, objectPath: prepared.data.objectPath });
      if (!registered.ok) return setError(registered.error.message);
      if (setAsPetPhoto) await setPetPhotoAction({ petId: setAsPetPhoto, fileId: registered.data.fileId });
      toast.success("Uploaded.");
      if (inputRef.current) inputRef.current.value = "";
      router.refresh();
    });
  };

  return (
    <div className="flex flex-col gap-2">
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept={types.join(",")}
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFile(file);
        }}
      />
      <Button
        type="button"
        variant="outline"
        disabled={pending}
        aria-busy={pending}
        onClick={() => inputRef.current?.click()}
        className="w-fit"
      >
        <Upload aria-hidden="true" />
        {pending ? "Uploading…" : label}
      </Button>
      <p className="text-xs text-muted-foreground">
        {imagesOnly ? "JPG, PNG, WEBP or HEIC" : "JPG, PNG, WEBP, HEIC or PDF"}, up to 10 MB. Files are private to your
        household.
      </p>
      <FormAlert message={error} />
    </div>
  );
}
