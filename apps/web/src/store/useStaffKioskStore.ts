import { create } from 'zustand';

const STORAGE_KEY = 'restafy-staff-kiosk-v1';

export type StaffKioskStaff = {
  id: string;
  restaurant_id: string;
  role: string;
  display_name: string;
};

export type StaffKioskCapabilities = {
  can_update_order_status: boolean;
  can_cancel_order: boolean;
  kiosk_scope: string;
};

type StaffKioskState = {
  accessToken: string | null;
  sessionToken: string | null;
  staff: StaffKioskStaff | null;
  restaurantName: string | null;
  capabilities: StaffKioskCapabilities | null;
  hydrate: () => void;
  setKioskSession: (payload: {
    accessToken: string;
    sessionToken: string;
    staff: StaffKioskStaff;
    restaurantName: string | null;
    capabilities: StaffKioskCapabilities;
  }) => void;
  clearKioskSession: () => void;
};

function readStored(): Partial<{
  accessToken: string;
  sessionToken: string;
  staff: StaffKioskStaff;
  restaurantName: string | null;
  capabilities: StaffKioskCapabilities;
}> {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Partial<{
      accessToken: string;
      sessionToken: string;
      staff: StaffKioskStaff;
      restaurantName: string | null;
      capabilities: StaffKioskCapabilities;
    }>;
  } catch {
    return {};
  }
}

function writeStored(data: Record<string, unknown> | null) {
  try {
    if (!data) sessionStorage.removeItem(STORAGE_KEY);
    else sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    /* ignore */
  }
}

export const useStaffKioskStore = create<StaffKioskState>((set) => ({
  accessToken: null,
  sessionToken: null,
  staff: null,
  restaurantName: null,
  capabilities: null,

  hydrate: () => {
    const s = readStored();
    set({
      accessToken: s.accessToken ?? null,
      sessionToken: s.sessionToken ?? null,
      staff: s.staff ?? null,
      restaurantName: s.restaurantName ?? null,
      capabilities: s.capabilities ?? null,
    });
  },

  setKioskSession: ({ accessToken, sessionToken, staff, restaurantName, capabilities }) => {
    writeStored({ accessToken, sessionToken, staff, restaurantName, capabilities });
    set({ accessToken, sessionToken, staff, restaurantName, capabilities });
  },

  clearKioskSession: () => {
    writeStored(null);
    set({
      accessToken: null,
      sessionToken: null,
      staff: null,
      restaurantName: null,
      capabilities: null,
    });
  },
}));
