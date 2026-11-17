/** The app header's height. Dialogs open below it (`theme.ts`), so it stays in reach. */
export const HEADER_HEIGHT = "2.75rem";

const HEADER_ID = "app-header";

/** The props that mark the app's header. */
export const headerProps = { id: HEADER_ID };

/** Where an overlay's backdrop and positioner sit: below the header, which is the window's title
 * bar and is never covered. */
export const BELOW_HEADER = { top: HEADER_HEIGHT, h: `calc(100dvh - ${HEADER_HEIGHT})` };

/**
 * Keeps the app's header working while a dialog is open, for the dialog's `persistentElements`.
 * A press on the header (to drag, minimize or close the window, or use one of its buttons) is then
 * not a press outside the dialog, which would close it, and the dialog doesn't turn off the
 * header's clicks as it does the rest of the page's. The app's own `DialogRoot`
 * (`components/ui/dialog`) passes it to every dialog, as a native title bar is never part of the
 * page.
 *
 * The dialog waits a second for each such element to appear, then fails with an error nothing
 * catches. Where there's no header, as in a dialog's own story, a detached element stands in.
 */
export const keepHeader = [
  () => document.getElementById(HEADER_ID) ?? document.createElement("header"),
];
