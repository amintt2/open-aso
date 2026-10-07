import { create } from "zustand";
import { persist } from "zustand/middleware";

type UiState = {
  sidebarOpen: boolean;
  addAppOpen: boolean;
  countryByApp: Record<number, string>;
  setSidebarOpen: (open: boolean) => void;
  setAddAppOpen: (open: boolean) => void;
  setCountry: (appId: number, country: string) => void;
};

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      sidebarOpen: false,
      addAppOpen: false,
      countryByApp: {},
      setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
      setAddAppOpen: (addAppOpen) => set({ addAppOpen }),
      setCountry: (appId, country) => set((s) => ({ countryByApp: { ...s.countryByApp, [appId]: country } })),
    }),
    { name: "open-aso-ui", partialize: (s) => ({ countryByApp: s.countryByApp }) },
  ),
);
