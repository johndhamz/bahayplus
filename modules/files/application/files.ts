import {
  ALLOWED_FILE_TYPES,
  FileIdInput,
  MAX_FILE_BYTES,
  PrepareUploadInput,
  RegisterFileInput,
  sanitizeFileName,
  type FileEntityType,
} from "@bahayplus/validation/registry/files";
import { appError, err, ok, type Result } from "@bahayplus/types/result";
import { loadHouseholdAccess, mapDbError, parseInput, type ServiceContext } from "@bahayplus/modules/authorization";
import { detectFileType } from "../domain/signature";

export const HOUSEHOLD_BUCKET = "household-files";
const SIGNED_URL_SECONDS = 600;

const managePermission = (entity: FileEntityType) =>
  entity === "pet_health"
    ? "pet.health.manage"
    : entity === "bill" || entity === "bill_payment"
      ? "bills.manage"
      : "registry.manage";

export type FileView = {
  id: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  purpose: string;
  createdAt: string;
  /** Short-lived signed URL; never a public URL. */
  url: string | null;
};

/** Authorizes an upload and returns the only object path the caller may write to. */
export async function prepareUpload(ctx: ServiceContext, input: unknown): Promise<Result<{ objectPath: string }>> {
  const parsed = parseInput(PrepareUploadInput, input);
  if (!parsed.ok) return parsed;
  const v = parsed.value;
  const access = await loadHouseholdAccess(ctx, v.householdId);
  if (!access.ok) return access;
  if (!access.value.permissions.has(managePermission(v.entityType)))
    return err(appError.forbidden("You can't add files here."));
  const ext = ALLOWED_FILE_TYPES[v.contentType];
  return ok({ objectPath: `${v.householdId}/${v.entityType}/${v.entityId}/${crypto.randomUUID()}.${ext}` });
}

/**
 * Records an uploaded object after verifying it server-side: path ownership, real size, and the
 * file signature matching the declared type. Anything that fails is deleted from storage.
 */
export async function registerFile(ctx: ServiceContext, input: unknown): Promise<Result<{ fileId: string }>> {
  const parsed = parseInput(RegisterFileInput, input);
  if (!parsed.ok) return parsed;
  const v = parsed.value;
  const prefix = `${v.householdId}/${v.entityType}/${v.entityId}/`;
  if (!v.objectPath.startsWith(prefix) || v.objectPath.slice(prefix.length).includes("/")) {
    return err(appError.validation([{ path: ["objectPath"], message: "Invalid upload location." }]));
  }
  const bucket = ctx.db.storage.from(HOUSEHOLD_BUCKET);
  const reject = async (message: string) => {
    await bucket.remove([v.objectPath]);
    return err(appError.validation([{ path: ["file"], message }], message));
  };

  const download = await bucket.download(v.objectPath);
  if (download.error || !download.data) return err(appError.notFound("The uploaded file was not found."));
  const blob = download.data;
  if (blob.size === 0 || blob.size > MAX_FILE_BYTES) return reject("Files must be between 1 byte and 10 MB.");
  const head = new Uint8Array(await blob.slice(0, 16).arrayBuffer());
  const actual = detectFileType(head);
  if (!actual || actual !== v.contentType)
    return reject("The file's contents don't match its type. Upload a real JPG, PNG, WEBP, HEIC or PDF.");

  const { data, error } = await ctx.db
    .from("files")
    .insert({
      household_id: v.householdId,
      object_path: v.objectPath,
      entity_type: v.entityType,
      entity_id: v.entityId,
      purpose: v.purpose,
      file_name: sanitizeFileName(v.fileName),
      content_type: actual,
      size_bytes: blob.size,
    })
    .select("id")
    .single();
  if (error) {
    await bucket.remove([v.objectPath]);
    return err(mapDbError(error));
  }
  return ok({ fileId: data.id });
}

export async function listFiles(
  ctx: ServiceContext,
  entityType: FileEntityType,
  entityId: string,
): Promise<Result<FileView[]>> {
  const { data, error } = await ctx.db
    .from("files")
    .select("id, object_path, file_name, content_type, size_bytes, purpose, created_at")
    .eq("entity_type", entityType)
    .eq("entity_id", entityId)
    .order("created_at", { ascending: false });
  if (error) return err(mapDbError(error));
  const rows = data ?? [];
  const signed = rows.length
    ? await ctx.db.storage.from(HOUSEHOLD_BUCKET).createSignedUrls(
        rows.map((r) => r.object_path),
        SIGNED_URL_SECONDS,
      )
    : { data: [] as { path: string | null; signedUrl: string }[], error: null };
  const urls = new Map((signed.data ?? []).map((s) => [s.path, s.signedUrl]));
  return ok(
    rows.map((r) => ({
      id: r.id,
      fileName: r.file_name,
      contentType: r.content_type,
      sizeBytes: r.size_bytes,
      purpose: r.purpose,
      createdAt: r.created_at,
      url: urls.get(r.object_path) ?? null,
    })),
  );
}

export async function deleteFile(ctx: ServiceContext, input: unknown): Promise<Result<true>> {
  const parsed = parseInput(FileIdInput, input);
  if (!parsed.ok) return parsed;
  const { data, error } = await ctx.db.from("files").delete().eq("id", parsed.value.fileId).select("object_path");
  if (error) return err(mapDbError(error));
  if (!data || data.length === 0) return err(appError.notFound("File not found."));
  await ctx.db.storage.from(HOUSEHOLD_BUCKET).remove([data[0]!.object_path]);
  return ok(true);
}
