import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  DeviceEventEmitter,
  Modal,
  RefreshControl,
  ScrollView,
  TouchableOpacity,
  View
} from 'react-native';
import { LocalizedText as Text } from '@/components/Language/LocalizedPrimitives';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import axios from 'axios';
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';

const BASE_URL = Constants.expoConfig?.extra?.BASE_URL;

type Reward = {
  id: number;
  prescription_id: number;
  points: number;
  response_seconds: number;
  created_at: string;
};

type RewardData = {
  points: number;
  tier: string;
  tier_label: string;
  fast_responder: boolean;
  fast_response_count: number;
  valid_quote_count: number;
  points_to_gold: number;
  recent_rewards: Reward[];
};

export default function EmergencyRewardsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ fromDrawer?: string; fromSettings?: string }>();

  const [data, setData] = useState<RewardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [guideModalVisible, setGuideModalVisible] = useState(false);

  const handleBack = () => {
    const isFromDrawer = params?.fromDrawer === 'true';
    const isFromSettings = params?.fromSettings === 'true';

    if (isFromSettings) {
      router.push('/(sellerTabs)/settings');
      return;
    }

    if (isFromDrawer) {
      if (router.canGoBack()) {
        router.back();
      } else {
        router.push('/(sellerTabs)/home');
      }
      setTimeout(() => {
        DeviceEventEmitter.emit('open-seller-drawer');
      }, 150);
      return;
    }

    if (router.canGoBack()) {
      router.back();
    } else {
      router.push('/(sellerTabs)/settings');
    }
  };

  const loadData = useCallback(async () => {
    try {
      const token = await SecureStore.getItemAsync('storeToken');
      const response = await axios.get(`${BASE_URL}/api/emergency-service/store/rewards/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setData(response.data);
    } catch (err) {
      console.warn('Failed to fetch emergency rewards', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F8FAFC' }}>
        <ActivityIndicator size="large" color="#0F8B8D" />
        <Text style={{ marginTop: 12, fontSize: 12, fontWeight: '700', color: '#64748B' }}>
          Loading Emergency Governance Data...
        </Text>
      </View>
    );
  }

  const currentPoints = data?.points || 0;
  const progressPercent = Math.min(100, Math.max(0, currentPoints));
  const pointsToNext = data?.points_to_gold || 0;

  return (
    <View style={{ flex: 1, backgroundColor: '#F4F7FA' }}>
      {/* ── ENTERPRISE NAVY/TEAL HEADER BANNER ── */}
      <View style={{ paddingTop: 0, paddingHorizontal: 16, paddingBottom: 4 }}>
        <LinearGradient
          colors={['#0D253F', '#123B5D', '#0F8B8D']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            paddingVertical: 18,
            paddingHorizontal: 16,
            borderRadius: 24,
            elevation: 8,
            shadowColor: '#123B5D',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.15,
            shadowRadius: 12
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={handleBack}
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: 'rgba(255, 255, 255, 0.15)',
                alignItems: 'center',
                justify: 'center',
                borderWidth: 1,
                borderColor: 'rgba(255, 255, 255, 0.25)'
              }}
            >
              <MaterialCommunityIcons name="arrow-left" size={22} color="#FFFFFF" />
            </TouchableOpacity>

            <View style={{ flex: 1, marginLeft: 14 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <MaterialCommunityIcons name="lightning-bolt" size={20} color="#F59E0B" />
                <Text style={{ fontSize: 20, fontWeight: '900', color: '#FFFFFF', marginLeft: 4 }}>
                  Emergency Rewards
                </Text>
              </View>
              <Text style={{ fontSize: 11, fontWeight: '600', color: '#B9DDE0', marginTop: 2 }}>
                Dispatch Speed & Store Tier Governance
              </Text>
            </View>

            {/* ── BOOK / SELLER GUIDE HANDBOOK BUTTON ── */}
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => setGuideModalVisible(true)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: '#F59E0B',
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderRadius: 20,
                elevation: 3,
                shadowColor: '#F59E0B',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.3,
                shadowRadius: 4
              }}
            >
              <MaterialCommunityIcons name="book-open-variant" size={18} color="#0D253F" />
              <Text style={{ fontSize: 11, fontWeight: '900', color: '#0D253F', marginLeft: 6 }}>
                Guide
              </Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 110 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadData();
            }}
            tintColor="#0F8B8D"
          />
        }
      >
        {/* ── HERO TIER STATUS CARD ── */}
        <LinearGradient
          colors={['#102A43', '#123B5D', '#0F8B8D']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            borderRadius: 24,
            padding: 20,
            marginBottom: 16,
            borderWidth: 1,
            borderColor: 'rgba(255, 255, 255, 0.2)',
            elevation: 6,
            shadowColor: '#123B5D',
            shadowOffset: { width: 0, height: 6 },
            shadowOpacity: 0.2,
            shadowRadius: 12
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(245, 158, 11, 0.2)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, borderWidth: 1, borderColor: '#F59E0B' }}>
              <MaterialCommunityIcons name="shield-crown" size={14} color="#F59E0B" />
              <Text style={{ fontSize: 10, fontWeight: '900', color: '#F59E0B', marginLeft: 4, textTransform: 'uppercase', letterSpacing: 1 }}>
                {data?.tier_label || 'Standard Tier'}
              </Text>
            </View>

            {data?.fast_responder && (
              <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(16, 185, 129, 0.2)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, borderWidth: 1, borderColor: '#10B981' }}>
                <MaterialCommunityIcons name="lightning-bolt-circle" size={14} color="#34D399" />
                <Text style={{ fontSize: 10, fontWeight: '900', color: '#34D399', marginLeft: 4 }}>
                  Fast Responder
                </Text>
              </View>
            )}
          </View>

          <View style={{ marginTop: 16, flexDirection: 'row', alignItems: 'baseline' }}>
            <Text style={{ fontSize: 44, fontWeight: '900', color: '#FFFFFF', letterSpacing: -1 }}>
              {currentPoints}
            </Text>
            <Text style={{ fontSize: 14, fontWeight: '700', color: '#B9DDE0', marginLeft: 8 }}>
              Emergency Points
            </Text>
          </View>

          {/* Progress Bar */}
          <View style={{ marginTop: 16 }}>
            <View style={{ height: 8, backgroundColor: 'rgba(255, 255, 255, 0.2)', borderRadius: 4, overflow: 'hidden' }}>
              <View style={{ height: '100%', width: `${progressPercent}%`, backgroundColor: '#F59E0B', borderRadius: 4 }} />
            </View>

            <View style={{ marginTop: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={{ fontSize: 11, fontWeight: '600', color: '#E2E8F0' }}>
                {pointsToNext > 0
                  ? `${pointsToNext} points needed for Gold Tier`
                  : '🏆 Gold Emergency Pharmacy Status Unlocked'}
              </Text>
              <Text style={{ fontSize: 11, fontWeight: '800', color: '#F59E0B' }}>
                {progressPercent}%
              </Text>
            </View>
          </View>
        </LinearGradient>

        {/* ── METRICS GRID ── */}
        <View style={{ flexDirection: 'row', gap: 12, marginBottom: 16 }}>
          <View style={{ flex: 1, backgroundColor: '#FFFFFF', borderRadius: 18, padding: 16, borderWidth: 1, borderColor: '#E2E8F0', elevation: 2 }}>
            <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: '#E0F2FE', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
              <MaterialCommunityIcons name="timer-sand-fast" size={20} color="#0284C7" />
            </View>
            <Text style={{ fontSize: 24, fontWeight: '900', color: '#0F172A' }}>
              {data?.fast_response_count || 0}
            </Text>
            <Text style={{ fontSize: 10, fontWeight: '800', color: '#64748B', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 2 }}>
              Fast Responses
            </Text>
          </View>

          <View style={{ flex: 1, backgroundColor: '#FFFFFF', borderRadius: 18, padding: 16, borderWidth: 1, borderColor: '#E2E8F0', elevation: 2 }}>
            <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: '#ECFDF5', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
              <MaterialCommunityIcons name="check-decagram" size={20} color="#10B981" />
            </View>
            <Text style={{ fontSize: 24, fontWeight: '900', color: '#0F172A' }}>
              {data?.valid_quote_count || 0}
            </Text>
            <Text style={{ fontSize: 10, fontWeight: '800', color: '#64748B', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 2 }}>
              Valid Quotations
            </Text>
          </View>
        </View>

        {/* ── RESPONSE SPEED MATRIX INFO CARD ── */}
        <View style={{ backgroundColor: '#FFFFFF', borderRadius: 20, padding: 18, marginBottom: 16, borderWidth: 1, borderColor: '#B9DDE0', elevation: 3 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
            <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: '#FFFBEB', alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
              <MaterialCommunityIcons name="speedometer" size={18} color="#D97706" />
            </View>
            <View>
              <Text style={{ fontSize: 14, fontWeight: '900', color: '#123B5D' }}>
                Response Speed Matrix
              </Text>
              <Text style={{ fontSize: 11, fontWeight: '600', color: '#64748B' }}>
                How points are automatically calculated
              </Text>
            </View>
          </View>

          <View style={{ gap: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#F8FAFC', padding: 10, borderRadius: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <MaterialCommunityIcons name="flash" size={16} color="#10B981" />
                <Text style={{ fontSize: 12, fontWeight: '700', color: '#1E293B', marginLeft: 6 }}>
                  Under 30 Seconds
                </Text>
              </View>
              <Text style={{ fontSize: 12, fontWeight: '900', color: '#10B981' }}>+10 Points</Text>
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#F8FAFC', padding: 10, borderRadius: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <MaterialCommunityIcons name="rocket-launch" size={16} color="#0284C7" />
                <Text style={{ fontSize: 12, fontWeight: '700', color: '#1E293B', marginLeft: 6 }}>
                  31 to 60 Seconds
                </Text>
              </View>
              <Text style={{ fontSize: 12, fontWeight: '900', color: '#0284C7' }}>+7 Points</Text>
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#F8FAFC', padding: 10, borderRadius: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <MaterialCommunityIcons name="clock-outline" size={16} color="#D97706" />
                <Text style={{ fontSize: 12, fontWeight: '700', color: '#1E293B', marginLeft: 6 }}>
                  61 to 120 Seconds
                </Text>
              </View>
              <Text style={{ fontSize: 12, fontWeight: '900', color: '#D97706' }}>+4 Points</Text>
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#F8FAFC', padding: 10, borderRadius: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <MaterialCommunityIcons name="check-circle-outline" size={16} color="#64748B" />
                <Text style={{ fontSize: 12, fontWeight: '700', color: '#1E293B', marginLeft: 6 }}>
                  Valid Quote Submission
                </Text>
              </View>
              <Text style={{ fontSize: 12, fontWeight: '900', color: '#64748B' }}>+1 Point</Text>
            </View>
          </View>
        </View>

        {/* ── RECENT REWARDS STREAM ── */}
        <Text style={{ fontSize: 12, fontWeight: '900', color: '#64748B', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 12, marginLeft: 4 }}>
          Recent Reward Log
        </Text>

        {!data?.recent_rewards || data.recent_rewards.length === 0 ? (
          <View style={{ backgroundColor: '#FFFFFF', borderRadius: 18, padding: 24, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#E2E8F0' }}>
            <MaterialCommunityIcons name="trophy-outline" size={36} color="#94A3B8" />
            <Text style={{ fontSize: 14, fontWeight: '700', color: '#475569', marginTop: 8 }}>
              No Recent Reward Activity
            </Text>
            <Text style={{ fontSize: 11, fontWeight: '500', color: '#94A3B8', textAlign: 'center', marginTop: 4 }}>
              Respond rapidly to incoming emergency prescription requests to earn your first points!
            </Text>
          </View>
        ) : (
          data.recent_rewards.map((item) => (
            <View
              key={item.id}
              style={{
                backgroundColor: '#FFFFFF',
                borderRadius: 18,
                padding: 16,
                marginBottom: 10,
                flexDirection: 'row',
                alignItems: 'center',
                borderWidth: 1,
                borderColor: '#E2E8F0',
                elevation: 2
              }}
            >
              <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#ECFDF5', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#A7F3D0' }}>
                <Text style={{ fontSize: 14, fontWeight: '900', color: '#059669' }}>
                  +{item.points}
                </Text>
              </View>

              <View style={{ flex: 1, marginLeft: 14 }}>
                <Text style={{ fontSize: 13, fontWeight: '900', color: '#0F172A' }}>
                  Emergency Request #{item.prescription_id}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                  <MaterialCommunityIcons name="clock-fast" size={13} color="#0F8B8D" />
                  <Text style={{ fontSize: 11, fontWeight: '600', color: '#64748B', marginLeft: 4 }}>
                    Responded in {item.response_seconds}s
                  </Text>
                </View>
              </View>

              <Text style={{ fontSize: 10, fontWeight: '700', color: '#94A3B8' }}>
                {new Date(item.created_at).toLocaleDateString()}
              </Text>
            </View>
          ))
        )}
      </ScrollView>

      {/* ── SELLER EMERGENCY HANDBOOK MODAL ── */}
      <Modal
        visible={guideModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setGuideModalVisible(false)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.65)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: '#FFFFFF', borderTopLeftRadius: 28, borderTopRightRadius: 28, height: '82%', padding: 20 }}>
            {/* Modal Drag Handle */}
            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: '#CBD5E1', alignSelf: 'center', marginBottom: 16 }} />

            {/* Modal Header */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#E2E8F0' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: '#FFFBEB', alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
                  <MaterialCommunityIcons name="book-open-page-variant" size={20} color="#D97706" />
                </View>
                <View>
                  <Text style={{ fontSize: 17, fontWeight: '900', color: '#123B5D' }}>
                    Seller Emergency Handbook
                  </Text>
                  <Text style={{ fontSize: 11, fontWeight: '600', color: '#64748B' }}>
                    Understanding emergency dispatch & rewards
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                onPress={() => setGuideModalVisible(false)}
                style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' }}
              >
                <MaterialCommunityIcons name="close" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ marginTop: 16 }}>
              {/* Section 1: Overview */}
              <View style={{ backgroundColor: '#F0F9FF', borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#BAE6FD' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                  <MaterialCommunityIcons name="shield-check" size={18} color="#0284C7" />
                  <Text style={{ fontSize: 14, fontWeight: '900', color: '#0369A1', marginLeft: 6 }}>
                    Why Emergency Rewards Matter
                  </Text>
                </View>
                <Text style={{ fontSize: 12, color: '#334155', leading: 18 }}>
                  When patients request emergency prescriptions, speed and accuracy save lives. AARX rewards fast-responding pharmacies with high platform priority and exclusive verified store badges.
                </Text>
              </View>

              {/* Section 2: Store Tiers */}
              <Text style={{ fontSize: 13, fontWeight: '900', color: '#123B5D', marginBottom: 10 }}>
                🏆 Tier Levels & Platform Benefits
              </Text>

              <View style={{ gap: 10, marginBottom: 16 }}>
                <View style={{ backgroundColor: '#F8FAFC', borderRadius: 14, padding: 12, borderWidth: 1, borderColor: '#E2E8F0' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Text style={{ fontSize: 13, fontWeight: '900', color: '#78350F' }}>🥉 Bronze Tier (0 – 49 pts)</Text>
                    <Text style={{ fontSize: 10, fontWeight: '800', color: '#92400E', backgroundColor: '#FEF3C7', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 }}>Standard</Text>
                  </View>
                  <Text style={{ fontSize: 11, color: '#64748B', marginTop: 4 }}>Standard dispatch notification order in your geographic zone.</Text>
                </View>

                <View style={{ backgroundColor: '#F8FAFC', borderRadius: 14, padding: 12, borderWidth: 1, borderColor: '#E2E8F0' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Text style={{ fontSize: 13, fontWeight: '900', color: '#475569' }}>🥈 Silver Tier (50 – 99 pts)</Text>
                    <Text style={{ fontSize: 10, fontWeight: '800', color: '#334155', backgroundColor: '#E2E8F0', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 }}>+15% Priority</Text>
                  </View>
                  <Text style={{ fontSize: 11, color: '#64748B', marginTop: 4 }}>Featured Silver badge on store profile and +15% search ranking boost.</Text>
                </View>

                <View style={{ backgroundColor: '#FFFBEB', borderRadius: 14, padding: 12, borderWidth: 1, borderColor: '#FDE68A' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Text style={{ fontSize: 13, fontWeight: '900', color: '#B45309' }}>🥇 Gold Tier (100 – 249 pts)</Text>
                    <Text style={{ fontSize: 10, fontWeight: '900', color: '#92400E', backgroundColor: '#FEF3C7', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 }}>Top 3 Recommended</Text>
                  </View>
                  <Text style={{ fontSize: 11, color: '#B45309', marginTop: 4 }}>Verified Gold Store Shield on patient app. Top 3 recommendation for all emergency orders.</Text>
                </View>

                <View style={{ backgroundColor: '#ECFDF5', borderRadius: 14, padding: 12, borderWidth: 1, borderColor: '#A7F3D0' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Text style={{ fontSize: 13, fontWeight: '900', color: '#047857' }}>💎 Platinum Elite (250+ pts)</Text>
                    <Text style={{ fontSize: 10, fontWeight: '900', color: '#065F46', backgroundColor: '#D1FAE5', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 }}>#1 Auto Route</Text>
                  </View>
                  <Text style={{ fontSize: 11, color: '#047857', marginTop: 4 }}>Direct #1 auto-route priority, zero extra platform fees, and dedicated account management.</Text>
                </View>
              </View>

              {/* Section 3: Pro Tips */}
              <Text style={{ fontSize: 13, fontWeight: '900', color: '#123B5D', marginBottom: 10 }}>
                💡 Tips to Maximize Response Speed
              </Text>

              <View style={{ backgroundColor: '#F8FAFC', borderRadius: 16, padding: 14, marginBottom: 24, gap: 10, borderWidth: 1, borderColor: '#E2E8F0' }}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                  <MaterialCommunityIcons name="volume-high" size={16} color="#0F8B8D" style={{ marginTop: 2 }} />
                  <Text style={{ fontSize: 11, color: '#334155', marginLeft: 8, flex: 1 }}>
                    <Text style={{ fontWeight: '800' }}>Keep Ringtone Alerts High</Text>: Turn on emergency alert sound in device settings to never miss a request.
                  </Text>
                </View>

                <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                  <MaterialCommunityIcons name="lightning-bolt" size={16} color="#F59E0B" style={{ marginTop: 2 }} />
                  <Text style={{ fontSize: 11, color: '#334155', marginLeft: 8, flex: 1 }}>
                    <Text style={{ fontWeight: '800' }}>Target Under 30s</Text>: Replying within 30 seconds gives you maximum +10 points per request!
                  </Text>
                </View>
              </View>
            </ScrollView>

            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => setGuideModalVisible(false)}
              style={{
                backgroundColor: '#123B5D',
                paddingVertical: 14,
                borderRadius: 99,
                alignItems: 'center',
                marginTop: 8
              }}
            >
              <Text style={{ fontSize: 13, fontWeight: '900', color: '#FFFFFF', textTransform: 'uppercase', letterSpacing: 1 }}>
                Got It, Close Handbook
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}
