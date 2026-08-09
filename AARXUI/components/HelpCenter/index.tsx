import { LocalizedText as Text, LocalizedTextInput as TextInput } from '@/components/Language/LocalizedPrimitives';
import React, { useMemo, useState } from 'react';
import {
  Alert,
  Linking,
  ScrollView,
  TouchableOpacity,
  View
} from 'react-native';
import { MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';

const SUPPORT_PHONE = '7796216506';
const SUPPORT_EMAIL = 'support@aarx.in';
type Role = 'user' | 'store';
type FAQ = { q: string; a: string; tags: string };

// Enterprise Color Palette
const PALETTE = {
  primaryNavy: '#123B5D',
  secondaryTeal: '#0F8B8D',
  bgLight: '#F4F8FA',
  cardTealLight: '#E8F4F5',
  borderTeal: '#B9DDE0',
  cardWhite: '#FFFFFF',
  textMain: '#102A43',
  textSecondary: '#627D98',
  successGreen: '#16A34A',
  warningAmber: '#F59E0B',
  errorRed: '#DC2626',
};

const COMMON: FAQ[] = [
  { q: 'How do I contact AARX about an app or account problem?', a: 'Open Contact AARX Support below and create a ticket. Add the error message, steps that caused it, and a screenshot when possible. You can track replies and status inside the app.', tags: 'app bug account login technical ticket' },
  { q: 'What is the difference between a complaint and a support request?', a: 'Use a complaint for a formal dispute with a pharmacy or patient. Use AARX Support for app bugs, account access, verification, subscription, billing, or other platform problems.', tags: 'complaint report support dispute' },
  { q: 'Where can I track my complaints and reports?', a: 'Open Settings, then Help & Complaints for formal cases. Open Reports & Safety for private moderation reports. Platform support tickets remain in Contact AARX Support.', tags: 'track complaint report safety status' },
  { q: 'How do I keep my account secure?', a: 'Never share your OTP, password, payment PIN, or full card details. AARX Support will not ask for these. Report suspicious activity through an account support ticket immediately.', tags: 'security otp fraud password' },
  { q: 'The app is not updating or loading. What should I try?', a: 'Check your internet connection, close and reopen the app, and install the latest available version. If the issue continues, create a technical support ticket with a screenshot.', tags: 'loading network update crash technical' },
];

const USER: FAQ[] = [
  { q: 'How do I upload and manage a prescription?', a: 'Use Upload from the home tab, choose a clear prescription image, and submit it. You can review pharmacy responses in Offers and accepted orders in Orders.', tags: 'prescription upload offers order' },
  { q: 'What should I do if an order or medicine is incorrect?', a: 'Contact the pharmacy from the order first when appropriate. For a formal dispute such as wrong medicine, overcharging, or non-delivery, raise a complaint and include order evidence.', tags: 'wrong medicine delivery refund order' },
  { q: 'How can I update my profile or delivery address?', a: 'Open Settings and use your account details section to update your email, address, and pincode.', tags: 'profile address email pincode' },
];

const STORE: FAQ[] = [
  { q: 'How do I manage enquiries and active orders?', a: 'New prescription requests appear in Enquiry. Respond with a clear quotation, then manage accepted work from Orders and use Chat for order communication.', tags: 'enquiry quotation order chat' },
  { q: 'What if seller verification or documents are rejected?', a: 'Review the document requirement and upload a clear valid file. If the reason is unclear, create a Verification support ticket so the AARX team can review it.', tags: 'seller verification document rejected' },
  { q: 'Where can I manage billing and subscription?', a: 'Open Settings, then Billing & Subscriptions. For payment, invoice, or plan activation problems, create a Subscription & billing support ticket.', tags: 'billing subscription plan invoice payment' },
  { q: 'How do I handle a dispute with a patient?', a: 'Use Help & Complaints to raise or respond to a formal case. Include the related order and factual evidence. Do not use platform support for patient disputes.', tags: 'patient complaint dispute seller' },
];

function ContactCard({
  icon,
  title,
  subtitle,
  onPress,
  iconColor,
}: {
  icon: string;
  title: string;
  subtitle: string;
  onPress: () => void;
  iconColor?: string;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.88}
      style={{
        backgroundColor: PALETTE.cardWhite,
        borderWidth: 1,
        borderColor: PALETTE.borderTeal,
        borderRadius: 18,
        padding: 16,
        marginBottom: 12,
        flexDirection: 'row',
        alignItems: 'center',
        elevation: 2,
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 4,
      }}
    >
      <View
        style={{
          width: 44,
          height: 44,
          borderRadius: 14,
          backgroundColor: PALETTE.cardTealLight,
          borderWidth: 1,
          borderColor: PALETTE.borderTeal,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <MaterialCommunityIcons name={icon as any} size={22} color={iconColor || PALETTE.secondaryTeal} />
      </View>
      <View style={{ flex: 1, marginLeft: 14 }}>
        <Text style={{ fontSize: 14.5, fontWeight: '900', color: PALETTE.primaryNavy }}>{title}</Text>
        <Text style={{ fontSize: 11.5, fontWeight: '600', color: PALETTE.textSecondary, marginTop: 2, lineHeight: 16 }}>{subtitle}</Text>
      </View>
      <MaterialCommunityIcons name="chevron-right" size={22} color={PALETTE.secondaryTeal} />
    </TouchableOpacity>
  );
}

export function HelpCenter({ role }: { role: Role }) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState<number | null>(null);

  const faqs = useMemo(() => {
    const all = [...(role === 'store' ? STORE : USER), ...COMMON];
    const q = query.trim().toLowerCase();
    return q ? all.filter((x) => (x.q + ' ' + x.a + ' ' + x.tags).toLowerCase().includes(q)) : all;
  }, [role, query]);

  const call = async () => {
    const url = 'tel:' + SUPPORT_PHONE;
    if (await Linking.canOpenURL(url)) Linking.openURL(url);
    else Alert.alert('Call support', 'Please call +91 ' + SUPPORT_PHONE);
  };

  const email = async () => {
    const subject = encodeURIComponent(role === 'store' ? 'AARX Seller Support' : 'AARX User Support');
    const url = `mailto:${SUPPORT_EMAIL}?subject=${subject}`;
    if (await Linking.canOpenURL(url)) Linking.openURL(url);
    else Alert.alert('Email support', SUPPORT_EMAIL);
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: PALETTE.bgLight }} contentContainerStyle={{ paddingBottom: 50 }} keyboardShouldPersistTaps="handled">
      {/* Floating Linear Gradient Header Banner */}
      <View style={{ paddingTop: 10, paddingBottom: 6 }}>
        <View
          style={{
            marginHorizontal: 16,
            borderRadius: 22,
            overflow: 'hidden',
            elevation: 6,
            shadowColor: PALETTE.primaryNavy,
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.25,
            shadowRadius: 8,
          }}
        >
          <LinearGradient
            colors={[PALETTE.primaryNavy, '#184C75', PALETTE.secondaryTeal]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ paddingHorizontal: 18, paddingVertical: 18 }}
          >
            <TouchableOpacity
              onPress={() => router.back()}
              activeOpacity={0.8}
              style={{
                width: 36,
                height: 36,
                borderRadius: 12,
                backgroundColor: 'rgba(255, 255, 255, 0.18)',
                borderWidth: 1,
                borderColor: 'rgba(255, 255, 255, 0.3)',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 12,
              }}
            >
              <Feather name="arrow-left" size={18} color="#FFFFFF" />
            </TouchableOpacity>

            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={{ fontSize: 10, fontWeight: '900', color: '#4ADE80', letterSpacing: 1.5, textTransform: 'uppercase' }}>
                {role === 'store' ? 'Seller' : 'Customer'} Help Centre
              </Text>
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#4ADE80', marginLeft: 6 }} />
            </View>

            <Text style={{ fontSize: 24, fontWeight: '900', color: '#FFFFFF', marginTop: 4 }}>How can we help?</Text>
            <Text style={{ fontSize: 11.5, fontWeight: '600', color: 'rgba(255, 255, 255, 0.85)', marginTop: 4, lineHeight: 17 }}>
              Find quick answers or contact the AARX team through the right support channel.
            </Text>

            {/* Search Input Box */}
            <View
              style={{
                backgroundColor: PALETTE.cardWhite,
                borderRadius: 16,
                marginTop: 16,
                paddingHorizontal: 14,
                flexDirection: 'row',
                alignItems: 'center',
                borderWidth: 1,
                borderColor: PALETTE.borderTeal,
              }}
            >
              <MaterialCommunityIcons name="magnify" size={20} color={PALETTE.secondaryTeal} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Search help articles"
                placeholderTextColor={PALETTE.textSecondary}
                style={{ flex: 1, paddingVertical: 12, paddingHorizontal: 10, fontSize: 13, color: PALETTE.textMain, fontWeight: '600' }}
              />
              {query ? (
                <TouchableOpacity onPress={() => setQuery('')}>
                  <MaterialCommunityIcons name="close-circle" size={18} color={PALETTE.textSecondary} />
                </TouchableOpacity>
              ) : null}
            </View>
          </LinearGradient>
        </View>
      </View>

      {/* Main Content Area */}
      <View style={{ paddingHorizontal: 16, marginTop: 8 }}>
        <Text style={{ fontSize: 10, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1.2, color: PALETTE.textSecondary, marginTop: 12, marginBottom: 10, marginLeft: 2 }}>
          Contact options
        </Text>
        <ContactCard
          icon="message-text-outline"
          title="Contact AARX Support"
          subtitle="Create and track an in-app ticket with screenshots"
          iconColor={PALETTE.secondaryTeal}
          onPress={() => router.push('/platform-support')}
        />
        <ContactCard
          icon="phone-outline"
          title="Call Support"
          subtitle={`+91 ${SUPPORT_PHONE} · Standard calling charges may apply`}
          iconColor={PALETTE.primaryNavy}
          onPress={call}
        />
        <ContactCard
          icon="email-outline"
          title="Email Support"
          subtitle={SUPPORT_EMAIL}
          iconColor={PALETTE.secondaryTeal}
          onPress={email}
        />
        <ContactCard
          icon="hand-heart-outline"
          title="Complaints & Disputes"
          subtitle={role === 'store' ? 'Formal cases involving a patient' : 'Formal cases involving a pharmacy'}
          iconColor={PALETTE.warningAmber}
          onPress={() => router.push('/support')}
        />

        <Text style={{ fontSize: 10, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1.2, color: PALETTE.textSecondary, marginTop: 16, marginBottom: 10, marginLeft: 2 }}>
          Frequently asked questions
        </Text>
        {faqs.length ? (
          faqs.map((x, i) => (
            <TouchableOpacity
              key={x.q}
              activeOpacity={0.88}
              onPress={() => setOpen(open === i ? null : i)}
              style={{
                backgroundColor: PALETTE.cardWhite,
                borderWidth: 1,
                borderColor: PALETTE.borderTeal,
                borderRadius: 18,
                padding: 16,
                marginBottom: 10,
                elevation: 1,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={{ fontSize: 13.5, fontWeight: '900', color: PALETTE.primaryNavy, flex: 1, paddingRight: 12, lineHeight: 18 }}>{x.q}</Text>
                <MaterialCommunityIcons name={open === i ? 'chevron-up' : 'chevron-down'} size={21} color={PALETTE.secondaryTeal} />
              </View>
              {open === i ? (
                <Text style={{ fontSize: 12, fontWeight: '600', color: PALETTE.textMain, lineHeight: 18, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: PALETTE.borderTeal }}>
                  {x.a}
                </Text>
              ) : null}
            </TouchableOpacity>
          ))
        ) : (
          <View style={{ alignItems: 'center', backgroundColor: PALETTE.cardWhite, borderWidth: 1, borderColor: PALETTE.borderTeal, borderRadius: 18, padding: 32 }}>
            <MaterialCommunityIcons name="text-search" size={32} color={PALETTE.secondaryTeal} />
            <Text style={{ fontSize: 14, fontWeight: '900', color: PALETTE.primaryNavy, marginTop: 12 }}>No matching help article</Text>
            <Text style={{ fontSize: 11.5, fontWeight: '600', color: PALETTE.textSecondary, marginTop: 4 }}>Try another search or contact support.</Text>
          </View>
        )}

        <View style={{ backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FCA5A5', borderRadius: 18, padding: 14, marginTop: 14, flexDirection: 'row' }}>
          <MaterialCommunityIcons name="alert-circle-outline" size={22} color={PALETTE.errorRed} />
          <Text style={{ fontSize: 11, fontWeight: '600', color: PALETTE.errorRed, lineHeight: 16, flex: 1, marginLeft: 10 }}>
            AARX Support does not provide emergency medical advice. For a medical emergency, contact local emergency services immediately.
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}
