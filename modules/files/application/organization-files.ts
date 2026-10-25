import {
  ALLOWED_FILE_TYPES,
  MAX_FILE_BYTES,
  PrepareOrgUploadInput,
  RegisterOrgFileInput,
  sanitizeFileName,
  type OrgFileEntityType,
} from "@bahayplus/validation/registry/files";
import { appError, err, ok, type Result } from "@bahayplus/types/result";
import { loadOrganizationAccess, mapDbError, parseInput, type ServiceContext } from "@bahayplus/modules/authorization";
import { detectFileType } from "../domain/signature";

const bucketFor = (entity: OrgFileEntityType) => (entity === "portfolio" ? "provider-portfolio" : "organization-files");

export type OrgFileView = {
  id: string;
  entityId: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  url: string | null;
};

export async function prepareOrgUpload(
  ctx: ServiceContext,
  input: unknown,
): Promise<Result<{ objectPath: string; bucket: string }>> {
  const parsed = parseInput(PrepareOrgUploadInput, input);
  if (!parsed.ok) return parsed;
  const v = parsed.value;
  if (v.entityType === "portfolio" && !v.contentType.startsWith("image/"))
    return err(appError.validation([{ path: ["file"], message: "Portfolio uploads must be images." }]));
  if (v.entityType === "portfolio" && v.contentType === "image/heic")
    return err(appError.validation([{ path: ["file"], message: "Use JPG, PNG or WEBP for portfolio photos." }]));
  const access = await loadOrganizationAccess(ctx, v.organizationId);
  if (!access.ok) return access;
  if (!access.value.permissions.has("organization.update"))
    return err(appError.forbidden("Only owners and managers can upload business files."));
  return ok({
    bucket: bucketFor(v.entityType),
    objectPath: `${v.organizationId}/${v.entityType}/${v.entityId}/${crypto.randomUUID()}.${ALLOWED_FILE_TYPES[v.contentType]}`,
  });
}

export async function registerOrgFile(ctx: ServiceContext, input: unknown): Promise<Result<{ fileId: string }>> {
  const parsed = parseInput(RegisterOrgFileInput, input);
  if (!parsed.ok) return parsed;
  const v = parsed.value;
  const prefix = `${v.organizationId}/${v.entityType}/${v.entityId}/`;
  if (!v.objectPath.startsWith(prefix) || v.objectPath.slice(prefix.length).includes("/")) {
    return err(appError.validation([{ path: ["objectPath"], message: "Invalid upload location." }]));
  }
  const bucket = ctx.db.storage.from(bucketFor(v.entityType));
  const reject = async (message: string) => {
    await bucket.remove([v.objectPath]);
    return err(appError.validation([{ path: ["file"], message }], message));
  };
  const download = await bucket.download(v.objectPath);
  if (download.error || !download.data) return err(appError.notFound("The uploaded file was not found."));
  const blob = download.data;
  if (blob.size === 0 || blob.size > MAX_FILE_BYTES) return reject("Files must be between 1 byte and 10 MB.");
  const actual = detectFileType(new Uint8Array(await blob.slice(0, 16).arrayBuffer()));
  if (!actual || actual !== v.contentType) return reject("The file's contents don't match its type.");
  const { data, error } = await ctx.db
    .from("organization_files")
    .insert({
      organization_id: v.organizationId,
      bucket: bucketFor(v.entityType),
      object_path: v.objectPath,
      entity_type: v.entityType,
      entity_id: v.entityId,
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

/** Portfolio files get public URLs; verification documents get short-lived signed URLs. */
export async function listOrgFiles(
  ctx: ServiceContext,
  entityType: OrgFileEntityType,
  entityIds: string[],
): Promise<Result<OrgFileView[]>> {
  if (entityIds.length === 0) return ok([]);
  const { data, error } = await ctx.db
    .from("organization_files")
    .select("id, entity_id, object_path, file_name, content_type, size_bytes")
    .eq("entity_type", entityType)
    .in("entity_id", entityIds)
    .order("created_at");
  if (error) return err(mapDbError(error));
  const rows = data ?? [];
  if (entityType === "portfolio") {
    const bucket = ctx.db.storage.from("provider-portfolio");
    return ok(
      rows.map((r) => ({
        id: r.id,
        entityId: r.entity_id,
        fileName: r.file_name,
        contentType: r.content_type,
        sizeBytes: r.size_bytes,
        url: bucket.getPublicUrl(r.object_path).data.publicUrl,
      })),
    );
  }
  const signed = rows.length
    ? await ctx.db.storage.from("organization-files").createSignedUrls(
        rows.map((r) => r.object_path),
        600,
      )
    : { data: [] };
  const urls = new Map((signed.data ?? []).map((s) => [s.path, s.signedUrl]));
  return ok(
    rows.map((r) => ({
      id: r.id,
      entityId: r.entity_id,
      fileName: r.file_name,
      contentType: r.content_type,
      sizeBytes: r.size_bytes,
      url: urls.get(r.object_path) ?? null,
    })),
  );
}

export async function deleteOrgFile(ctx: ServiceContext, fileId: string): Promise<Result<true>> {
  const { data, error } = await ctx.db
    .from("organization_files")
    .delete()
    .eq("id", fileId)
    .select("bucket, object_path");
  if (error) return err(mapDbError(error));
  if (!data?.length) return err(appError.notFound("File not found."));
  await ctx.db.storage.from(data[0]!.bucket).remove([data[0]!.object_path]);
  return ok(true);
}
