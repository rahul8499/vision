import { LocalizedText as Text, LocalizedTextInput as TextInput } from '@/components/Language/LocalizedPrimitives';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  RefreshControl,
  ScrollView,
  TouchableOpacity,
  View,
  KeyboardAvoidingView,
  Platform,
  TextInput as RNTextInput,
} from 'react-native';
import { AntDesign, Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { useSelector } from 'react-redux';
import axios from 'axios';
import { RootState } from '../redux/store';

type Report = {
  id: number;
  reporter_type?: string;
  reporter_name?: string;
  target_type?: string;
  target_name: string;
  category: string;
  category_display: string;
  description: string;
  status: string;
  status_display: string;
  context_type: string;
  context_id?: number;
  prescription_id?: number;
  response_id?: number;
  resolution_note?: string;
  created_at: string;
  updated_at?: string;
};

// Enterprise Color Palette Tokens (Seller & Customer Safe)
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

const getStatusBadgeConfig = (status: string) => {
  switch (status) {
    case 'action_taken':
      return {
        bg: '#DCFCE7',
        border: '#86EFAC',
        text: PALETTE.successGreen,
        icon: 'check-circle-outline',
        label: 'Action Taken',
      };
    case 'under_review':
    case 'submitted':
    case 'pending':
      return {
        bg: '#FEF3C7',
        border: '#FDE68A',
        text: PALETTE.warningAmber,
        icon: 'clock-outline',
        label: 'Under Review',
      };
    case 'closed':
      return {
        bg: '#F1F5F9',
        border: '#CBD5E1',
        text: PALETTE.textSecondary,
        icon: 'archive-check-outline',
        label: 'Closed / Resolved',
      };
    default:
      return {
        bg: '#E8F4F5',
        border: '#B9DDE0',
        text: PALETTE.secondaryTeal,
        icon: 'shield-outline',
        label: status || 'Submitted',
      };
  }
};

const getCategoryIcon = (category: string) => {
  switch (category) {
    case 'prescription_tampering':
    case 'fake_prescription':
      return 'file-document-alert-outline';
    case 'abusive_behavior':
    case 'harassment':
      return 'account-alert-outline';
    case 'payment_dispute':
    case 'cod_fraud':
      return 'cash-remove';
    case 'fraudulent_order':
    case 'fake_order':
      return 'shield-alert-outline';
    case 'bulk_abuse':
      return 'package-variant-closed-remove';
    default:
      return 'shield-search';
  }
};

export default function SafetyReportsScreen({ role }: { role: 'user' | 'store' }) {
  const router = useRouter();
  const token = useSelector((s: RootState) => s.user.token);
  const base = Constants.expoConfig?.extra?.BASE_URL || '';

  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  // UI Filter States
  const [directionTab, setDirectionTab] = useState<'all' | 'raised_by_you' | 'against_you'>('all');
  const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'action_taken' | 'closed'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [guideModalOpen, setGuideModalOpen] = useState(false);
  const [hamburgerMenuOpen, setHamburgerMenuOpen] = useState(false);
  const [statusFilterModalOpen, setStatusFilterModalOpen] = useState(false);

  // New Report Modal State
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [referenceId, setReferenceId] = useState('');
  const [reportCategory, setReportCategory] = useState('fraudulent_order');
  const [reportDescription, setReportDescription] = useState('');
  const [createBusy, setCreateBusy] = useState(false);
  const [createError, setCreateError] = useState('');

  const isStore = role === 'store';

  const load = useCallback(
    async (refresh = false) => {
      if (refresh) setRefreshing(true);
      else setLoading(true);

      try {
        const r = await axios.get(`${base}/api/safety-reports/`, {
          headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
        });
        setReports(r.data.reports || []);
        setError('');
      } catch (e: any) {
        setError(e.response?.data?.error || 'Could not load safety reports.');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [base, token],
  );

  useEffect(() => {
    load();
  }, [load]);

  const handleCreateReport = async () => {
    if (!referenceId.trim()) {
      setCreateError('Please enter an Order or Enquiry Reference ID.');
      return;
    }
    if (!reportDescription.trim() || reportDescription.trim().length < 5) {
      setCreateError('Please provide a detailed description (at least 5 characters).');
      return;
    }

    try {
      setCreateBusy(true);
      setCreateError('');
      await axios.post(
        `${base}/api/safety-reports/`,
        {
          reference_id: referenceId.trim(),
          category: reportCategory,
          description: reportDescription.trim(),
        },
        {
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        },
      );

      setCreateModalOpen(false);
      setReferenceId('');
      setReportDescription('');
      setReportCategory('fraudulent_order');
      load(true);
    } catch (err: any) {
      setCreateError(err?.response?.data?.error || 'Failed to submit report. Verify reference ID.');
    } finally {
      setCreateBusy(false);
    }
  };

  // Direction & Filtered reports calculation
  const raisedByYouCount = reports.filter((r) => r.reporter_type === role).length;
  const againstYouCount = reports.filter((r) => r.reporter_type !== role).length;

  const filteredReports = reports.filter((r) => {
    const matchesDirection =
      directionTab === 'all'
        ? true
        : directionTab === 'raised_by_you'
        ? r.reporter_type === role
        : r.reporter_type !== role;

    const matchesTab =
      activeTab === 'all'
        ? true
        : activeTab === 'pending'
        ? ['under_review', 'submitted', 'pending'].includes(r.status)
        : activeTab === 'action_taken'
        ? r.status === 'action_taken'
        : r.status === 'closed';

    const query = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !query ||
      r.id.toString().includes(query) ||
      (r.target_name && r.target_name.toLowerCase().includes(query)) ||
      (r.reporter_name && r.reporter_name.toLowerCase().includes(query)) ||
      (r.category && r.category.toLowerCase().includes(query)) ||
      (r.category_display && r.category_display.toLowerCase().includes(query)) ||
      (r.status && r.status.toLowerCase().includes(query)) ||
      (r.status_display && r.status_display.toLowerCase().includes(query)) ||
      (r.description && r.description.toLowerCase().includes(query)) ||
      (r.context_id && r.context_id.toString().includes(query)) ||
      (r.prescription_id && r.prescription_id.toString().includes(query)) ||
      (r.response_id && r.response_id.toString().includes(query));

    return matchesDirection && matchesTab && matchesSearch;
  });

  const pendingCount = reports.filter((r) => ['under_review', 'submitted', 'pending'].includes(r.status)).length;
  const actionTakenCount = reports.filter((r) => r.status === 'action_taken').length;
  const closedCount = reports.filter((r) => r.status === 'closed').length;

  return (
    <View style={{ flex: 1, backgroundColor: PALETTE.bgLight }}>
      {/* ── Enterprise 3D Floating Navy & Teal Header Card ── */}
      <View style={{ paddingHorizontal: 14, paddingTop: 10, paddingBottom: 6, backgroundColor: PALETTE.bgLight }}>
        <LinearGradient
          colors={[PALETTE.primaryNavy, '#184C75', PALETTE.secondaryTeal]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            borderRadius: 22,
            paddingTop: 16,
            paddingBottom: 16,
            paddingHorizontal: 16,
            borderWidth: 1.5,
            borderColor: 'rgba(255, 255, 255, 0.25)',
            elevation: 8,
            shadowColor: '#123B5D',
            shadowOffset: { width: 0, height: 6 },
            shadowOpacity: 0.25,
            shadowRadius: 10,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
              <TouchableOpacity
                onPress={() => router.back()}
                activeOpacity={0.8}
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 12,
                  backgroundColor: 'rgba(255, 255, 255, 0.18)',
                  borderWidth: 1,
                  borderColor: 'rgba(255, 255, 255, 0.3)',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: 12,
                }}
              >
                <Feather name="arrow-left" size={18} color="#FFFFFF" />
              </TouchableOpacity>

              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={{ fontSize: 18, fontWeight: '900', color: '#FFFFFF', letterSpacing: 0.3 }}>
                    {isStore ? 'Safety & Reports' : 'Reports & Safety'}
                  </Text>
                  <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#4ADE80', marginLeft: 8 }} />
                </View>
                <Text style={{ fontSize: 9, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1, color: 'rgba(255, 255, 255, 0.85)', marginTop: 2 }}>
                  Private Moderation Hub
                </Text>
              </View>
            </View>

            {/* Right Header Action Buttons (Refresh & + Report ONLY) */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              {/* Live Refresh Icon Button */}
              <TouchableOpacity
                onPress={() => load(true)}
                disabled={refreshing || loading}
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
                }}
              >
                <Feather name="refresh-cw" size={15} color="#FFFFFF" style={{ transform: refreshing ? [{ rotate: '90deg' }] : [] }} />
              </TouchableOpacity>

              {/* New Safety Report Trigger Button */}
              <TouchableOpacity
                onPress={() => setCreateModalOpen(true)}
                activeOpacity={0.85}
                style={{
                  backgroundColor: '#4ADE80',
                  borderRadius: 12,
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  flexDirection: 'row',
                  alignItems: 'center',
                  elevation: 4,
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.15,
                  shadowRadius: 4,
                }}
              >
                <Feather name="plus-circle" size={15} color={PALETTE.primaryNavy} />
                <Text style={{ marginLeft: 5, fontSize: 11, fontWeight: '900', color: PALETTE.primaryNavy, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Report
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </LinearGradient>
      </View>

      {/* ── Single Line Sub-Header Control Bar: (Search Input -> Book Doc -> Filter -> Hamburger) ── */}
      <View style={{ backgroundColor: PALETTE.cardWhite, borderBottomWidth: 1, borderBottomColor: PALETTE.borderTeal, paddingHorizontal: 16, paddingVertical: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {/* 1. Realtime Search Input Bar (First / Leftmost) */}
          <View style={{ flex: 1, height: 38, backgroundColor: PALETTE.bgLight, borderRadius: 12, borderWidth: 1, borderColor: PALETTE.borderTeal, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10 }}>
            <Feather name="search" size={15} color={PALETTE.textSecondary} />
            <RNTextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search by ID, category..."
              placeholderTextColor={PALETTE.textSecondary}
              style={{ flex: 1, marginLeft: 6, fontSize: 12, fontWeight: '700', color: PALETTE.textMain, paddingVertical: 0 }}
            />
            {searchQuery ? (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Feather name="x-circle" size={14} color={PALETTE.textSecondary} />
              </TouchableOpacity>
            ) : null}
          </View>

          {/* 2. Book Document Guide Button */}
          <TouchableOpacity
            onPress={() => setGuideModalOpen(true)}
            activeOpacity={0.8}
            style={{
              width: 38,
              height: 38,
              borderRadius: 12,
              backgroundColor: PALETTE.bgLight,
              borderWidth: 1,
              borderColor: PALETTE.borderTeal,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <MaterialCommunityIcons name="book-open-page-variant-outline" size={19} color={PALETTE.secondaryTeal} />
          </TouchableOpacity>

          {/* 3. Status Filter Button (Sliders) */}
          <TouchableOpacity
            onPress={() => setStatusFilterModalOpen(true)}
            activeOpacity={0.8}
            style={{
              width: 38,
              height: 38,
              borderRadius: 12,
              backgroundColor: activeTab !== 'all' ? PALETTE.cardTealLight : PALETTE.bgLight,
              borderWidth: 1,
              borderColor: activeTab !== 'all' ? PALETTE.secondaryTeal : PALETTE.borderTeal,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Feather name="sliders" size={16} color={activeTab !== 'all' ? PALETTE.secondaryTeal : PALETTE.primaryNavy} />
          </TouchableOpacity>

          {/* 4. Hamburger Source Filter Button (Menu - Rightmost) */}
          <TouchableOpacity
            onPress={() => setHamburgerMenuOpen(true)}
            activeOpacity={0.8}
            style={{
              width: 38,
              height: 38,
              borderRadius: 12,
              backgroundColor: directionTab !== 'all' ? PALETTE.cardTealLight : PALETTE.bgLight,
              borderWidth: 1,
              borderColor: directionTab !== 'all' ? PALETTE.secondaryTeal : PALETTE.borderTeal,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Feather name="menu" size={18} color={directionTab !== 'all' ? PALETTE.secondaryTeal : PALETTE.primaryNavy} />
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Main Content Area ── */}
      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator color={PALETTE.secondaryTeal} size="large" />
          <Text style={{ marginTop: 12, fontSize: 12, fontWeight: '700', color: PALETTE.textSecondary }}>
            Fetching Confidential Moderation Log…
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} colors={[PALETTE.secondaryTeal]} />}
        >


          {/* ── Error Banner ── */}
          {error ? (
            <View style={{ backgroundColor: '#FEE2E2', borderRadius: 14, borderWidth: 1, borderColor: '#FCA5A5', padding: 14, marginBottom: 16, flexDirection: 'row', alignItems: 'center' }}>
              <MaterialCommunityIcons name="alert-circle-outline" size={20} color={PALETTE.errorRed} />
              <Text style={{ marginLeft: 10, flex: 1, fontSize: 12, fontWeight: '700', color: PALETTE.errorRed }}>{error}</Text>
            </View>
          ) : null}

          {/* ── Empty State ── */}
          {!error && filteredReports.length === 0 ? (
            <View style={{ backgroundColor: PALETTE.cardWhite, borderRadius: 24, borderWidth: 1, borderColor: PALETTE.borderTeal, padding: 32, alignItems: 'center', marginTop: 10 }}>
              <View style={{ width: 64, height: 64, borderRadius: 22, backgroundColor: PALETTE.cardTealLight, borderWidth: 1, borderColor: PALETTE.borderTeal, alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
                <MaterialCommunityIcons name="shield-check-outline" size={32} color={PALETTE.secondaryTeal} />
              </View>
              <Text style={{ fontSize: 16, fontWeight: '900', color: PALETTE.textMain, textAlign: 'center' }}>
                No Safety Reports Found
              </Text>
              <Text style={{ fontSize: 11, fontWeight: '600', color: PALETTE.textSecondary, textAlign: 'center', marginTop: 4, maxWidth: 260, lineHeight: 16 }}>
                {searchQuery || activeTab !== 'all'
                  ? 'No safety cases match your current filter or search criteria.'
                  : 'Your store account currently has zero active moderation or safety reports.'}
              </Text>
              <TouchableOpacity
                onPress={() => setCreateModalOpen(true)}
                activeOpacity={0.85}
                style={{
                  backgroundColor: PALETTE.primaryNavy,
                  borderRadius: 14,
                  paddingHorizontal: 18,
                  paddingVertical: 11,
                  flexDirection: 'row',
                  alignItems: 'center',
                  marginTop: 18,
                  borderWidth: 1,
                  borderColor: PALETTE.secondaryTeal,
                }}
              >
                <Feather name="plus-circle" size={16} color="#4ADE80" />
                <Text style={{ marginLeft: 8, fontSize: 11.5, fontWeight: '900', color: '#FFFFFF', textTransform: 'uppercase', letterSpacing: 0.8 }}>
                  File Safety Report
                </Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {/* ── Report Cards List ── */}
          {filteredReports.map((item) => {
            const badge = getStatusBadgeConfig(item.status);
            const categoryIcon = getCategoryIcon(item.category);

            return (
              <View
                key={item.id}
                style={{
                  backgroundColor: PALETTE.cardWhite,
                  borderRadius: 20,
                  borderWidth: 1,
                  borderColor: PALETTE.borderTeal,
                  padding: 16,
                  marginBottom: 14,
                  elevation: 3,
                  shadowColor: PALETTE.primaryNavy,
                  shadowOffset: { width: 0, height: 3 },
                  shadowOpacity: 0.06,
                  shadowRadius: 8,
                }}
              >
                {/* Header Row */}
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, paddingRight: 8 }}>
                    <View style={{ backgroundColor: PALETTE.primaryNavy, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
                      <Text style={{ fontSize: 9, fontWeight: '900', color: '#4ADE80', letterSpacing: 0.8 }}>
                        #SR-{item.id}
                      </Text>
                    </View>
                    <View style={{ backgroundColor: PALETTE.cardTealLight, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, marginLeft: 6, borderWidth: 1, borderColor: PALETTE.borderTeal }}>
                      <Text style={{ fontSize: 9, fontWeight: '800', color: PALETTE.textMain, textTransform: 'uppercase' }}>
                        {item.context_type} #{item.context_id || item.response_id || item.prescription_id || 'N/A'}
                      </Text>
                    </View>
                  </View>

                  {/* Status Badge */}
                  <View style={{ backgroundColor: badge.bg, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: badge.border, flexDirection: 'row', alignItems: 'center' }}>
                    <MaterialCommunityIcons name={badge.icon as any} size={12} color={badge.text} />
                    <Text style={{ fontSize: 9.5, fontWeight: '900', color: badge.text, marginLeft: 4, textTransform: 'uppercase' }}>
                      {item.status_display || badge.label}
                    </Text>
                  </View>
                </View>

                {/* Category & Target Info */}
                <View style={{ backgroundColor: PALETTE.bgLight, borderRadius: 14, padding: 12, borderWidth: 1, borderColor: PALETTE.borderTeal, marginBottom: 12 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                    <MaterialCommunityIcons name={categoryIcon as any} size={18} color={PALETTE.secondaryTeal} />
                    <Text style={{ marginLeft: 8, fontSize: 13.5, fontWeight: '900', color: PALETTE.textMain }}>
                      {item.category_display || item.category}
                    </Text>
                  </View>
                  <View style={{ marginLeft: 26, gap: 2 }}>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: PALETTE.textSecondary }}>
                      Filed By: <Text style={{ color: PALETTE.textMain, fontWeight: '900' }}>{item.reporter_type === (isStore ? 'store' : 'user') ? 'You' : item.reporter_name || (item.reporter_type === 'user' ? 'Customer' : 'Store')}</Text>
                    </Text>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: PALETTE.textSecondary }}>
                      Target: <Text style={{ color: PALETTE.textMain, fontWeight: '900' }}>{item.target_type === (isStore ? 'store' : 'user') ? (isStore ? 'Your Store' : 'Your Account') : item.target_name}</Text>
                    </Text>
                  </View>
                </View>

                {/* Description Body */}
                <Text style={{ fontSize: 12, fontWeight: '600', color: PALETTE.textMain, lineHeight: 18, marginBottom: 12 }}>
                  {item.description}
                </Text>

                {/* Official Resolution Note */}
                {item.resolution_note ? (
                  <View style={{ backgroundColor: PALETTE.cardTealLight, borderRadius: 14, borderWidth: 1, borderColor: PALETTE.borderTeal, padding: 12, marginBottom: 10 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                      <MaterialCommunityIcons name="shield-check-outline" size={16} color={PALETTE.secondaryTeal} />
                      <Text style={{ marginLeft: 6, fontSize: 10.5, fontWeight: '900', color: PALETTE.primaryNavy, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                        Official AARX Resolution Note
                      </Text>
                    </View>
                    <Text style={{ fontSize: 11, fontWeight: '600', color: PALETTE.textMain, lineHeight: 16 }}>
                      {item.resolution_note}
                    </Text>
                  </View>
                ) : null}

                {/* Footer Timestamp */}
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 8, borderTopWidth: 1, borderTopColor: '#E8F4F5' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <MaterialCommunityIcons name="calendar-clock-outline" size={12} color={PALETTE.textSecondary} />
                    <Text style={{ fontSize: 9.5, fontWeight: '700', color: PALETTE.textSecondary, marginLeft: 4 }}>
                      {new Date(item.created_at).toLocaleString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </Text>
                  </View>
                  <Text style={{ fontSize: 8.5, fontWeight: '800', color: PALETTE.secondaryTeal, textTransform: 'uppercase', letterSpacing: 0.8 }}>
                    Private Report
                  </Text>
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}

      {/* ── CREATE SAFETY REPORT MODAL ── */}
      <Modal
        visible={createModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => {
          if (!createBusy) setCreateModalOpen(false);
        }}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end' }}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ width: '100%' }}>
            <View style={{ backgroundColor: PALETTE.cardWhite, borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: '90%', overflow: 'hidden', borderWidth: 1, borderColor: PALETTE.borderTeal }}>
              {/* Header */}
              <LinearGradient
                colors={[PALETTE.primaryNavy, '#184C75', PALETTE.secondaryTeal]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{ paddingHorizontal: 20, paddingTop: 18, paddingBottom: 16 }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, paddingRight: 10 }}>
                    <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255, 255, 255, 0.14)', borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.25)', alignItems: 'center', justifyContent: 'center' }}>
                      <MaterialCommunityIcons name="shield-alert-outline" size={22} color="#4ADE80" />
                    </View>
                    <View style={{ marginLeft: 12, flex: 1 }}>
                      <Text style={{ fontSize: 16, fontWeight: '900', color: '#FFFFFF', letterSpacing: 0.5 }}>
                        File Safety Report
                      </Text>
                      <Text style={{ fontSize: 8.5, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1.2, color: 'rgba(255, 255, 255, 0.8)' }}>
                        Confidential Fraud & Misconduct Escalation
                      </Text>
                    </View>
                  </View>

                  <TouchableOpacity
                    onPress={() => setCreateModalOpen(false)}
                    disabled={createBusy}
                    style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(255, 255, 255, 0.15)', borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.25)', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <AntDesign name="close" size={18} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>
              </LinearGradient>

              {/* Form Body */}
              <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 35 }}>
                {createError ? (
                  <View style={{ backgroundColor: '#FEE2E2', borderRadius: 14, borderWidth: 1, borderColor: '#FCA5A5', padding: 12, marginBottom: 14, flexDirection: 'row', alignItems: 'center' }}>
                    <MaterialCommunityIcons name="alert-circle-outline" size={18} color={PALETTE.errorRed} />
                    <Text style={{ marginLeft: 8, flex: 1, fontSize: 11.5, fontWeight: '700', color: PALETTE.errorRed }}>{createError}</Text>
                  </View>
                ) : null}

                {/* Reference ID Input */}
                <View style={{ marginBottom: 14 }}>
                  <Text style={{ fontSize: 9.5, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1.2, color: PALETTE.textSecondary, marginBottom: 6, marginLeft: 4 }}>
                    Order or Enquiry Reference ID *
                  </Text>
                  <View style={{ backgroundColor: PALETTE.bgLight, borderRadius: 14, borderWidth: 1, borderColor: PALETTE.borderTeal, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14 }}>
                    <MaterialCommunityIcons name="pound" size={18} color={PALETTE.secondaryTeal} />
                    <TextInput
                      value={referenceId}
                      onChangeText={setReferenceId}
                      editable={!createBusy}
                      placeholder="e.g. 48 or 102"
                      keyboardType="numeric"
                      style={{ flex: 1, paddingVertical: 12, paddingLeft: 10, color: PALETTE.textMain, fontWeight: '700', fontSize: 13 }}
                      placeholderTextColor="#94A3B8"
                    />
                  </View>
                  <Text style={{ fontSize: 9, fontWeight: '700', color: PALETTE.secondaryTeal, marginTop: 4, marginLeft: 4 }}>
                    💡 Enter the Order # or Enquiry # assigned to your store in the Seller Dashboard.
                  </Text>
                </View>

                {/* Category Picker */}
                <View style={{ marginBottom: 14 }}>
                  <Text style={{ fontSize: 9.5, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1.2, color: PALETTE.textSecondary, marginBottom: 6, marginLeft: 4 }}>
                    Select Moderation Category *
                  </Text>

                  <View style={{ gap: 8 }}>
                    {[
                      { id: 'fraudulent_order', label: 'Fraudulent / Fake Order', desc: 'COD refusal, fake address or bogus order', icon: 'shield-alert-outline' },
                      { id: 'prescription_tampering', label: 'Prescription Tampering', desc: 'Altered, fake or illegal prescription', icon: 'file-document-alert-outline' },
                      { id: 'abusive_behavior', label: 'Abusive / Harassing Conduct', desc: 'Inappropriate language or harassment', icon: 'account-alert-outline' },
                      { id: 'payment_dispute', label: 'Payment / Delivery Abuse', desc: 'Unjustified chargebacks or delivery dispute', icon: 'cash-remove' },
                      { id: 'other', label: 'Other Safety Concern', desc: 'Any other platform policy violation', icon: 'dots-horizontal-circle-outline' },
                    ].map((cat) => {
                      const selected = reportCategory === cat.id;
                      return (
                        <TouchableOpacity
                          key={cat.id}
                          onPress={() => setReportCategory(cat.id)}
                          disabled={createBusy}
                          activeOpacity={0.8}
                          style={{
                            backgroundColor: selected ? PALETTE.cardTealLight : PALETTE.bgLight,
                            borderRadius: 14,
                            borderWidth: 1,
                            borderColor: selected ? PALETTE.secondaryTeal : PALETTE.borderTeal,
                            padding: 12,
                            flexDirection: 'row',
                            alignItems: 'center',
                          }}
                        >
                          <MaterialCommunityIcons
                            name={cat.icon as any}
                            size={20}
                            color={selected ? PALETTE.secondaryTeal : PALETTE.textSecondary}
                          />
                          <View style={{ marginLeft: 10, flex: 1 }}>
                            <Text style={{ fontSize: 12.5, fontWeight: '900', color: selected ? PALETTE.primaryNavy : PALETTE.textMain }}>
                              {cat.label}
                            </Text>
                            <Text style={{ fontSize: 9.5, fontWeight: '600', color: PALETTE.textSecondary, marginTop: 1 }}>
                              {cat.desc}
                            </Text>
                          </View>
                          <View
                            style={{
                              width: 18,
                              height: 18,
                              borderRadius: 9,
                              borderWidth: 2,
                              borderColor: selected ? PALETTE.secondaryTeal : '#CBD5E1',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            {selected ? <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: PALETTE.secondaryTeal }} /> : null}
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                {/* Description Input */}
                <View style={{ marginBottom: 18 }}>
                  <Text style={{ fontSize: 9.5, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1.2, color: PALETTE.textSecondary, marginBottom: 6, marginLeft: 4 }}>
                    Detailed Incident Description *
                  </Text>
                  <View style={{ backgroundColor: PALETTE.bgLight, borderRadius: 14, borderWidth: 1, borderColor: PALETTE.borderTeal }}>
                    <TextInput
                      value={reportDescription}
                      onChangeText={setReportDescription}
                      editable={!createBusy}
                      placeholder="Describe what happened, including relevant order details, conversation notes, or prescription issues..."
                      multiline
                      style={{ padding: 14, color: PALETTE.textMain, fontWeight: '600', minHeight: 90, fontSize: 12.5 }}
                      placeholderTextColor="#94A3B8"
                      textAlignVertical="top"
                    />
                  </View>
                </View>

                {/* Submit Action CTA Button */}
                <TouchableOpacity
                  onPress={handleCreateReport}
                  disabled={createBusy}
                  activeOpacity={0.82}
                  style={{
                    backgroundColor: PALETTE.primaryNavy,
                    borderRadius: 16,
                    paddingVertical: 14,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderWidth: 1,
                    borderColor: PALETTE.secondaryTeal,
                    elevation: 3,
                  }}
                >
                  {createBusy ? (
                    <ActivityIndicator color="#4ADE80" />
                  ) : (
                    <>
                      <Feather name="shield" size={18} color="#4ADE80" />
                      <Text style={{ marginLeft: 8, fontSize: 12, fontWeight: '900', color: '#FFFFFF', textTransform: 'uppercase', letterSpacing: 1 }}>
                        Submit Safety Report
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* ── System Rules & Documentation Modal Sheet ── */}
      <Modal visible={guideModalOpen} transparent animationType="slide" onRequestClose={() => setGuideModalOpen(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(16, 42, 67, 0.7)', justifyContent: 'flex-end' }}>
          <View style={{ height: '88%', backgroundColor: PALETTE.cardWhite, borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: 'hidden' }}>
            {/* Modal Header */}
            <LinearGradient
              colors={[PALETTE.primaryNavy, '#184C75', PALETTE.secondaryTeal]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{ padding: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
            >
              <View style={{ flex: 1, paddingRight: 10 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <MaterialCommunityIcons name="book-open-page-variant" size={22} color="#4ADE80" />
                  <Text style={{ marginLeft: 8, fontSize: 16, fontWeight: '900', color: '#FFFFFF', letterSpacing: 0.3 }}>
                    Safety & Moderation Guide
                  </Text>
                </View>
                <Text style={{ fontSize: 9.5, fontWeight: '700', color: 'rgba(255, 255, 255, 0.85)', marginTop: 2 }}>
                  Official Platform Policy, Rules & ID Resolution
                </Text>
              </View>

              <TouchableOpacity
                onPress={() => setGuideModalOpen(false)}
                style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(255, 255, 255, 0.18)', borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.3)', alignItems: 'center', justifyContent: 'center' }}
              >
                <AntDesign name="close" size={18} color="#FFFFFF" />
              </TouchableOpacity>
            </LinearGradient>

            {/* Modal Body Scroll */}
            <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
              {/* Section 1: Overview */}
              <View style={{ backgroundColor: PALETTE.cardTealLight, borderRadius: 16, borderWidth: 1, borderColor: PALETTE.borderTeal, padding: 14, marginBottom: 16 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                  <MaterialCommunityIcons name="shield-lock-outline" size={20} color={PALETTE.secondaryTeal} />
                  <Text style={{ fontSize: 13, fontWeight: '900', color: PALETTE.textMain, marginLeft: 8 }}>
                    🔒 Confidential Protection Hub
                  </Text>
                </View>
                <Text style={{ fontSize: 11, fontWeight: '600', color: PALETTE.textMain, lineHeight: 16 }}>
                  This moderation hub is managed independently by the **AARX Risk & Safety Team**. Reports filed here are kept strictly confidential and separate from standard customer support tickets.
                </Text>
              </View>

              {/* Section 2: ID Guidance */}
              <View style={{ marginBottom: 18 }}>
                <Text style={{ fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1, color: PALETTE.secondaryTeal, marginBottom: 8 }}>
                  🆔 How to Find Reference IDs
                </Text>
                <View style={{ backgroundColor: PALETTE.bgLight, borderRadius: 16, borderWidth: 1, borderColor: PALETTE.borderTeal, padding: 12, gap: 10 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                    <View style={{ width: 26, height: 26, borderRadius: 8, backgroundColor: PALETTE.primaryNavy, alignItems: 'center', justifyContent: 'center', marginTop: 2 }}>
                      <Text style={{ fontSize: 11, fontWeight: '900', color: '#4ADE80' }}>#</Text>
                    </View>
                    <View style={{ marginLeft: 10, flex: 1 }}>
                      <Text style={{ fontSize: 11.5, fontWeight: '900', color: PALETTE.textMain }}>Enquiry ID (#Number)</Text>
                      <Text style={{ fontSize: 10, fontWeight: '600', color: PALETTE.textSecondary, marginTop: 2 }}>
                        Look under the **Enquiries** tab on your Seller Dashboard. Use the card ID number (e.g. `48`).
                      </Text>
                    </View>
                  </View>

                  <View style={{ height: 1, backgroundColor: PALETTE.borderTeal }} />

                  <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                    <View style={{ width: 26, height: 26, borderRadius: 8, backgroundColor: PALETTE.secondaryTeal, alignItems: 'center', justifyContent: 'center', marginTop: 2 }}>
                      <Text style={{ fontSize: 11, fontWeight: '900', color: '#FFFFFF' }}>#</Text>
                    </View>
                    <View style={{ marginLeft: 10, flex: 1 }}>
                      <Text style={{ fontSize: 11.5, fontWeight: '900', color: PALETTE.textMain }}>Order ID (#Number)</Text>
                      <Text style={{ fontSize: 10, fontWeight: '600', color: PALETTE.textSecondary, marginTop: 2 }}>
                        Look under **Orders / Quoted / History** tabs. Use the `#` order number (e.g. `102`).
                      </Text>
                    </View>
                  </View>
                </View>
              </View>

              {/* Section 3: Categories */}
              <View style={{ marginBottom: 18 }}>
                <Text style={{ fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1, color: PALETTE.secondaryTeal, marginBottom: 8 }}>
                  🏷️ Report Categories
                </Text>
                <View style={{ gap: 8 }}>
                  {[
                    { title: 'Fraudulent & Fake Orders', desc: 'COD refusal, fake delivery addresses, or bogus orders.', icon: 'shield-alert-outline' },
                    { title: 'Prescription Tampering', desc: 'Illegal, altered, or invalid doctor prescription uploads.', icon: 'file-document-alert-outline' },
                    { title: 'Abusive & Unprofessional Conduct', desc: 'Harassment, abusive chat, or unprofessional behavior.', icon: 'account-alert-outline' },
                    { title: 'Payment & Delivery Disputes', desc: 'Unjustified dispute escalation or payment evasion.', icon: 'cash-remove' },
                  ].map((cat, i) => (
                    <View key={i} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: PALETTE.bgLight, borderRadius: 14, borderWidth: 1, borderColor: PALETTE.borderTeal, padding: 10 }}>
                      <MaterialCommunityIcons name={cat.icon as any} size={18} color={PALETTE.secondaryTeal} />
                      <View style={{ marginLeft: 10, flex: 1 }}>
                        <Text style={{ fontSize: 11, fontWeight: '800', color: PALETTE.textMain }}>{cat.title}</Text>
                        <Text style={{ fontSize: 9.5, fontWeight: '600', color: PALETTE.textSecondary }}>{cat.desc}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              </View>

              {/* Section 4: Lifecycle */}
              <View style={{ marginBottom: 20 }}>
                <Text style={{ fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1, color: PALETTE.secondaryTeal, marginBottom: 8 }}>
                  🚦 Status Lifecycle & Support Resolution
                </Text>
                <View style={{ backgroundColor: PALETTE.bgLight, borderRadius: 16, borderWidth: 1, borderColor: PALETTE.borderTeal, padding: 12, gap: 10 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                    <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, backgroundColor: '#FEF3C7', borderWidth: 1, borderColor: '#FDE68A', marginTop: 2 }}>
                      <Text style={{ fontSize: 9.5, fontWeight: '900', color: PALETTE.warningAmber }}>Under Review</Text>
                    </View>
                    <View style={{ marginLeft: 10, flex: 1 }}>
                      <Text style={{ fontSize: 10.5, fontWeight: '700', color: PALETTE.textMain }}>Initial Investigation</Text>
                      <Text style={{ fontSize: 9.5, fontWeight: '600', color: PALETTE.textSecondary }}>Assigned to AARX Moderation Staff to verify evidence and order history.</Text>
                    </View>
                  </View>

                  <View style={{ height: 1, backgroundColor: PALETTE.borderTeal }} />

                  <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                    <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, backgroundColor: '#DCFCE7', borderWidth: 1, borderColor: '#86EFAC', marginTop: 2 }}>
                      <Text style={{ fontSize: 9.5, fontWeight: '900', color: PALETTE.successGreen }}>Action Taken</Text>
                    </View>
                    <View style={{ marginLeft: 10, flex: 1 }}>
                      <Text style={{ fontSize: 10.5, fontWeight: '700', color: PALETTE.textMain }}>Moderation Step Executed</Text>
                      <Text style={{ fontSize: 9.5, fontWeight: '600', color: PALETTE.textSecondary }}>Support Officer issues Official Warning, Account Suspension, or Restores Account.</Text>
                    </View>
                  </View>

                  <View style={{ height: 1, backgroundColor: PALETTE.borderTeal }} />

                  <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                    <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: '#CBD5E1', marginTop: 2 }}>
                      <Text style={{ fontSize: 9.5, fontWeight: '900', color: PALETTE.textSecondary }}>Closed / Resolved</Text>
                    </View>
                    <View style={{ marginLeft: 10, flex: 1 }}>
                      <Text style={{ fontSize: 10.5, fontWeight: '700', color: PALETTE.textMain }}>Final Resolution Note</Text>
                      <Text style={{ fontSize: 9.5, fontWeight: '600', color: PALETTE.textSecondary }}>Official AARX Resolution Note attached and case finalized.</Text>
                    </View>
                  </View>
                </View>
              </View>

              {/* Close CTA Button */}
              <TouchableOpacity
                onPress={() => setGuideModalOpen(false)}
                activeOpacity={0.82}
                style={{ backgroundColor: PALETTE.primaryNavy, borderRadius: 14, paddingVertical: 12, alignItems: 'center', justifyContent: 'center' }}
              >
                <Text style={{ fontSize: 12, fontWeight: '900', color: '#FFFFFF', textTransform: 'uppercase', letterSpacing: 0.8 }}>
                  Understood & Close
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── 1. Hamburger Source Filter Sheet Modal (Only 3 Options) ── */}
      <Modal visible={hamburgerMenuOpen} transparent animationType="slide" onRequestClose={() => setHamburgerMenuOpen(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(16, 42, 67, 0.7)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: PALETTE.cardWhite, borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: 'hidden' }}>
            {/* Modal Header */}
            <LinearGradient
              colors={[PALETTE.primaryNavy, '#184C75', PALETTE.secondaryTeal]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{ padding: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
            >
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Feather name="menu" size={20} color="#4ADE80" />
                  <Text style={{ marginLeft: 8, fontSize: 16, fontWeight: '900', color: '#FFFFFF', letterSpacing: 0.3 }}>
                    Report Visibility Source
                  </Text>
                </View>
                <Text style={{ fontSize: 9.5, fontWeight: '700', color: 'rgba(255, 255, 255, 0.85)', marginTop: 2 }}>
                  Filter reports by origin and target
                </Text>
              </View>

              <TouchableOpacity
                onPress={() => setHamburgerMenuOpen(false)}
                style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(255, 255, 255, 0.18)', borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.3)', alignItems: 'center', justifyContent: 'center' }}
              >
                <AntDesign name="close" size={18} color="#FFFFFF" />
              </TouchableOpacity>
            </LinearGradient>

            <View style={{ padding: 20, paddingBottom: 35, gap: 10 }}>
              {[
                { id: 'all', label: 'All Reports', desc: 'Show all moderation reports in history', icon: 'layers-outline' },
                { id: 'raised_by_you', label: 'Raised By You', desc: 'Reports created & submitted by your account', icon: 'arrow-up-right' },
                { id: 'against_you', label: 'Against You', desc: 'Reports filed against your account by others', icon: 'arrow-down-left' },
              ].map((item) => {
                const selected = directionTab === item.id;
                return (
                  <TouchableOpacity
                    key={item.id}
                    onPress={() => {
                      setDirectionTab(item.id as any);
                      setHamburgerMenuOpen(false);
                    }}
                    activeOpacity={0.8}
                    style={{
                      backgroundColor: selected ? PALETTE.cardTealLight : PALETTE.bgLight,
                      borderRadius: 16,
                      borderWidth: 1,
                      borderColor: selected ? PALETTE.secondaryTeal : PALETTE.borderTeal,
                      padding: 14,
                      flexDirection: 'row',
                      alignItems: 'center',
                    }}
                  >
                    <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: selected ? PALETTE.secondaryTeal : PALETTE.cardWhite, borderWidth: 1, borderColor: selected ? PALETTE.secondaryTeal : PALETTE.borderTeal, alignItems: 'center', justifyContent: 'center' }}>
                      <MaterialCommunityIcons name={item.icon as any} size={20} color={selected ? '#FFFFFF' : PALETTE.secondaryTeal} />
                    </View>
                    <View style={{ marginLeft: 12, flex: 1 }}>
                      <Text style={{ fontSize: 13, fontWeight: '900', color: selected ? PALETTE.primaryNavy : PALETTE.textMain }}>
                        {item.label}
                      </Text>
                      <Text style={{ fontSize: 10, fontWeight: '600', color: PALETTE.textSecondary, marginTop: 2 }}>
                        {item.desc}
                      </Text>
                    </View>
                    {selected && <Feather name="check-circle" size={20} color={PALETTE.secondaryTeal} />}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>
      </Modal>

      {/* ── 2. Status Filter Sheet Modal ── */}
      <Modal visible={statusFilterModalOpen} transparent animationType="slide" onRequestClose={() => setStatusFilterModalOpen(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(16, 42, 67, 0.7)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: PALETTE.cardWhite, borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: 'hidden' }}>
            {/* Modal Header */}
            <LinearGradient
              colors={[PALETTE.primaryNavy, '#184C75', PALETTE.secondaryTeal]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{ padding: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
            >
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Feather name="sliders" size={18} color="#4ADE80" />
                  <Text style={{ marginLeft: 8, fontSize: 16, fontWeight: '900', color: '#FFFFFF', letterSpacing: 0.3 }}>
                    Case Status Filter
                  </Text>
                </View>
                <Text style={{ fontSize: 9.5, fontWeight: '700', color: 'rgba(255, 255, 255, 0.85)', marginTop: 2 }}>
                  Filter reports by moderation progress & status
                </Text>
              </View>

              <TouchableOpacity
                onPress={() => setStatusFilterModalOpen(false)}
                style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(255, 255, 255, 0.18)', borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.3)', alignItems: 'center', justifyContent: 'center' }}
              >
                <AntDesign name="close" size={18} color="#FFFFFF" />
              </TouchableOpacity>
            </LinearGradient>

            <View style={{ padding: 20, paddingBottom: 35, gap: 10 }}>
              {[
                { id: 'all', label: 'All Statuses', desc: 'No status filter applied — show all cases', color: '#64748B' },
                { id: 'pending', label: 'Under Review', desc: 'Active investigation being conducted by staff', color: PALETTE.warningAmber },
                { id: 'action_taken', label: 'Action Taken', desc: 'Official warning or suspension executed', color: PALETTE.successGreen },
                { id: 'closed', label: 'Closed / Resolved', desc: 'Investigation complete with resolution note', color: '#475569' },
              ].map((item) => {
                const selected = activeTab === item.id;
                return (
                  <TouchableOpacity
                    key={item.id}
                    onPress={() => {
                      setActiveTab(item.id as any);
                      setStatusFilterModalOpen(false);
                    }}
                    activeOpacity={0.8}
                    style={{
                      backgroundColor: selected ? PALETTE.cardTealLight : PALETTE.bgLight,
                      borderRadius: 16,
                      borderWidth: 1,
                      borderColor: selected ? PALETTE.secondaryTeal : PALETTE.borderTeal,
                      padding: 14,
                      flexDirection: 'row',
                      alignItems: 'center',
                    }}
                  >
                    <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: item.color }} />
                    <View style={{ marginLeft: 12, flex: 1 }}>
                      <Text style={{ fontSize: 13, fontWeight: '900', color: selected ? PALETTE.primaryNavy : PALETTE.textMain }}>
                        {item.label}
                      </Text>
                      <Text style={{ fontSize: 10, fontWeight: '600', color: PALETTE.textSecondary, marginTop: 2 }}>
                        {item.desc}
                      </Text>
                    </View>
                    {selected && <Feather name="check-circle" size={20} color={PALETTE.secondaryTeal} />}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
