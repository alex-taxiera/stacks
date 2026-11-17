// Toasts, the one way the apps tell the user something happened: an error, a success, a warning,
// or work still going. `<Toaster />` (in each app's root, and in every Storybook story) shows them.

import { toaster } from "./components/ui/toaster";

/** An error as text: an `Error`'s message, or anything else as a string (a Tauri command rejects
 * with its Rust error's message). */
export function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** A button on a toast, for what the user can do about it. */
export interface ToastAction {
  label: string;
  onClick: () => void;
}

/** What else a toast says and does, besides its title. */
export interface ToastOptions {
  /** Another toast with the same `id` replaces it, so a loading toast can turn into its result. */
  id?: string;
  description?: string;
  action?: ToastAction;
}

/** An error's toast, which says the error itself. */
export function showError(
  title: string,
  error: unknown,
  { id, action }: Omit<ToastOptions, "description"> = {},
) {
  toaster.create({
    ...withId(id),
    ...withAction(action),
    type: "error",
    title,
    description: errorText(error),
  });
}

export function showSuccess(title: string, options: ToastOptions = {}) {
  show("success", title, options);
}

export function showInfo(title: string, options: ToastOptions = {}) {
  show("info", title, options);
}

/** Something didn't happen, but nothing went wrong: the user has something to do. */
export function showWarning(title: string, options: ToastOptions = {}) {
  show("warning", title, options);
}

/** A toast with a spinner, until another with the same `id` replaces it. */
export function showLoading(title: string, id: string) {
  toaster.create({ id, type: "loading", title });
}

function show(
  type: "success" | "info" | "warning",
  title: string,
  { id, description, action }: ToastOptions,
) {
  toaster.create({ ...withId(id), ...withAction(action), type, title, description });
}

/** The toast's `id`, left out when there's none: zag rejects `id: undefined`. */
function withId(id: string | undefined): { id?: string } {
  return id === undefined ? {} : { id };
}

/** How long a toast with a button stays, so there's time to read it and press the button. */
export const ACTION_DURATION_MS = 10_000;

/** The toast's button, and the time to use it; nothing when there's none. */
function withAction(action: ToastAction | undefined): { action?: ToastAction; duration?: number } {
  return action === undefined ? {} : { action, duration: ACTION_DURATION_MS };
}
