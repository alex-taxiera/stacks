import { afterEach, describe, expect, it, vi } from "vitest";

import { toaster } from "./components/ui/toaster";
import { ACTION_DURATION_MS, errorText, showError, showLoading, showSuccess } from "./notify";

describe("errorText", () => {
  it("says an Error's message", () => {
    expect(errorText(new Error("Disk full"))).toBe("Disk full");
  });

  it("says anything else as text, as a Tauri command rejects", () => {
    expect(errorText("no such file")).toBe("no such file");
  });
});

describe("toasts", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows an error with the error as its description", () => {
    const create = vi.spyOn(toaster, "create");
    showError("Couldn't save", new Error("Disk full"));
    expect(create).toHaveBeenCalledWith({
      type: "error",
      title: "Couldn't save",
      description: "Disk full",
    });
  });

  it("leaves a toast with a button up long enough to press it", () => {
    const create = vi.spyOn(toaster, "create");
    const action = { label: "Undo", onClick: () => {} };
    showSuccess("Deleted", { action });
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ action, duration: ACTION_DURATION_MS }),
    );
  });

  it("never passes an undefined id", () => {
    const create = vi.spyOn(toaster, "create");
    showSuccess("Saved");
    expect(create.mock.calls[0]?.[0]).not.toHaveProperty("id");
  });

  it("shows work in progress under an id the result can replace", () => {
    const create = vi.spyOn(toaster, "create");
    showLoading("Saving…", "save");
    expect(create).toHaveBeenCalledWith({ id: "save", type: "loading", title: "Saving…" });
  });
});
