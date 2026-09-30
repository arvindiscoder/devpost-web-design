"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { env } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import type { ActionState } from "@/lib/action-state";

/* -------------------------------------------------------------------------- */
/*  Shared                                                                      */
/* -------------------------------------------------------------------------- */

const email = z
  .string()
  .trim()
  .min(3, "Enter your email")
  .max(200, "That email is too long")
  .email("Enter a valid email address")
  .transform((value) => value.toLowerCase());

const password = z
  .string()
  .min(8, "Use at least 8 characters")
  .max(72, "Password is too long");

function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Please check the form and try again.";
}

function fieldMap(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

/* -------------------------------------------------------------------------- */
/*  Sign in / sign up / sign out                                                */
/* -------------------------------------------------------------------------- */

const signInSchema = z.object({ email, password });

export async function signIn(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = signInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: firstIssue(parsed.error),
      fieldErrors: fieldMap(parsed.error),
    };
  }

  const supabase = createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    return {
      ok: false,
      message: /invalid login/i.test(error.message)
        ? "That email and password combination doesn't match an account."
        : error.message,
    };
  }

  redirect("/dashboard");
}

const signUpSchema = z
  .object({
    email,
    password,
    confirmPassword: z.string(),
    fullName: z.string().trim().min(2, "Tell us your name").max(80),
    workspaceName: z
      .string()
      .trim()
      .min(2, "Name your workspace")
      .max(80),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export async function signUp(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = signUpSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
    fullName: formData.get("fullName"),
    workspaceName: formData.get("workspaceName"),
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: firstIssue(parsed.error),
      fieldErrors: fieldMap(parsed.error),
    };
  }

  const { email: userEmail, password: userPassword, fullName, workspaceName } =
    parsed.data;

  const supabase = createClient();

  const { data, error } = await supabase.auth.signUp({
    email: userEmail,
    password: userPassword,
    options: {
      data: { full_name: fullName },
      emailRedirectTo: `${env.appUrl}/auth/callback?next=/dashboard`,
    },
  });

  if (error) {
    return {
      ok: false,
      message: /already registered|already exists/i.test(error.message)
        ? "An account already exists for that email. Try signing in."
        : error.message,
    };
  }

  // Supabase projects with "Confirm email" ON return a user but no session.
  if (data.user && !data.session) {
    redirect("/login?message=confirm-email");
  }

  // The first workspace is created atomically with the account.
  const { error: bootstrapError } = await supabase.rpc("bootstrap_workspace", {
    p_workspace_name: workspaceName,
  });

  if (bootstrapError) {
    // Non-fatal: the dashboard offers workspace creation in a modal.
    console.error("bootstrap_workspace failed:", bootstrapError.message);
  }

  revalidatePath("/dashboard");
  redirect("/dashboard?welcome=1");
}

export async function signOut(): Promise<void> {
  const supabase = createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
