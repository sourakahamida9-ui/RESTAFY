import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface UserStore {
  // Identifiant de l'utilisateur actuel (pour invalider le cache quand on change d'utilisateur)
  currentUserId: string | null;
  setCurrentUserId: (id: string | null) => void;
  
  location: string;
  setLocation: (location: string) => void;
  isLoggedIn: boolean;
  setLoggedIn: (v: boolean) => void;
  hasOnboarded: boolean;
  setHasOnboarded: (v: boolean) => void;
  userName: string;
  setUserName: (name: string) => void;
  userRole: 'client' | 'restaurant' | 'pos' | null;
  setUserRole: (role: 'client' | 'restaurant' | 'pos') => void;
  
  // Reset le store pour un nouvel utilisateur
  resetForNewUser: (userId: string | null) => void;
}

const DEFAULT_LOCATION = 'Cotonou';

export const useUserStore = create<UserStore>()(
  persist(
    (set, get) => ({
      currentUserId: null,
      setCurrentUserId: (currentUserId) => set({ currentUserId }),
      
      location: DEFAULT_LOCATION,
      setLocation: (location) => set({ location }),
      isLoggedIn: false,
      setLoggedIn: (isLoggedIn) => set({ isLoggedIn }),
      hasOnboarded: false,
      setHasOnboarded: (hasOnboarded) => set({ hasOnboarded }),
      userName: 'Utilisateur',
      setUserName: (userName) => set({ userName }),
      userRole: null,
      setUserRole: (userRole) => set({ userRole }),
      
      // Quand un nouvel utilisateur se connecte, reset les donnees
      resetForNewUser: (userId) => {
        const current = get().currentUserId;
        if (current !== userId) {
          set({
            currentUserId: userId,
            location: DEFAULT_LOCATION,
            userName: 'Utilisateur',
            userRole: null,
            // Garder hasOnboarded et isLoggedIn car geres ailleurs
          });
        }
      },
    }),
    { 
      name: 'restafy-user',
      storage: createJSONStorage(() => localStorage),
    }
  )
);
