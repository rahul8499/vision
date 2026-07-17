import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import i18n from 'i18next';
import React, { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { initReactI18next, useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';
import { Alert } from 'react-native';
import Toast from 'react-native-toast-message';
import type { RootState } from '@/redux/store';
import autoTranslations from '@/locales/autoTranslations.json';

export type AppLanguage = 'en' | 'hi' | 'mr';
export const LANGUAGE_STORAGE_KEY = '@aarx/app-language';
const BASE_URL = Constants.expoConfig?.extra?.BASE_URL || '';

export const APP_LANGUAGES: { code: AppLanguage; label: string; nativeLabel: string }[] = [
  { code: 'en', label: 'English', nativeLabel: 'English' },
  { code: 'hi', label: 'Hindi', nativeLabel: 'हिन्दी' },
  { code: 'mr', label: 'Marathi', nativeLabel: 'मराठी' },
];

const resources = {
  en: { auto: autoTranslations.en, translation: {
    nav: { home: 'Home', upload: 'Upload', offers: 'Offers', enquiry: 'Enquiry', orders: 'Orders', chat: 'Chat', support: 'Support', reports: 'Reports', history: 'History', settings: 'Settings', profile: 'Profile', documents: 'Documents', replacements: 'Replacements' },
    language: { title: 'App Language', subtitle: 'Choose the language used across AARX', select: 'Select Language', applying: 'Applying language…', wait: 'Saving to your account and updating AARX.', applied: 'Language updated', failed: 'Could not update language', retry: 'Check your connection and try again.', saving: 'Saving preference', translating: 'Applying translations', refreshing: 'Refreshing experience', ready: 'Ready' },
    common: { cancel: 'Cancel', close: 'Close' },
    logout: { action: 'Sign out of Account', title: 'Sign Out?', userEyebrow: 'Secure Session Exit', storeEyebrow: 'Secure Store Session', userMessage: 'You will need to sign in again before managing your account and orders.', storeMessage: 'You will need to sign in again before managing enquiries, chats, history, and store settings.', stay: 'Stay Signed In', confirm: 'Sign Out' },
  }},
  hi: { auto: autoTranslations.hi, translation: {
    nav: { home: 'होम', upload: 'अपलोड', offers: 'ऑफर', enquiry: 'पूछताछ', orders: 'ऑर्डर', chat: 'चैट', support: 'सहायता', reports: 'रिपोर्ट', history: 'इतिहास', settings: 'सेटिंग्स', profile: 'प्रोफाइल', documents: 'दस्तावेज़', replacements: 'रिप्लेसमेंट' },
    language: { title: 'ऐप की भाषा', subtitle: 'AARX में उपयोग होने वाली भाषा चुनें', select: 'भाषा चुनें', applying: 'भाषा लागू की जा रही है…', wait: 'आपके अकाउंट में सेव करके AARX अपडेट किया जा रहा है।', applied: 'भाषा बदल दी गई', failed: 'भाषा अपडेट नहीं हुई', retry: 'इंटरनेट कनेक्शन जांचकर दोबारा प्रयास करें।', saving: 'पसंद सेव हो रही है', translating: 'अनुवाद लागू हो रहे हैं', refreshing: 'ऐप अपडेट हो रहा है', ready: 'तैयार' },
    common: { cancel: 'रद्द करें', close: 'बंद करें' },
    logout: { action: 'अकाउंट से साइन आउट करें', title: 'साइन आउट करें?', userEyebrow: 'सुरक्षित सत्र समाप्ति', storeEyebrow: 'सुरक्षित स्टोर सत्र', userMessage: 'अपने अकाउंट और ऑर्डर प्रबंधित करने के लिए आपको दोबारा साइन इन करना होगा।', storeMessage: 'पूछताछ, चैट, हिस्ट्री और स्टोर सेटिंग्स प्रबंधित करने के लिए आपको दोबारा साइन इन करना होगा।', stay: 'साइन इन रहें', confirm: 'साइन आउट' },
  }},
  mr: { auto: autoTranslations.mr, translation: {
    nav: { home: 'होम', upload: 'अपलोड', offers: 'ऑफर', enquiry: 'चौकशी', orders: 'ऑर्डर', chat: 'चॅट', support: 'मदत', reports: 'अहवाल', history: 'इतिहास', settings: 'सेटिंग्ज', profile: 'प्रोफाइल', documents: 'कागदपत्रे', replacements: 'बदली' },
    language: { title: 'अॅपची भाषा', subtitle: 'AARX मध्ये वापरायची भाषा निवडा', select: 'भाषा निवडा', applying: 'भाषा लागू होत आहे…', wait: 'तुमच्या खात्यात जतन करून AARX अपडेट होत आहे.', applied: 'भाषा बदलली', failed: 'भाषा अपडेट झाली नाही', retry: 'इंटरनेट कनेक्शन तपासून पुन्हा प्रयत्न करा.', saving: 'भाषेची निवड जतन होत आहे', translating: 'भाषांतर लागू होत आहे', refreshing: 'अॅप अपडेट होत आहे', ready: 'तयार' },
    common: { cancel: 'रद्द करा', close: 'बंद करा' },
    logout: { action: 'खात्यातून साइन आउट करा', title: 'साइन आउट करायचे?', userEyebrow: 'सुरक्षित सत्र समाप्ती', storeEyebrow: 'सुरक्षित स्टोअर सत्र', userMessage: 'तुमचे खाते आणि ऑर्डर व्यवस्थापित करण्यासाठी तुम्हाला पुन्हा साइन इन करावे लागेल.', storeMessage: 'चौकशी, चॅट, इतिहास आणि स्टोअर सेटिंग्ज व्यवस्थापित करण्यासाठी तुम्हाला पुन्हा साइन इन करावे लागेल.', stay: 'साइन इन राहा', confirm: 'साइन आउट' },
  }},
} as const;

if (!i18n.isInitialized) {
  i18n.use(initReactI18next).init({ resources, lng: 'en', fallbackLng: 'en', supportedLngs: ['en', 'hi', 'mr'], interpolation: { escapeValue: false }, initAsync: false });
}

axios.defaults.headers.common['Accept-Language'] = 'en';

type LanguageContextValue = {
  language: AppLanguage;
  languageLabel: string;
  initialized: boolean;
  changeLanguage: (language: AppLanguage) => Promise<void>;
};
const LanguageContext = createContext<LanguageContextValue | null>(null);

function translateAuto(value?: string) {
  if (!value || !/[A-Za-z]/.test(value)) return value;
  const key = value.trim().replace(/\s+/g, ' ');
  return i18n.t(key, { ns: 'auto', defaultValue: value });
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<AppLanguage>('en');
  const account = useSelector((state: RootState) => state.user.user);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    const originalAlert = Alert.alert;
    const originalToast = Toast.show;
    Alert.alert = ((title: string, message?: string, buttons?: any[], options?: any) => originalAlert(
      translateAuto(title) || title,
      translateAuto(message),
      buttons?.map(button => ({ ...button, text: translateAuto(button.text) || button.text })),
      options,
    )) as typeof Alert.alert;
    Toast.show = ((params: any) => originalToast({
      ...params,
      text1: translateAuto(params?.text1),
      text2: translateAuto(params?.text2),
    })) as typeof Toast.show;
    return () => {
      Alert.alert = originalAlert;
      Toast.show = originalToast;
    };
  }, []);

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(LANGUAGE_STORAGE_KEY).then(async stored => {
      const next: AppLanguage = stored === 'hi' || stored === 'mr' ? stored : 'en';
      await i18n.changeLanguage(next);
      axios.defaults.headers.common['Accept-Language'] = next;
      if (active) { setLanguage(next); setInitialized(true); }
    }).catch(() => active && setInitialized(true));
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const preferred = account?.preferred_language;
    if (preferred !== 'en' && preferred !== 'hi' && preferred !== 'mr') return;
    AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, preferred).then(async () => {
      await i18n.changeLanguage(preferred);
      axios.defaults.headers.common['Accept-Language'] = preferred;
      setLanguage(preferred);
    });
  }, [account?.id, account?.user_type]);

  const changeLanguage = useCallback(async (next: AppLanguage) => {
    const token = await SecureStore.getItemAsync('authToken');
    if (token && BASE_URL) {
      await axios.patch(`${BASE_URL}/api/language/`, { preferred_language: next }, {
        headers: { Authorization: `Bearer ${token}`, 'Accept-Language': next },
      });
    }
    await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, next);
    await i18n.changeLanguage(next);
    axios.defaults.headers.common['Accept-Language'] = next;
    setLanguage(next);
  }, []);

  const value = useMemo(() => ({ language, initialized, changeLanguage, languageLabel: APP_LANGUAGES.find(x => x.code === language)?.nativeLabel || 'English' }), [changeLanguage, initialized, language]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useAppLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error('useAppLanguage must be used inside LanguageProvider');
  const { t } = useTranslation();
  return { ...context, t };
}

export { i18n };
