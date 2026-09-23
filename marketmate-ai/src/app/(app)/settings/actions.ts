"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getAuthContext } from "@/lib/supabase/server";

export interface SettingsState {
  ok?: boolean;
  error?: string;
}

export async function updateName(_prev: SettingsState, formData: FormData): Promise<SettingsState> {
  const auth = await getAuthContext();
  if (!auth) return { error: "Please sign in." };
  const name = z.string().trim().min(1, "Enter your name.").max(120, "Name is too long.").safeParse(formData.get("full_name"));
  if (!name.success) return { error: name.error.issues[0].message };
  const { error } = await auth.supabase.from("users").update({ full_name: name.data }).eq("id", auth.user.id);
  if (error) return { error: "Could not save your name." };
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function updatePassword(_prev: SettingsState, formData: FormData): Promise<SettingsState> {
  const auth = await getAuthContext();
  if (!auth) return { error: "Please sign in." };
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  if (password.length < 8) return { error: "Use at least 8 characters." };
  if (password !== confirm) return { error: "The two passwords don't match." };
  const { error } = await auth.supabase.auth.updateUser({ password });
  if (error) return { error: error.message };
  return { ok: true };
}
