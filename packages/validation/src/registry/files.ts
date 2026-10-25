import { z } from "zod";
import { Uuid } from "../common/primitives";

export const ALLOWED_FILE_TYPES = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "application/pdf": "pdf",
} as const;
export type AllowedFileType = keyof typeof ALLOWED_FILE_TYPES;
export const MAX_FILE_BYTES = 10 * 1024 * 1024;

export const FILE_ENTITY_TYPES = [
  "asset",
  "pet",
  "pet_health",
  "vehicle",
  "bill",
  "bill_payment",
  "service_request",
  "project",
  "work_order",
] as const;
export type FileEntityType = (typeof FILE_ENTITY_TYPES)[number];
export const FILE_PURPOSES = [
  "photo",
  "receipt",
  "manual",
  "warranty",
  "vet_record",
  "document",
  "statement",
  "before_photo",
  "after_photo",
  "evidence",
  "other",
] as const;

export const PrepareUploadInput = z.object({
  householdId: Uuid,
  entityType: z.enum(FILE_ENTITY_TYPES),
  entityId: Uuid,
  purpose: z.enum(FILE_PURPOSES),
  fileName: z.string().trim().min(1).max(200),
  contentType: z.enum(Object.keys(ALLOWED_FILE_TYPES) as [AllowedFileType, ...AllowedFileType[]], {
    message: "Upload a JPG, PNG, WEBP, HEIC image or a PDF.",
  }),
  sizeBytes: z.number().int().positive("The file is empty.").max(MAX_FILE_BYTES, "Files must be 10 MB or smaller."),
});
export type PrepareUploadInput = z.input<typeof PrepareUploadInput>;

export const RegisterFileInput = PrepareUploadInput.extend({ objectPath: z.string().min(10).max(400) });
export type RegisterFileInput = z.input<typeof RegisterFileInput>;
export const FileIdInput = z.object({ fileId: Uuid });

/** Safe display name: strips paths and control characters. */
export function sanitizeFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "file";
  return base.replace(/[\u0000-\u001f\u007f]/g, "").slice(0, 200) || "file";
}

export const ORG_FILE_ENTITY_TYPES = ["verification_item", "portfolio"] as const;
export type OrgFileEntityType = (typeof ORG_FILE_ENTITY_TYPES)[number];

export const PrepareOrgUploadInput = z.object({
  organizationId: Uuid,
  entityType: z.enum(ORG_FILE_ENTITY_TYPES),
  entityId: Uuid,
  fileName: z.string().trim().min(1).max(200),
  contentType: z.enum(Object.keys(ALLOWED_FILE_TYPES) as [AllowedFileType, ...AllowedFileType[]], {
    message: "Upload a JPG, PNG, WEBP, HEIC image or a PDF.",
  }),
  sizeBytes: z.number().int().positive("The file is empty.").max(MAX_FILE_BYTES, "Files must be 10 MB or smaller."),
});
export type PrepareOrgUploadInput = z.input<typeof PrepareOrgUploadInput>;
export const RegisterOrgFileInput = PrepareOrgUploadInput.extend({ objectPath: z.string().min(10).max(400) });
