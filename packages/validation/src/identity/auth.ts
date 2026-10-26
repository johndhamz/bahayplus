import { z } from "zod";
import { Email } from "../common/primitives";

export { Email };

/** Password policy: length over complexity (NIST 800-63B), with a sane upper bound. */
export const Password = z.string().min(10, "Use at least 10 characters.").max(128, "Use 128 characters or fewer.");

export const LoginInput = z.object({
  email: Email,
  password: z.string().min(1, "Enter your password."),
  next: z.string().optional(),
});
export type LoginInput = z.infer<typeof LoginInput>;

export const SignupInput = z
  .object({
    fullName: z.string().trim().min(2, "Enter your name.").max(120),
    email: Email,
    password: Password,
    confirmPassword: z.string(),
    acceptTerms: z.literal(true, { message: "Please accept the Terms and Privacy Notice." }),
  })
  .refine((v) => v.password === v.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords don't match.",
  });
export type SignupInput = z.infer<typeof SignupInput>;

export const ForgotPasswordInput = z.object({ email: Email });
export type ForgotPasswordInput = z.infer<typeof ForgotPasswordInput>;

export const ResetPasswordInput = z
  .object({ password: Password, confirmPassword: z.string() })
  .refine((v) => v.password === v.confirmPassword, { path: ["confirmPassword"], message: "Passwords don't match." });
export type ResetPasswordInput = z.infer<typeof ResetPasswordInput>;

export const UpdateProfileInput = z.object({
  fullName: z.string().trim().min(2, "Enter your name.").max(120),
  phone: z
    .string()
    .trim()
    .max(20)
    .regex(/^$|^\+?[0-9 ()-]{7,20}$/, "Enter a valid phone number, e.g. +63 917 123 4567.")
    .transform((v) => (v === "" ? null : v)),
  locale: z.enum(["en-PH", "fil-PH"]),
});
export type UpdateProfileInput = z.input<typeof UpdateProfileInput>;

export const ChangePasswordInput = ResetPasswordInput;

/** A 6-digit code from an authenticator app (TOTP). Spaces are allowed when pasting "123 456". */
export const MfaCode = z
  .string()
  .transform((v) => v.replace(/\s/g, ""))
  .pipe(z.string().regex(/^\d{6}$/, "Enter the 6-digit code from your authenticator app."));

export const VerifyMfaInput = z.object({
  factorId: z.uuid({ message: "Invalid identifier." }),
  code: MfaCode,
  next: z.string().optional(),
});
export type VerifyMfaInput = z.input<typeof VerifyMfaInput>;
