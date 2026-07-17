import AsyncStorage from '@react-native-async-storage/async-storage';

const RECENT_LOCATIONS_KEY = 'recent_locations';
const MAX_RECENT = 5;

export interface RecentLocation {
  id: string;
  display_name: string;
  lat: string;
  lon: string;
  place_id: string;
}

export const LocationStorage = {
  getRecentLocations: async (): Promise<RecentLocation[]> => {
    try {
      const data = await AsyncStorage.getItem(RECENT_LOCATIONS_KEY);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.error('Failed to get recent locations', e);
      return [];
    }
  },

  saveLocation: async (location: RecentLocation) => {
    try {
      const recent = await LocationStorage.getRecentLocations();
      
      // Remove if already exists to move to top
      const filtered = recent.filter(loc => loc.place_id !== location.place_id);
      
      // Add to beginning
      const updated = [location, ...filtered].slice(0, MAX_RECENT);
      
      await AsyncStorage.setItem(RECENT_LOCATIONS_KEY, JSON.stringify(updated));
    } catch (e) {
      console.error('Failed to save location', e);
    }
  },

  clearRecent: async () => {
    try {
      await AsyncStorage.removeItem(RECENT_LOCATIONS_KEY);
    } catch (e) {
      console.error('Failed to clear locations', e);
    }
  }
};
