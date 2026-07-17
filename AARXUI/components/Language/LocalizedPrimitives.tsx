import i18n from 'i18next';
import React, { forwardRef, ReactNode } from 'react';
import {
  Button as NativeButton,
  ButtonProps,
  Text as NativeText,
  TextInput as NativeTextInput,
  TextInputProps,
  TextProps,
} from 'react-native';
import { useTranslation } from 'react-i18next';

function normalize(value: string) {
  return value.trim().replace(/\s+/g, ' ');
}

export function translateStatic(value: string | undefined | null): string | undefined {
  if (value == null || typeof value !== 'string') return value ?? undefined;
  const key = normalize(value);
  if (!key || !/[A-Za-z]/.test(key)) return value;
  const translated = i18n.t(key, { ns: 'auto', defaultValue: key });
  if (translated !== key) return translated;

  const language = i18n.resolvedLanguage || i18n.language || 'en';
  const words = language === 'hi' ? {
    order: 'ऑर्डर', prescription: 'प्रिस्क्रिप्शन', request: 'अनुरोध', minutes: 'मिनट',
    hours: 'घंटे', days: 'दिन', items: 'आइटम', medicines: 'दवाएँ', confidence: 'विश्वसनीयता', away: 'दूर',
  } : language === 'mr' ? {
    order: 'ऑर्डर', prescription: 'प्रिस्क्रिप्शन', request: 'विनंती', minutes: 'मिनिटे',
    hours: 'तास', days: 'दिवस', items: 'वस्तू', medicines: 'औषधे', confidence: 'विश्वासपातळी', away: 'दूर',
  } : null;
  if (!words) return value;

  let dynamic = key
    .replace(/\bOrder(?=\s*#?\d)/gi, words.order)
    .replace(/\bPrescription(?=\s*#?\d)/gi, words.prescription)
    .replace(/\bRequest(?=\s*#?\d)/gi, words.request)
    .replace(/\bminutes?\b/gi, words.minutes)
    .replace(/\bhours?\b/gi, words.hours)
    .replace(/\bdays?\b/gi, words.days)
    .replace(/\bitems?\b/gi, words.items)
    .replace(/\bmedicines?\b/gi, words.medicines)
    .replace(/\bconfidence\b/gi, words.confidence)
    .replace(/\baway\b/gi, words.away);
  return dynamic === key && value !== key ? value : dynamic;
}

function translateNode(node: ReactNode): ReactNode {
  if (typeof node === 'string') return translateStatic(node);
  if (Array.isArray(node)) return node.map((child, index) => <React.Fragment key={index}>{translateNode(child)}</React.Fragment>);
  return node;
}

export const LocalizedText = forwardRef<React.ElementRef<typeof NativeText>, TextProps>(function LocalizedText({ children, ...props }, ref) {
  useTranslation(['translation', 'auto']);
  return <NativeText ref={ref} {...props}>{translateNode(children)}</NativeText>;
});

export const LocalizedTextInput = forwardRef<React.ElementRef<typeof NativeTextInput>, TextInputProps>(function LocalizedTextInput({ placeholder, ...props }, ref) {
  useTranslation(['translation', 'auto']);
  return <NativeTextInput ref={ref} placeholder={translateStatic(placeholder)} {...props} />;
});

export function LocalizedButton(props: ButtonProps) {
  useTranslation(['translation', 'auto']);
  return <NativeButton {...props} title={translateStatic(props.title) || props.title} />;
}
