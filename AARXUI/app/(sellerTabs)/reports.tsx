import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { LocalizedText as Text, LocalizedTextInput as TextInput } from '@/components/Language/LocalizedPrimitives';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Constants from 'expo-constants';
import { useSelector } from 'react-redux';
import { RootState } from '../../redux/store';
import axios from 'axios';
import Toast from 'react-native-toast-message';
import SafetyReportsScreen from '@/components/SafetyReportsScreen';
import SellerBusinessReportModal from '@/components/SellerBusinessReportModal';
import { useAppLanguage } from '@/context/LanguageContext';

type TabType = 'business' | 'safety';
type PresetType = 'today' | '7days' | '30days' | 'this_month' | 'custom';

export default function ReportsScreen() {
  const BASE_URL = Constants.expoConfig?.extra?.BASE_URL || 'http://localhost:8000';
  const { token, user: storeData } = useSelector((state: RootState) => state.user);
  const { t } = useAppLanguage();

  const [activeTab, setActiveTab] = useState<TabType>('business');
  const [modalVisible, setModalVisible] = useState(false);

  // Helper for date formatting
  const formatDateStr = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const getPresetDates = (preset: PresetType) => {
    const today = new Date();
    let start = new Date();
    let end = new Date();

    if (preset === 'today') {
      start = today;
      end = today;
    } else if (preset === '7days') {
      start.setDate(today.getDate() - 6);
      end = today;
    } else if (preset === '30days') {
      start.setDate(today.getDate() - 29);
      end = today;
    } else if (preset === 'this_month') {
      start = new Date(today.getFullYear(), today.getMonth(), 1);
      end = today;
    }

    return {
      startStr: formatDateStr(start),
      endStr: formatDateStr(end),
    };
  };

  const [preset, setPreset] = useState<PresetType>('30days');
  const [startDate, setStartDate] = useState(getPresetDates('30days').startStr);
  const [endDate, setEndDate] = useState(getPresetDates('30days').endStr);

  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState<any>(null);

  useEffect(() => {
    if (activeTab === 'business' && token) {
      fetchReportData();
    }
  }, [activeTab, startDate, endDate, token]);

  const handlePresetSelect = (selectedPreset: PresetType) => {
    setPreset(selectedPreset);
    if (selectedPreset !== 'custom') {
      const dates = getPresetDates(selectedPreset);
      setStartDate(dates.startStr);
      setEndDate(dates.endStr);
    }
  };

  const fetchReportData = async () => {
    if (!token) return;
    try {
      setLoading(true);
      const res = await axios.get(
        `${BASE_URL}/api/store/report/data/?start_date=${startDate}&end_date=${endDate}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      setReportData(res.data);
    } catch (err: any) {
      console.error('Failed to fetch store report dataset:', err);
      Toast.show({
        type: 'error',
        text1: 'Could not load report',
        text2: err?.response?.data?.error || 'Please check server connection.',
        position: 'bottom',
      });
    } finally {
      setLoading(false);
    }
  };

  const financials = reportData?.financials || {};
  const orders = reportData?.orders || {};
  const enquiries = reportData?.enquiries || {};
  const replacements = reportData?.replacements || {};
  const complaints = reportData?.complaints || {};
  const topMedicines = reportData?.top_medicines || [];
  const insights = reportData?.insights || [];

  return (
    <View style={styles.container}>
      {/* ── Header Banner ── */}
      <View style={styles.headerContainer}>
        <LinearGradient
          colors={['#123B5D', '#184C75', '#0F8B8D']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.headerGradient}
        >
          <View style={styles.headerContent}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Image
                source={require('../../assets/images/aarxwhitelogo.png')}
                style={{ width: 100, height: 32 }}
                resizeMode="contain"
              />
              <View style={styles.headerDivider} />
              <Text style={styles.headerTitle}>REPORTS & ANALYTICS</Text>
            </View>
            <TouchableOpacity
              style={styles.pdfQuickBtn}
              onPress={() => setModalVisible(true)}
              activeOpacity={0.8}
            >
              <MaterialCommunityIcons name="file-pdf-box" size={18} color="#FFFFFF" />
              <Text style={styles.pdfQuickBtnText}>Download PDF</Text>
            </TouchableOpacity>
          </View>

          {/* Tab Switcher */}
          <View style={styles.tabBar}>
            <TouchableOpacity
              style={[styles.tabButton, activeTab === 'business' && styles.tabButtonActive]}
              onPress={() => setActiveTab('business')}
            >
              <Ionicons
                name="stats-chart"
                size={16}
                color={activeTab === 'business' ? '#123B5D' : '#94A3B8'}
                style={{ marginRight: 6 }}
              />
              <Text style={[styles.tabText, activeTab === 'business' && styles.tabTextActive]}>
                Business & PDF Report
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabButton, activeTab === 'safety' && styles.tabButtonActive]}
              onPress={() => setActiveTab('safety')}
            >
              <Ionicons
                name="shield-checkmark"
                size={16}
                color={activeTab === 'safety' ? '#123B5D' : '#94A3B8'}
                style={{ marginRight: 6 }}
              />
              <Text style={[styles.tabText, activeTab === 'safety' && styles.tabTextActive]}>
                Safety & Escalations
              </Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </View>

      {/* ── Tab Content ── */}
      {activeTab === 'safety' ? (
        <SafetyReportsScreen role="store" />
      ) : (
        <ScrollView style={styles.scrollBody} contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
          {/* ── Date Range Controls ── */}
          <View style={styles.cardBox}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <Text style={styles.cardHeaderTitle}>Select Date Range (समय अवधि)</Text>
              <View style={styles.liveBadge}>
                <View style={styles.liveDot} />
                <Text style={styles.liveText}>Real-Time Analytics</Text>
              </View>
            </View>

            <View style={styles.presetRow}>
              <TouchableOpacity
                style={[styles.presetChip, preset === 'today' && styles.presetChipActive]}
                onPress={() => handlePresetSelect('today')}
              >
                <Text style={[styles.presetText, preset === 'today' && styles.presetTextActive]}>Today</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.presetChip, preset === '7days' && styles.presetChipActive]}
                onPress={() => handlePresetSelect('7days')}
              >
                <Text style={[styles.presetText, preset === '7days' && styles.presetTextActive]}>7 Days</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.presetChip, preset === '30days' && styles.presetChipActive]}
                onPress={() => handlePresetSelect('30days')}
              >
                <Text style={[styles.presetText, preset === '30days' && styles.presetTextActive]}>30 Days</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.presetChip, preset === 'this_month' && styles.presetChipActive]}
                onPress={() => handlePresetSelect('this_month')}
              >
                <Text style={[styles.presetText, preset === 'this_month' && styles.presetTextActive]}>This Month</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.presetChip, preset === 'custom' && styles.presetChipActive]}
                onPress={() => handlePresetSelect('custom')}
              >
                <Text style={[styles.presetText, preset === 'custom' && styles.presetTextActive]}>Custom</Text>
              </TouchableOpacity>
            </View>

            {preset === 'custom' && (
              <View style={styles.customDateRow}>
                <View style={{ flex: 1, marginRight: 6 }}>
                  <Text style={styles.inputLbl}>From Date</Text>
                  <TextInput
                    style={styles.dateInput}
                    value={startDate}
                    onChangeText={setStartDate}
                    placeholder="YYYY-MM-DD"
                  />
                </View>
                <View style={{ flex: 1, marginLeft: 6 }}>
                  <Text style={styles.inputLbl}>To Date</Text>
                  <TextInput
                    style={styles.dateInput}
                    value={endDate}
                    onChangeText={setEndDate}
                    placeholder="YYYY-MM-DD"
                  />
                </View>
              </View>
            )}

            <View style={styles.periodBanner}>
              <Feather name="calendar" size={14} color="#0F8B8D" style={{ marginRight: 6 }} />
              <Text style={styles.periodText}>
                {reportData?.period?.period_label || `${startDate} to ${endDate}`}
              </Text>
            </View>
          </View>

          {/* Loading state */}
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#0F8B8D" />
              <Text style={{ marginTop: 10, fontSize: 13, color: '#64748B' }}>Fetching store financial metrics...</Text>
            </View>
          ) : (
            <>
              {/* ── Key Operational Metrics Cards ── */}
              <View style={styles.metricsGrid}>
                <View style={[styles.metricCard, { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' }]}>
                  <View style={styles.cardIconBox}>
                    <Ionicons name="wallet-outline" size={20} color="#1D4ED8" />
                  </View>
                  <Text style={styles.metricVal}>₹{financials.gross_revenue?.toLocaleString('en-IN') || '0.00'}</Text>
                  <Text style={styles.metricLbl}>Gross Revenue</Text>
                </View>

                <View style={[styles.metricCard, { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' }]}>
                  <View style={styles.cardIconBox}>
                    <Ionicons name="checkmark-done-circle-outline" size={20} color="#047857" />
                  </View>
                  <Text style={styles.metricVal}>{orders.completed || 0}</Text>
                  <Text style={styles.metricLbl}>Completed Orders</Text>
                </View>

                <View style={[styles.metricCard, { backgroundColor: '#F0FDFA', borderColor: '#99F6E4' }]}>
                  <View style={styles.cardIconBox}>
                    <MaterialCommunityIcons name="speedometer" size={20} color="#0F8B8D" />
                  </View>
                  <Text style={styles.metricVal}>{orders.fulfillment_rate || 100}%</Text>
                  <Text style={styles.metricLbl}>Fulfillment Rate</Text>
                </View>

                <View style={[styles.metricCard, { backgroundColor: '#FEF3C7', borderColor: '#FDE68A' }]}>
                  <View style={styles.cardIconBox}>
                    <Ionicons name="cash-outline" size={20} color="#B45309" />
                  </View>
                  <Text style={styles.metricVal}>₹{financials.estimated_payout?.toLocaleString('en-IN') || '0.00'}</Text>
                  <Text style={styles.metricLbl}>Est. Net Payout</Text>
                </View>
              </View>

              {/* ── Download PDF Banner Trigger ── */}
              <TouchableOpacity
                style={styles.pdfBannerCard}
                onPress={() => setModalVisible(true)}
                activeOpacity={0.88}
              >
                <LinearGradient colors={['#123B5D', '#0F8B8D']} style={styles.pdfBannerGradient}>
                  <View style={{ flex: 1, paddingRight: 10 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <MaterialCommunityIcons name="file-pdf-box" size={24} color="#FFFFFF" style={{ marginRight: 6 }} />
                      <Text style={styles.pdfBannerTitle}>Download Official PDF Report</Text>
                    </View>
                    <Text style={styles.pdfBannerSub}>
                      Generate complete printable PDF with financial audit statement, top selling items & recommendations.
                    </Text>
                  </View>
                  <View style={styles.pdfBannerActionBtn}>
                    <Text style={styles.pdfBannerActionText}>Generate PDF</Text>
                    <Feather name="arrow-right" size={16} color="#123B5D" style={{ marginLeft: 4 }} />
                  </View>
                </LinearGradient>
              </TouchableOpacity>

              {/* ── Financial & Order Breakdown Card ── */}
              <View style={styles.cardBox}>
                <Text style={styles.cardHeaderTitle}>Financial & Order Lifecycle Breakdown</Text>

                <View style={styles.tableRow}>
                  <Text style={styles.rowLabel}>Average Order Value (AOV):</Text>
                  <Text style={styles.rowVal}>₹{financials.avg_order_value?.toFixed(2) || '0.00'}</Text>
                </View>

                <View style={styles.tableRow}>
                  <Text style={styles.rowLabel}>Revenue Impact from Cancellations:</Text>
                  <Text style={[styles.rowVal, { color: '#DC2626' }]}>
                    - ₹{financials.cancelled_revenue_lost?.toFixed(2) || '0.00'} ({orders.cancelled || 0} orders)
                  </Text>
                </View>

                <View style={styles.tableRow}>
                  <Text style={styles.rowLabel}>Prescription Enquiries & Sent Quotes:</Text>
                  <Text style={styles.rowVal}>
                    {enquiries.total_prescriptions_received || 0} Received / {enquiries.quotes_sent || 0} Quotes Sent ({enquiries.quote_conversion_rate || 0}%)
                  </Text>
                </View>

                <View style={styles.tableRow}>
                  <Text style={styles.rowLabel}>Medicine Replacements Requested:</Text>
                  <Text style={styles.rowVal}>
                    {replacements.total_requests || 0} Total ({replacements.approved || 0} Approved, {replacements.rejected || 0} Rejected)
                  </Text>
                </View>

                <View style={styles.tableRowLast}>
                  <Text style={styles.rowLabel}>Customer Complaints & Safety Flags:</Text>
                  <Text style={[styles.rowVal, { color: complaints.total_issues > 0 ? '#DC2626' : '#059669' }]}>
                    {complaints.total_issues || 0} Logged
                  </Text>
                </View>
              </View>

              {/* ── Top Selling Medicines List ── */}
              {topMedicines.length > 0 && (
                <View style={styles.cardBox}>
                  <Text style={styles.cardHeaderTitle}>Top Selling Medicines (माँग में उत्पाद)</Text>

                  <View style={styles.medHeaderRow}>
                    <Text style={[styles.medHeaderCell, { width: 30 }]}>#</Text>
                    <Text style={[styles.medHeaderCell, { flex: 1 }]}>Medicine & Brand</Text>
                    <Text style={[styles.medHeaderCell, { width: 60, textAlign: 'right' }]}>Qty</Text>
                    <Text style={[styles.medHeaderCell, { width: 90, textAlign: 'right' }]}>Sales (₹)</Text>
                  </View>

                  {topMedicines.map((item: any, index: number) => (
                    <View key={index} style={styles.medDataRow}>
                      <Text style={[styles.medDataText, { width: 30, fontWeight: '700', color: '#0F8B8D' }]}>
                        {index + 1}
                      </Text>
                      <View style={{ flex: 1, paddingRight: 6 }}>
                        <Text style={styles.medNameText}>{item.name}</Text>
                        <Text style={styles.medBrandText}>{item.brand}</Text>
                      </View>
                      <Text style={[styles.medDataText, { width: 60, textAlign: 'right' }]}>{item.qty}</Text>
                      <Text style={[styles.medDataText, { width: 90, textAlign: 'right', fontWeight: '700', color: '#102A43' }]}>
                        ₹{item.revenue?.toFixed(2)}
                      </Text>
                    </View>
                  ))}
                </View>
              )}

              {/* ── Executive Profit & Growth Insights (Fayda Summary) ── */}
              {insights.length > 0 && (
                <View style={styles.insightsCardBox}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
                    <Ionicons name="sparkles" size={20} color="#0284C7" style={{ marginRight: 6 }} />
                    <Text style={styles.insightsHeader}>Profit & Growth Insights (व्यापार में फ़ायदा)</Text>
                  </View>
                  {insights.map((textItem: string, idx: number) => (
                    <View key={idx} style={styles.insightItemRow}>
                      <Text style={styles.insightBullet}>• </Text>
                      <Text style={styles.insightText}>{textItem}</Text>
                    </View>
                  ))}
                </View>
              )}
            </>
          )}
        </ScrollView>
      )}

      {/* ── PDF Generator Modal ── */}
      <SellerBusinessReportModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        token={token}
        baseUrl={BASE_URL}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  headerContainer: {
    backgroundColor: '#123B5D',
    elevation: 4,
  },
  headerGradient: {
    paddingTop: Platform.OS === 'ios' ? 44 : 32,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  headerDivider: {
    width: 2,
    height: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    marginHorizontal: 10,
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 1.2,
  },
  pdfQuickBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  pdfQuickBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
    marginLeft: 4,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 14,
    padding: 4,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    borderRadius: 10,
  },
  tabButtonActive: {
    backgroundColor: '#FFFFFF',
    elevation: 2,
  },
  tabText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#E2E8F0',
  },
  tabTextActive: {
    color: '#123B5D',
    fontWeight: '700',
  },
  scrollBody: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 14,
  },
  cardBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    marginBottom: 14,
    elevation: 2,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
  },
  cardHeaderTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#123B5D',
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
    marginRight: 4,
  },
  liveText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#047857',
  },
  presetRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginVertical: 10,
  },
  presetChip: {
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
  },
  presetChipActive: {
    backgroundColor: '#0F8B8D',
  },
  presetText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  presetTextActive: {
    color: '#FFFFFF',
  },
  customDateRow: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  inputLbl: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 4,
  },
  dateInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 12,
    color: '#0F172A',
  },
  periodBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  periodText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#0369A1',
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 14,
    gap: 8,
  },
  metricCard: {
    width: '48%',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  cardIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  metricVal: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  metricLbl: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
    marginTop: 2,
  },
  pdfBannerCard: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 14,
    elevation: 3,
  },
  pdfBannerGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
  },
  pdfBannerTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  pdfBannerSub: {
    fontSize: 11,
    color: '#E2E8F0',
    marginTop: 4,
    lineHeight: 15,
  },
  pdfBannerActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  pdfBannerActionText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#123B5D',
  },
  tableRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  tableRowLast: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 8,
  },
  rowLabel: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '500',
    flex: 1,
  },
  rowVal: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  medHeaderRow: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 8,
    marginTop: 10,
    marginBottom: 6,
  },
  medHeaderCell: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  medDataRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  medDataText: {
    fontSize: 12,
    color: '#334155',
  },
  medNameText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  medBrandText: {
    fontSize: 10,
    color: '#64748B',
  },
  insightsCardBox: {
    backgroundColor: '#F0F9FF',
    borderWidth: 1,
    borderColor: '#BAE6FD',
    borderRadius: 16,
    padding: 14,
    marginBottom: 20,
  },
  insightsHeader: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0369A1',
  },
  insightItemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 4,
  },
  insightBullet: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#0284C7',
  },
  insightText: {
    fontSize: 12,
    color: '#334155',
    lineHeight: 17,
    flex: 1,
  },
});
