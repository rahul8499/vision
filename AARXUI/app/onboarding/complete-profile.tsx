import { LocalizedText as Text, LocalizedTextInput as TextInput } from '@/components/Language/LocalizedPrimitives';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { getGoogleIdToken } from '@/utils/googleIdentity';
import { useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, SafeAreaView, TouchableOpacity, View } from 'react-native';

export default function CompleteProfileScreen() {
  const router = useRouter();
  const baseUrl = Constants.expoConfig?.extra?.BASE_URL as string;
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [googleEmail, setGoogleEmail] = useState('');

  const linkGoogle = async () => {
    if (busy || googleBusy) return;
    try {
      setGoogleBusy(true);
      const idToken = await getGoogleIdToken();
      if (!idToken) return;
      const [token, linkTicket] = await Promise.all([
        SecureStore.getItemAsync('authToken'),
        SecureStore.getItemAsync('googleLinkTicket'),
      ]);
      if (!linkTicket) {
        throw new Error('For security, verify your phone again before linking Google.');
      }
      const response = await fetch(`${baseUrl}/api/user/google/link/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ id_token: idToken, link_ticket: linkTicket }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || 'Could not link Google.');
      await SecureStore.deleteItemAsync('googleLinkTicket');
      setGoogleEmail(data.google_email || '');
      Alert.alert('Google linked', 'You can now use Google to sign in to this AARX account.');
    } catch (error: any) {
      Alert.alert('Could not link Google', error?.message || 'Please try again.');
    } finally {
      setGoogleBusy(false);
    }
  };

  const save = async () => {
    const cleanName = name.trim().replace(/\s+/g, ' ');
    if (cleanName.length < 2) {
      Alert.alert('Your name', 'Please enter your name.');
      return;
    }
    try {
      setBusy(true);
      const token = await SecureStore.getItemAsync('authToken');
      const response = await fetch(`${baseUrl}/api/user/complete-profile/`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name: cleanName }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || 'Could not save your name.');
      router.replace('/(tabs)');
    } catch (error: any) {
      Alert.alert('Could not continue', error?.message || 'Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <LinearGradient colors={['#ecfdf5', '#ffffff']} className="flex-1 px-6">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1 justify-center">
          <View className="h-16 w-16 items-center justify-center rounded-3xl bg-emerald-600">
            <MaterialCommunityIcons name="account-heart-outline" size={34} color="white" />
          </View>
          <Text className="mt-8 text-3xl font-black text-slate-950">What should we call you?</Text>
          <Text className="mt-3 text-base font-medium leading-6 text-slate-500">
            That is all we need for now. We will ask for a delivery address when you upload a prescription.
          </Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Your name"
            autoCapitalize="words"
            autoComplete="name"
            autoFocus
            maxLength={100}
            className="mt-10 rounded-2xl border border-slate-200 bg-white px-5 py-5 text-base font-bold text-slate-900"
          />
          <TouchableOpacity
            onPress={linkGoogle}
            disabled={busy || googleBusy || Boolean(googleEmail)}
            className="mt-5 flex-row items-center justify-center rounded-2xl border border-slate-200 bg-white py-4"
          >
            {googleBusy ? (
              <ActivityIndicator color="#183c25" />
            ) : (
              <>
                <MaterialCommunityIcons
                  name={googleEmail ? 'check-circle' : 'google'}
                  size={20}
                  color={googleEmail ? '#059669' : '#4285F4'}
                />
                <Text className="ml-3 text-sm font-black text-slate-800">
                  {googleEmail ? `Linked: ${googleEmail}` : 'Link Google account'}
                </Text>
              </>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            onPress={save}
            disabled={busy || name.trim().length < 2}
            className={`mt-5 items-center rounded-2xl py-5 ${name.trim().length >= 2 ? 'bg-emerald-600' : 'bg-slate-300'}`}
          >
            {busy ? <ActivityIndicator color="white" /> : <Text className="text-base font-black text-white">Start using AARX</Text>}
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </LinearGradient>
    </SafeAreaView>
  );
}
