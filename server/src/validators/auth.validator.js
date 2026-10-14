import { z } from "zod";

const emailField = z.string().trim().toLowerCase().email().max(254);
const passwordField = z.string().min(8).max(72);

const loginSchema = z.object({
  email: emailField,
  password: z.string().min(1).max(72),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(72),
  newPassword: passwordField,
});

const forgotPasswordSchema = z.object({
  email: emailField,
});

const resetPasswordSchema = z.object({
  token: z.string().min(10).max(512),
  newPassword: passwordField,
});

const emailRequestSchema = z.object({
  newEmail: emailField,
  password: z.string().min(1).max(72),
});

const emailConfirmSchema = z.object({
  token: z.string().min(10).max(512),
});

const adminLoginSchema = z.object({
  username: z.string().trim().toLowerCase().min(1).max(64),
  password: z.string().min(1).max(72),
});

export {
  loginSchema,
  changePasswordSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  emailRequestSchema,
  emailConfirmSchema,
  adminLoginSchema,
};
