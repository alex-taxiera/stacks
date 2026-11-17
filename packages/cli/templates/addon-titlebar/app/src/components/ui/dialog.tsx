import { DialogRoot as SharedDialogRoot } from "__UI_PKG__/dialog";
import type { ComponentProps } from "react";

import { keepHeader } from "#/layout";

export * from "__UI_PKG__/dialog";

/** The shared dialog, with the app's header kept usable while it's open (`keepHeader`). */
export function DialogRoot(props: ComponentProps<typeof SharedDialogRoot>) {
  return <SharedDialogRoot persistentElements={keepHeader} {...props} />;
}
