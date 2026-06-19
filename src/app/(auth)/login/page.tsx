"use client";

import Link from "next/link";
import { useFormState } from "react-dom";
import { loginAction } from "../actions";
import { SubmitButton } from "@/components/SubmitButton";

export default function LoginPage() {
  const [state, formAction] = useFormState(loginAction, { error: "" } as { error: string });

  return (
    <div>
      <h1 className="text-3xl font-semibold tracking-tight">Sign in to your account</h1>

      <form action={formAction} className="mt-8 space-y-4">
        <div>
          <label className="label">Email address</label>
          <input name="email" type="email" placeholder="username@domain.com" className="input" required />
        </div>
        <div>
          <label className="label">Enter your password*</label>
          <input name="password" type="password" placeholder="••••••••" className="input" required />
        </div>

        <Link href="/login" className="block text-sm font-medium text-ink-700 opacity-50 pointer-events-none" aria-disabled="true" title="Password reset is not available yet.">
          Forgot your password?
        </Link>

        {state?.error ? <p className="text-sm text-red-600">{state.error}</p> : null}

        <SubmitButton pendingText="Signing in…">Sign In</SubmitButton>

        <p className="text-center text-sm text-ink-600">
          Don&apos;t have an account?{" "}
          <Link href="/register" className="font-medium text-ink-900 underline">
            Register
          </Link>
        </p>
      </form>

      <p className="mt-8 rounded-xl bg-ink-50 p-3 text-center text-xs text-ink-500">
        Demo account — <span className="font-medium text-ink-700">demo@mycollection.world</span> / <span className="font-medium text-ink-700">password</span>
      </p>
    </div>
  );
}
