import { UpdateProfileInput } from "@bahayplus/validation/identity/auth";
import { appError, err, ok, type Result } from "@bahayplus/types/result";
import { mapDbError, parseInput, type ServiceContext } from "@bahayplus/modules/authorization";

export type Profile = { id: string; fullName: string; phone: string | null; locale: "en-PH" | "fil-PH" };

export async function getMyProfile(ctx: ServiceContext): Promise<Result<Profile>> {
  const { data, error } = await ctx.db
    .from("profiles")
    .select("id, full_name, phone, locale")
    .eq("id", ctx.userId)
    .maybeSingle();
  if (error) return err(mapDbError(error));
  if (!data) return err(appError.notFound("Profile not found."));
  return ok({ id: data.id, fullName: data.full_name, phone: data.phone, locale: data.locale as Profile["locale"] });
}

export async function updateMyProfile(ctx: ServiceContext, input: unknown): Promise<Result<Profile>> {
  const parsed = parseInput(UpdateProfileInput, input);
  if (!parsed.ok) return parsed;
  const { data, error } = await ctx.db
    .from("profiles")
    .update({ full_name: parsed.value.fullName, phone: parsed.value.phone, locale: parsed.value.locale })
    .eq("id", ctx.userId)
    .select("id, full_name, phone, locale")
    .single();
  if (error) return err(mapDbError(error));
  return ok({ id: data.id, fullName: data.full_name, phone: data.phone, locale: data.locale as Profile["locale"] });
}
