import { LocalizedText as Text } from '@/components/Language/LocalizedPrimitives';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, TouchableOpacity, View } from 'react-native';
import { MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import { useIsFocused } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { getComplaintCounts } from '@/utils/complaintsApi';

// Cohesive Unified Palette (Strictly Navy & Teal)
const PALETTE = {
  primaryNavy: '#123B5D',
  secondaryTeal: '#0F8B8D',
  bgLight: '#F4F8FA',
  cardTealLight: '#E8F4F5',
  borderTeal: '#B9DDE0',
  cardWhite: '#FFFFFF',
  textMain: '#102A43',
  textSecondary: '#627D98',
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
    <ScrollView style={{ flex: 1, backgroundColor: PALETTE.bgLight }} contentContainerStyle={{ paddingBottom: 40 }}>
      <View style={{ paddingHorizontal: 16, paddingTop: 14, gap: 12 }}>
        {/* Primary CTA: Choose Order to File Complaint */}
        <TouchableOpacity
          onPress={openTransactions}
          activeOpacity={0.88}
          style={{
            backgroundColor: PALETTE.primaryNavy,
            borderRadius: 18,
            padding: 16,
            flexDirection: 'row',
            alignItems: 'center',
            elevation: 3,
            shadowColor: PALETTE.primaryNavy,
            shadowOffset: { width: 0, height: 3 },
            shadowOpacity: 0.15,
            shadowRadius: 5,
          }}
        >
          <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: 'rgba(15, 139, 141, 0.25)', borderWidth: 1, borderColor: PALETTE.secondaryTeal, alignItems: 'center', justifyContent: 'center' }}>
            <MaterialCommunityIcons name={isStore ? 'clipboard-text-outline' : 'script-text-outline'} size={22} color="#FFFFFF" />
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={{ fontSize: 15, fontWeight: '900', color: '#FFFFFF' }}>
              Choose a {complaintSource}
            </Text>
            <Text style={{ fontSize: 11, fontWeight: '600', color: 'rgba(255, 255, 255, 0.8)', marginTop: 2 }}>
              Select an order to file a verified complaint
            </Text>
          </View>
          <Feather name="chevron-right" size={20} color="#FFFFFF" />
        </TouchableOpacity>

        {/* Section Header */}
        <Text style={{ fontSize: 10, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1.2, color: PALETTE.textSecondary, marginTop: 6, marginLeft: 2 }}>
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
            borderRadius: 18,
            padding: 16,
            flexDirection: 'row',
            alignItems: 'center',
            elevation: 2,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.04,
            shadowRadius: 4,
          }}
        >
          <View style={{ width: 42, height: 42, borderRadius: 12, backgroundColor: PALETTE.cardTealLight, borderWidth: 1, borderColor: PALETTE.borderTeal, alignItems: 'center', justifyContent: 'center' }}>
            <MaterialCommunityIcons name="file-document-outline" size={20} color={PALETTE.secondaryTeal} />
          </View>

          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={{ fontSize: 14, fontWeight: '900', color: PALETTE.primaryNavy }}>
              Complaints Raised By You
            </Text>
            <Text style={{ fontSize: 10.5, fontWeight: '600', color: PALETTE.textSecondary, marginTop: 2 }}>
              Track case status & staff messages
            </Text>
          </View>

          {loading ? (
            <ActivityIndicator color={PALETTE.secondaryTeal} size="small" />
          ) : (
            <View style={{ backgroundColor: PALETTE.cardTealLight, borderWidth: 1, borderColor: PALETTE.borderTeal, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4, minWidth: 30, alignItems: 'center' }}>
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
            borderRadius: 18,
            padding: 16,
            flexDirection: 'row',
            alignItems: 'center',
            elevation: 2,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.04,
            shadowRadius: 4,
          }}
        >
          <View style={{ width: 42, height: 42, borderRadius: 12, backgroundColor: PALETTE.cardTealLight, borderWidth: 1, borderColor: PALETTE.borderTeal, alignItems: 'center', justifyContent: 'center' }}>
            <MaterialCommunityIcons name="shield-alert-outline" size={20} color={PALETTE.primaryNavy} />
          </View>

          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={{ fontSize: 14, fontWeight: '900', color: PALETTE.primaryNavy }}>
              Complaints Against You
            </Text>
            <Text style={{ fontSize: 10.5, fontWeight: '600', color: PALETTE.textSecondary, marginTop: 2 }}>
              Review & respond to customer disputes
            </Text>
          </View>

          {loading ? (
            <ActivityIndicator color={PALETTE.primaryNavy} size="small" />
          ) : (
            <View style={{ backgroundColor: PALETTE.cardTealLight, borderWidth: 1, borderColor: PALETTE.borderTeal, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4, minWidth: 30, alignItems: 'center' }}>
              <Text style={{ fontSize: 12, fontWeight: '900', color: PALETTE.primaryNavy }}>
                {counts.open_against || counts.against}
              </Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Contact Support */}
        <TouchableOpacity
          onPress={() => router.push('/platform-support')}
          activeOpacity={0.88}
          style={{
            backgroundColor: PALETTE.cardWhite,
            borderWidth: 1,
            borderColor: PALETTE.borderTeal,
            borderRadius: 18,
            padding: 16,
            flexDirection: 'row',
            alignItems: 'center',
            elevation: 2,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.04,
            shadowRadius: 4,
          }}
        >
          <View style={{ width: 42, height: 42, borderRadius: 12, backgroundColor: PALETTE.cardTealLight, borderWidth: 1, borderColor: PALETTE.borderTeal, alignItems: 'center', justifyContent: 'center' }}>
            <MaterialCommunityIcons name="headset" size={20} color={PALETTE.secondaryTeal} />
          </View>

          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={{ fontSize: 14, fontWeight: '900', color: PALETTE.primaryNavy }}>
              Contact AARX Support
            </Text>
            <Text style={{ fontSize: 10.5, fontWeight: '600', color: PALETTE.textSecondary, marginTop: 2 }}>
              Account, verification or app help
            </Text>
          </View>

          <Feather name="chevron-right" size={20} color={PALETTE.textSecondary} />
        </TouchableOpacity>

        {/* Essential Info Notice */}
        <View style={{ backgroundColor: PALETTE.cardTealLight, borderWidth: 1, borderColor: PALETTE.borderTeal, borderRadius: 14, padding: 12, flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
          <MaterialCommunityIcons name="shield-check-outline" size={18} color={PALETTE.secondaryTeal} />
          <Text style={{ fontSize: 10.5, fontWeight: '600', color: PALETTE.textMain, lineHeight: 15, flex: 1, marginLeft: 8 }}>
            Complaints are verified cases with direct staff oversight & audit logs.
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}
