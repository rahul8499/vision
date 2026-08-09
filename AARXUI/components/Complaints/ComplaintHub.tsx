import { LocalizedText as Text } from '@/components/Language/LocalizedPrimitives';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import { useIsFocused } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { getComplaintCounts } from '@/utils/complaintsApi';

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

export function ComplaintHub({ userType }: { userType: 'user' | 'store' }) {
  const router = useRouter();
  const focused = useIsFocused();
  const [counts, setCounts] = useState({ filed: 0, against: 0, open_against: 0 });
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setCounts(await getComplaintCounts());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (focused) load();
  }, [focused, load]);

  const isStore = userType === 'store';
  const complaintSource = isStore ? 'customer order' : 'pharmacy offer or order';
  const openTransactions = () => router.push((isStore ? '/(sellerTabs)/active-orders' : '/(tabs)/prescription') as any);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: PALETTE.bgLight }} contentContainerStyle={{ paddingBottom: 50 }}>
      {/* ── Enterprise Floating Header Banner (with marginHorizontal) ── */}
      <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 }}>
        <View
          style={{
            borderRadius: 24,
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
            style={{ padding: 22 }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
              <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: 'rgba(255, 255, 255, 0.18)', borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.3)', alignItems: 'center', justifyContent: 'center' }}>
                <MaterialCommunityIcons name="shield-half-full" size={24} color="#4ADE80" />
              </View>
              <View style={{ marginLeft: 12 }}>
                <Text style={{ fontSize: 20, fontWeight: '900', color: '#FFFFFF', letterSpacing: 0.3 }}>
                  Seller Support Center
                </Text>
                <Text style={{ fontSize: 9.5, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1.2, color: 'rgba(255, 255, 255, 0.85)', marginTop: 2 }}>
                  Private Case Resolution Hub
                </Text>
              </View>
            </View>

            <Text style={{ fontSize: 11.5, fontWeight: '600', color: 'rgba(255, 255, 255, 0.9)', lineHeight: 18 }}>
              Manage formal disputes, track case status updates, and communicate directly with platform staff.
            </Text>
          </LinearGradient>
        </View>
      </View>

      {/* ── Main Content Area ── */}
      <View style={{ paddingHorizontal: 16, marginTop: 4, gap: 12 }}>
        {/* Choose Order Card CTA */}
        <TouchableOpacity
          onPress={openTransactions}
          activeOpacity={0.88}
          style={{
            backgroundColor: PALETTE.secondaryTeal,
            borderRadius: 20,
            padding: 16,
            flexDirection: 'row',
            alignItems: 'center',
            elevation: 4,
            shadowColor: PALETTE.secondaryTeal,
            shadowOffset: { width: 0, height: 3 },
            shadowOpacity: 0.2,
            shadowRadius: 6,
          }}
        >
          <View style={{ width: 46, height: 46, borderRadius: 14, backgroundColor: 'rgba(255, 255, 255, 0.2)', alignItems: 'center', justifyContent: 'center' }}>
            <MaterialCommunityIcons name={isStore ? 'clipboard-list-outline' : 'script-text-outline'} size={24} color="#FFFFFF" />
          </View>
          <View style={{ flex: 1, marginLeft: 14 }}>
            <Text style={{ fontSize: 15, fontWeight: '900', color: '#FFFFFF', letterSpacing: 0.2 }}>
              Choose a {complaintSource}
            </Text>
            <Text style={{ fontSize: 11, fontWeight: '600', color: 'rgba(255, 255, 255, 0.9)', marginTop: 2 }}>
              Select an order card to file a linked complaint
            </Text>
          </View>
          <Feather name="chevron-right" size={22} color="#FFFFFF" />
        </TouchableOpacity>

        {/* Link Policy Banner */}
        <View style={{ backgroundColor: PALETTE.cardTealLight, borderWidth: 1, borderColor: PALETTE.borderTeal, borderRadius: 16, padding: 12, flexDirection: 'row', alignItems: 'flex-start' }}>
          <MaterialCommunityIcons name="information-outline" size={18} color={PALETTE.secondaryTeal} style={{ marginTop: 1 }} />
          <Text style={{ fontSize: 10.5, fontWeight: '600', color: PALETTE.textMain, lineHeight: 16, flex: 1, marginLeft: 8 }}>
            Complaints are strictly linked to a verified {isStore ? 'customer order' : 'enquiry'}. The respondent is automatically selected to protect user privacy.
          </Text>
        </View>

        {/* Section Label */}
        <Text style={{ fontSize: 10, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1.5, color: PALETTE.textSecondary, marginTop: 10, marginLeft: 4 }}>
          Case Resolution Desk
        </Text>

        {/* Complaints Raised By You */}
        <TouchableOpacity
          onPress={() => router.push('/support/filed')}
          activeOpacity={0.88}
          style={{
            backgroundColor: PALETTE.cardWhite,
            borderWidth: 1,
            borderColor: PALETTE.borderTeal,
            borderRadius: 20,
            padding: 16,
            flexDirection: 'row',
            alignItems: 'center',
            elevation: 2,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.05,
            shadowRadius: 4,
          }}
        >
          <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: PALETTE.cardTealLight, borderWidth: 1, borderColor: PALETTE.borderTeal, alignItems: 'center', justifyContent: 'center' }}>
            <MaterialCommunityIcons name="file-document-edit-outline" size={22} color={PALETTE.secondaryTeal} />
          </View>

          <View style={{ flex: 1, marginLeft: 14 }}>
            <Text style={{ fontSize: 14.5, fontWeight: '900', color: PALETTE.primaryNavy }}>
              Complaints Raised By You
            </Text>
            <Text style={{ fontSize: 10.5, fontWeight: '600', color: PALETTE.textSecondary, marginTop: 2 }}>
              Track case status, messages & resolutions
            </Text>
          </View>

          {loading ? (
            <ActivityIndicator color={PALETTE.secondaryTeal} />
          ) : (
            <View style={{ backgroundColor: PALETTE.cardTealLight, borderWidth: 1, borderColor: PALETTE.borderTeal, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4, minWidth: 32, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 12, fontWeight: '900', color: PALETTE.secondaryTeal }}>
                {counts.filed}
              </Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Complaints Filed Against You */}
        <TouchableOpacity
          onPress={() => router.push('/support/against')}
          activeOpacity={0.88}
          style={{
            backgroundColor: PALETTE.cardWhite,
            borderWidth: 1,
            borderColor: PALETTE.borderTeal,
            borderRadius: 20,
            padding: 16,
            flexDirection: 'row',
            alignItems: 'center',
            elevation: 2,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.05,
            shadowRadius: 4,
          }}
        >
          <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: '#FEF3C7', borderWidth: 1, borderColor: '#FDE68A', alignItems: 'center', justifyContent: 'center' }}>
            <MaterialCommunityIcons name="account-alert-outline" size={22} color={PALETTE.warningAmber} />
          </View>

          <View style={{ flex: 1, marginLeft: 14 }}>
            <Text style={{ fontSize: 14.5, fontWeight: '900', color: PALETTE.primaryNavy }}>
              Complaints Against You
            </Text>
            <Text style={{ fontSize: 10.5, fontWeight: '600', color: PALETTE.textSecondary, marginTop: 2 }}>
              Review and respond to customer dispute cases
            </Text>
          </View>

          {loading ? (
            <ActivityIndicator color={PALETTE.warningAmber} />
          ) : (
            <View style={{ backgroundColor: '#FEF3C7', borderWidth: 1, borderColor: '#FDE68A', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4, minWidth: 32, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 12, fontWeight: '900', color: PALETTE.warningAmber }}>
                {counts.open_against || counts.against}
              </Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Contact AARX Support CTA Card */}
        <TouchableOpacity
          onPress={() => router.push('/platform-support')}
          activeOpacity={0.88}
          style={{
            backgroundColor: PALETTE.primaryNavy,
            borderRadius: 20,
            padding: 16,
            flexDirection: 'row',
            alignItems: 'center',
            marginTop: 4,
            elevation: 5,
            shadowColor: PALETTE.primaryNavy,
            shadowOffset: { width: 0, height: 3 },
            shadowOpacity: 0.25,
            shadowRadius: 6,
          }}
        >
          <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: 'rgba(15, 139, 141, 0.3)', borderWidth: 1, borderColor: PALETTE.secondaryTeal, alignItems: 'center', justifyContent: 'center' }}>
            <MaterialCommunityIcons name="headset" size={22} color="#4ADE80" />
          </View>

          <View style={{ flex: 1, marginLeft: 14 }}>
            <Text style={{ fontSize: 15, fontWeight: '900', color: '#FFFFFF' }}>
              Contact AARX Support
            </Text>
            <Text style={{ fontSize: 10.5, fontWeight: '600', color: 'rgba(255, 255, 255, 0.85)', marginTop: 2 }}>
              App, account, verification, or technical assistance
            </Text>
          </View>

          <Feather name="chevron-right" size={22} color="#FFFFFF" />
        </TouchableOpacity>

        {/* Footer Policy Info */}
        <View style={{ backgroundColor: PALETTE.cardWhite, borderWidth: 1, borderColor: PALETTE.borderTeal, borderRadius: 18, padding: 14, flexDirection: 'row', alignItems: 'flex-start', marginTop: 4 }}>
          <MaterialCommunityIcons name="shield-check-outline" size={20} color={PALETTE.secondaryTeal} />
          <Text style={{ fontSize: 10.5, fontWeight: '600', color: PALETTE.textSecondary, lineHeight: 16, flex: 1, marginLeft: 10 }}>
            Complaints are formal cases with direct staff oversight and full audit logs. Private safety reports are accessible separately in Safety & Reports.
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}
