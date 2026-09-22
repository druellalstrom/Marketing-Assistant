"use client";

import { startTransition } from "react";

/**
 * React 19 resets uncontrolled form fields after a `<form action={...}>` submit,
 * which wipes the user's input when the server returns a validation error.
 * Submitting via onSubmit instead keeps their input; forms that should clear on
 * success reset themselves explicitly.
 */
export function preservingSubmit(formAction: (formData: FormData) => void) {
  return (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(() => formAction(formData));
  };
}
