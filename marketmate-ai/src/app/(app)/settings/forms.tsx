"use client";

import { useActionState, useEffect, useRef } from "react";
import { preservingSubmit } from "@/components/use-preserving-submit";
import { updateName, updatePassword, type SettingsState } from "./actions";

export function NameForm({ defaultName }: { defaultName: string }) {
  const [state, action, pending] = useActionState<SettingsState, FormData>(updateName, {});
  return (
    <form onSubmit={preservingSubmit(action)} className="space-y-3">
      <div>
        <label className="label" htmlFor="full_name">Your name</label>
        <input id="full_name" name="full_name" className="input" maxLength={120} defaultValue={defaultName} autoComplete="name" />
      </div>
      {state.error && <p className="text-[0.9375rem] text-red-700" role="alert">{state.error}</p>}
      {state.ok && <p className="text-[0.9375rem] text-green-700" role="status">Name saved.</p>}
      <button className="btn-primary" disabled={pending}>{pending ? "Saving…" : "Save name"}</button>
    </form>
  );
}

export function PasswordForm() {
  const [state, action, pending] = useActionState<SettingsState, FormData>(updatePassword, {});
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok) ref.current?.reset();
  }, [state]);
  return (
    <form ref={ref} onSubmit={preservingSubmit(action)} className="space-y-3">
      <div>
        <label className="label" htmlFor="password">New password</label>
        <input id="password" name="password" type="password" className="input" minLength={8} autoComplete="new-password" required />
      </div>
      <div>
        <label className="label" htmlFor="confirm">Confirm new password</label>
        <input id="confirm" name="confirm" type="password" className="input" minLength={8} autoComplete="new-password" required />
      </div>
      {state.error && <p className="text-[0.9375rem] text-red-700" role="alert">{state.error}</p>}
      {state.ok && <p className="text-[0.9375rem] text-green-700" role="status">Password updated.</p>}
      <button className="btn-primary" disabled={pending}>{pending ? "Updating…" : "Change password"}</button>
    </form>
  );
}
