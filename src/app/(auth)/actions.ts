"use server";

import { redirect } from "next/navigation";
import { Users } from "@/lib/repo";
import { hashPassword, verifyPassword } from "@/lib/auth";
import { createSession, destroySession } from "@/lib/session";
import { check, clientIp, reset } from "@/lib/rate-limit";

const LOGIN_MAX = 5;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const REGISTER_MAX = 3;
const REGISTER_WINDOW_MS = 60 * 60 * 1000;
const TOO_MANY = "Too many attempts. Try again in a few minutes.";

export async function loginAction(_prev: unknown, formData: FormData) {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");
  if (!email || !password) return { error: "Email and password are required." };

  const key = `login:${clientIp()}:${email}`;
  if (!check(key, LOGIN_MAX, LOGIN_WINDOW_MS).allowed) {
    return { error: TOO_MANY };
  }

  const user = await Users.byEmail(email);
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return { error: "Invalid email or password." };
  }
  reset(key);
  createSession(user.id);
  redirect("/dashboard/collection");
}

export async function registerAction(_prev: unknown, formData: FormData) {
  const name = String(formData.get("name") || "").trim();
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");
  const accept = formData.get("accept");

  // Count every attempt regardless of outcome to prevent enumeration.
  if (!check(`register:${clientIp()}`, REGISTER_MAX, REGISTER_WINDOW_MS).allowed) {
    return { error: TOO_MANY };
  }

  if (!name || !email || !password) return { error: "All fields are required." };
  if (password.length < 6) return { error: "Password must be at least 6 characters." };
  if (!accept) return { error: "Please accept the Terms and Privacy settings." };

  const existing = await Users.byEmail(email);
  if (existing) return { error: "An account with this email already exists." };

  const user = await Users.create({ name, email, passwordHash: await hashPassword(password) });
  createSession(user.id);
  redirect("/dashboard/collection");
}

export async function logoutAction() {
  destroySession();
  redirect("/login");
}
