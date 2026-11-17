import { create } from "zustand";

/** How the reader likes the app laid out. A pattern for other stores: state, then its actions. */
interface PreferencesState {
  compact: boolean;
  toggleCompact: () => void;
  reset: () => void;
}

const INITIAL = { compact: false };

export const usePreferences = create<PreferencesState>()((set) => ({
  ...INITIAL,
  toggleCompact: () => set((state) => ({ compact: !state.compact })),
  reset: () => set(INITIAL),
}));
