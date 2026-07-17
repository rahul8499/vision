import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';

const BASE_URL = Constants.expoConfig?.extra?.BASE_URL || '';

interface User {
  id: number;
  name: string;
  email: string;
  mobile?: string;
  address?: string;
  pincode?: string;
  profile_image?: string;
  user_type: 'user' | 'store';
  profile_completion_percent?: number;
  lifecycle_status?: string;
  is_deleted?: boolean;
  preferred_language?: 'en' | 'hi' | 'mr';
  // Store specific fields
  owner_name?: string;
  gst_number?: string;
  drug_license_number?: string;
  auto_accept_prescription?: boolean;
  is_verified?: boolean;
  is_active?: boolean;
}

interface UserState {
  user: User | null;
  token: string | null;
  loading: boolean;
  error: string | null;
}

const initialState: UserState = {
  user: null,
  token: null,
  loading: false,
  error: null,
};

// Async thunk to fetch user data
export const fetchUserProfile = createAsyncThunk(
  'user/fetchProfile',
  async (_, { rejectWithValue }) => {
    try {
      const token = await SecureStore.getItemAsync('authToken');
      let userType = await SecureStore.getItemAsync('userType') as 'user' | 'store' | null;
      
      if (!token) return rejectWithValue('No token found');

      console.log(`[Redux] Fetching profile for type: ${userType || 'unknown'}...`);

      // 🔄 First Attempt based on stored type or default to 'user'
      let mainEndpoint = userType === 'store' ? '/api/store-me/' : '/api/me/';
      
      try {
        const response = await axios.get(`${BASE_URL}${mainEndpoint}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        console.log(`[Redux] Profile fetched successfully from ${mainEndpoint}`);
        return { user: { ...response.data, user_type: userType || (mainEndpoint === '/api/store-me/' ? 'store' : 'user') }, token };
      } catch (err: any) {
        // 🧪 Fallback logic if the first try fails (maybe userType was wrong/missing)
        const fallbackEndpoint = mainEndpoint === '/api/me/' ? '/api/store-me/' : '/api/me/';
        console.log(`[Redux] Initial attempt failed. Trying fallback: ${fallbackEndpoint}...`);
        
        try {
            const response = await axios.get(`${BASE_URL}${fallbackEndpoint}`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            
            const detectedType = fallbackEndpoint === '/api/store-me/' ? 'store' : 'user';
            await SecureStore.setItemAsync('userType', detectedType);
            
            console.log(`[Redux] Fallback successful. Detected userType: ${detectedType}`);
            return { user: { ...response.data, user_type: detectedType }, token };
        } catch (fallbackErr: any) {
            console.error('[Redux] All attempts failed.');
            throw fallbackErr;
        }
      }
    } catch (error: any) {
      console.error('[Redux] Profile fetch fatal error:', error.response?.data || error.message);
      return rejectWithValue(error.response?.data?.detail || error.response?.data?.error || 'Failed to fetch profile');
    }
  }
);

const userSlice = createSlice({
  name: 'user',
  initialState,
  reducers: {
    setAuth: (state, action: PayloadAction<{ token: string; userType: 'user' | 'store' }>) => {
      state.token = action.payload.token;
      // Note: Full user object will be fetched by fetchUserProfile
    },
    logout: (state) => {
      state.user = null;
      state.token = null;
      state.error = null;
      SecureStore.deleteItemAsync('authToken');
      SecureStore.deleteItemAsync('userId');
      SecureStore.deleteItemAsync('userType');
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchUserProfile.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchUserProfile.fulfilled, (state, action) => {
        state.loading = false;
        state.user = action.payload.user;
        state.token = action.payload.token;
      })
      .addCase(fetchUserProfile.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });
  },
});

export const { setAuth, logout } = userSlice.actions;
export default userSlice.reducer;
