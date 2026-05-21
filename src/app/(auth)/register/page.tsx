"use client";

import Link from "next/link";
import { useFormState } from "react-dom";
import { registerAction } from "../actions";
import { SubmitButton } from "@/components/SubmitButton";

export default function RegisterPage() {
  const [state, formAction] = useFormState(registerAction, { error: "" } as { error: string });

  return (
    <div>
      <h1 className="text-3xl font-semibold tracking-tight">Create an account</h1>
      <p className="mt-2 text-sm text-ink-500">
        Enter the information below to create your account.
      </p>

      <form action={formAction} className="mt-8 space-y-4">
        <div>
          <label className="label">Your name</label>
          <input name="name" type="text" placeholder="Jane Doe" className="input" required />
        </div>
        <div>
          <label className="label">Email address</label>
          <input name="email" type="email" placeholder="username@domain.com" className="input" required />
        </div>
        <div>
          <label className="label">Password</label>
          <input name="password" type="password" placeholder="At least 6 characters" className="input" required />
        </div>

        <label className="flex items-start gap-2 text-sm text-ink-700">
          <input name="accept" type="checkbox" className="mt-0.5" />
          <span>
            I accept the <span className="font-medium">Terms and Conditions</span> and agree to the{" "}
            <span className="font-medium">Data Privacy Settings</span>.
          </span>
        </label>

        {state?.error ? <p className="text-sm text-red-600">{state.error}</p> : null}

        <SubmitButton pendingText="Creating…">Register</SubmitButton>

        <p className="text-center text-sm text-ink-600">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-ink-900 underline">
            Sign In
          </Link>
        </p>
      </form>
    </div>
  );
}
