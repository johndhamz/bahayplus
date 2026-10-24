import { z } from "zod";

export const Email = z.email({ message: "Enter a valid email address." }).trim().toLowerCase().max(254);

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
