import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { LocalizedText as Text, LocalizedTextInput as TextInput } from '@/components/Language/LocalizedPrimitives';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import axios from 'axios';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as IntentLauncher from 'expo-intent-launcher';
import { Linking } from 'react-native';
import Toast from 'react-native-toast-message';
import { useAppLanguage } from '@/context/LanguageContext';

interface SellerBusinessReportModalProps {
  visible: boolean;
  onClose: () => void;
  token: string | null;
  baseUrl: string;
  initialStartDate?: string;
  initialEndDate?: string;
  initialPreset?: string;
}

type PresetType = 'today' | '7days' | '30days' | 'this_month' | 'custom';

export default function SellerBusinessReportModal({
  visible,
  onClose,
  token,
  baseUrl,
  initialStartDate,
  initialEndDate,
  initialPreset,
}: SellerBusinessReportModalProps) {
  const { t } = useAppLanguage();

  // Helper to format Date to YYYY-MM-DD
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

  const [loadingData, setLoadingData] = useState(false);
  const [reportData, setReportData] = useState<any>(null);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  // Sync with initial props when modal becomes visible
  useEffect(() => {
    if (visible) {
      if (initialStartDate && initialEndDate) {
        setStartDate(initialStartDate);
        setEndDate(initialEndDate);
        if (initialPreset && ['today', '7days', '30days', 'this_month', 'custom'].includes(initialPreset)) {
          setPreset(initialPreset as PresetType);
        } else {
          setPreset('custom');
        }
      }
    }
  }, [visible, initialStartDate, initialEndDate, initialPreset]);

  // Fetch report data whenever modal becomes visible or dates change
  useEffect(() => {
    if (visible && token) {
      fetchReportPreview();
    }
  }, [visible, startDate, endDate, token]);

  const handlePresetSelect = (selectedPreset: PresetType) => {
    setPreset(selectedPreset);
    if (selectedPreset !== 'custom') {
      const dates = getPresetDates(selectedPreset);
      setStartDate(dates.startStr);
      setEndDate(dates.endStr);
    }
  };

  const fetchReportPreview = async () => {
    if (!token) return;
    try {
      setLoadingData(true);
      const res = await axios.get(
        `${baseUrl}/api/store/report/data/?start_date=${startDate}&end_date=${endDate}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      setReportData(res.data);
    } catch (err: any) {
      console.error('Failed to fetch report summary:', err);
      Toast.show({
        type: 'error',
        text1: 'Failed to load report summary',
        text2: err?.response?.data?.error || 'Please check your connection.',
        position: 'bottom',
      });
    } finally {
      setLoadingData(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (!token) {
      Toast.show({ type: 'error', text1: 'Authentication token missing' });
      return;
    }

    try {
      setDownloadingPdf(true);
      const pdfUrl = `${baseUrl}/api/store/report/pdf/?start_date=${startDate}&end_date=${endDate}`;

      if (Platform.OS === 'web') {
        window.open(pdfUrl, '_blank');
        Toast.show({
          type: 'success',
          text1: 'Opening PDF Report',
          text2: 'Report is opening in a new tab.',
          position: 'bottom',
        });
        return;
      }

      const fileName = `AARX_Seller_Report_${startDate}_to_${endDate}.pdf`;
      const fileUri = `${FileSystem.documentDirectory}${fileName}`;

      const downloadRes = await FileSystem.downloadAsync(pdfUrl, fileUri, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (downloadRes.status !== 200) {
        throw new Error(`Download failed with status ${downloadRes.status}`);
      }

      Toast.show({
        type: 'success',
        text1: 'Report Downloaded!',
        text2: 'PDF saved successfully to your device.',
        position: 'bottom',
      });

      // Offer to open or share
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(downloadRes.uri, {
          mimeType: 'application/pdf',
          dialogTitle: 'AARX Seller Business Report',
          UTI: 'com.adobe.pdf',
        });
      } else if (Platform.OS === 'android') {
        IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
          data: downloadRes.uri,
          flags: 1,
          type: 'application/pdf',
        });
      } else {
        await Linking.openURL(downloadRes.uri);
      }
    } catch (err: any) {
      console.error('PDF download error:', err);
      Alert.alert(
        'PDF Download Failed',
        'Could not download PDF report. You can try opening it directly in browser.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Open Link',
            onPress: () => Linking.openURL(`${baseUrl}/api/store/report/pdf/?start_date=${startDate}&end_date=${endDate}`),
          },
        ]
      );
    } finally {
      setDownloadingPdf(false);
    }
  };

  const financials = reportData?.financials || {};
  const orders = reportData?.orders || {};
  const enquiries = reportData?.enquiries || {};
  const replacements = reportData?.replacements || {};
  const complaints = reportData?.complaints || {};
  const insights = reportData?.insights || [];

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          {/* ── Modal Header ── */}
          <LinearGradient colors={['#123B5D', '#0F8B8D']} style={styles.modalHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <MaterialCommunityIcons name="file-pdf-box" size={28} color="#FFFFFF" style={{ marginRight: 8 }} />
              <View>
                <Text style={styles.modalHeaderTitle}>Business PDF Report</Text>
                <Text style={styles.modalHeaderSubtitle}>Download complete profit & order analysis</Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          </LinearGradient>

          <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
            {/* ── Date Range Presets ── */}
            <Text style={styles.sectionTitle}>Select Date Range (तारीख चुनें)</Text>
            <View style={styles.presetContainer}>
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

            {/* Custom Date Pickers */}
            {preset === 'custom' && (
              <View style={styles.customDateRow}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={styles.dateLabel}>Start Date (YYYY-MM-DD)</Text>
                  <TextInput
                    style={styles.dateInput}
                    value={startDate}
                    onChangeText={setStartDate}
                    placeholder="YYYY-MM-DD"
                  />
                </View>
                <View style={{ flex: 1, marginLeft: 8 }}>
                  <Text style={styles.dateLabel}>End Date (YYYY-MM-DD)</Text>
                  <TextInput
                    style={styles.dateInput}
                    value={endDate}
                    onChangeText={setEndDate}
                    placeholder="YYYY-MM-DD"
                  />
                </View>
              </View>
            )}

            {/* Selected Period Badge */}
            <View style={styles.periodBadge}>
              <Ionicons name="calendar-outline" size={16} color="#0F8B8D" style={{ marginRight: 6 }} />
              <Text style={styles.periodBadgeText}>
                Period: {reportData?.period?.period_label || `${startDate} to ${endDate}`}
              </Text>
            </View>

            {/* Loading Indicator */}
            {loadingData ? (
              <View style={styles.loadingBox}>
                <ActivityIndicator size="large" color="#0F8B8D" />
                <Text style={styles.loadingText}>Calculating business analytics...</Text>
              </View>
            ) : (
              <>
                {/* ── Key Metrics Preview Cards ── */}
                <Text style={styles.sectionTitle}>Summary Overview (संक्षेप)</Text>
                <View style={styles.statsGrid}>
                  <View style={[styles.statCard, { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' }]}>
                    <Ionicons name="wallet-outline" size={20} color="#1D4ED8" />
                    <Text style={styles.statVal}>₹{financials.gross_revenue?.toLocaleString('en-IN') || '0.00'}</Text>
                    <Text style={styles.statLbl}>Gross Revenue</Text>
                  </View>

                  <View style={[styles.statCard, { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' }]}>
                    <Ionicons name="checkmark-circle-outline" size={20} color="#047857" />
                    <Text style={styles.statVal}>{orders.completed || 0}</Text>
                    <Text style={styles.statLbl}>Completed Orders</Text>
                  </View>

                  <View style={[styles.statCard, { backgroundColor: '#F0FDFA', borderColor: '#99F6E4' }]}>
                    <MaterialCommunityIcons name="speedometer" size={20} color="#0F8B8D" />
                    <Text style={styles.statVal}>{orders.fulfillment_rate || 100}%</Text>
                    <Text style={styles.statLbl}>Fulfillment Rate</Text>
                  </View>

                  <View style={[styles.statCard, { backgroundColor: '#FEF3C7', borderColor: '#FDE68A' }]}>
                    <Ionicons name="cash-outline" size={20} color="#B45309" />
                    <Text style={styles.statVal}>₹{financials.estimated_payout?.toLocaleString('en-IN') || '0.00'}</Text>
                    <Text style={styles.statLbl}>Estimated Payout</Text>
                  </View>
                </View>

                {/* ── Detailed Breakdown Table ── */}
                <View style={styles.breakdownBox}>
                  <View style={styles.breakdownRow}>
                    <Text style={styles.breakdownKey}>Average Order Value (AOV):</Text>
                    <Text style={styles.breakdownVal}>₹{financials.avg_order_value?.toFixed(2) || '0.00'}</Text>
                  </View>

                  <View style={styles.breakdownRow}>
                    <Text style={styles.breakdownKey}>Cancelled Orders Revenue Lost:</Text>
                    <Text style={[styles.breakdownVal, { color: '#DC2626' }]}>
                      - ₹{financials.cancelled_revenue_lost?.toFixed(2) || '0.00'} ({orders.cancelled || 0} orders)
                    </Text>
                  </View>

                  <View style={styles.breakdownRow}>
                    <Text style={styles.breakdownKey}>Prescription Enquiries & Quotes:</Text>
                    <Text style={styles.breakdownVal}>
                      {enquiries.quotes_sent || 0} quotes sent ({enquiries.quote_conversion_rate || 0}% converted)
                    </Text>
                  </View>

                  <View style={styles.breakdownRow}>
                    <Text style={styles.breakdownKey}>Replacements Requested:</Text>
                    <Text style={styles.breakdownVal}>
                      {replacements.total_requests || 0} (Approved: {replacements.approved || 0})
                    </Text>
                  </View>

                  <View style={styles.breakdownRowLast}>
                    <Text style={styles.breakdownKey}>Complaints / Safety Reports:</Text>
                    <Text style={[styles.breakdownVal, { color: complaints.total_issues > 0 ? '#DC2626' : '#059669' }]}>
                      {complaints.total_issues || 0} reported issues
                    </Text>
                  </View>
                </View>

                {/* ── Profit & Executive Insights (Fayda Summary) ── */}
                {insights.length > 0 && (
                  <View style={styles.insightsCard}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                      <Ionicons name="sparkles-outline" size={18} color="#0284C7" style={{ marginRight: 6 }} />
                      <Text style={styles.insightsTitle}>Performance & Profit Insights (फायदे का विश्लेषण)</Text>
                    </View>
                    {insights.map((item: string, idx: number) => (
                      <View key={`insight-${idx}`} style={{ flexDirection: 'row', alignItems: 'flex-start', marginTop: 4 }}>
                        <Text style={styles.bulletPoint}>• </Text>
                        <Text style={styles.insightsText}>{item}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </>
            )}

            <View style={{ height: 20 }} />
          </ScrollView>

          {/* ── Modal Footer Action ── */}
          <View style={styles.modalFooter}>
            <TouchableOpacity
              style={styles.downloadButton}
              onPress={handleDownloadPdf}
              disabled={downloadingPdf || loadingData}
            >
              <LinearGradient colors={['#0F8B8D', '#123B5D']} style={styles.gradientBtn}>
                {downloadingPdf ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <>
                    <MaterialCommunityIcons name="file-pdf-box" size={22} color="#FFFFFF" style={{ marginRight: 8 }} />
                    <Text style={styles.downloadBtnText}>Download PDF Report (PDF डाउनलोड करें)</Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#F8FAFC',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    overflow: 'hidden',
  },
  modalHeader: {
    paddingHorizontal: 18,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalHeaderTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  modalHeaderSubtitle: {
    fontSize: 12,
    color: '#E2E8F0',
    marginTop: 2,
  },
  closeButton: {
    padding: 6,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  modalBody: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#123B5D',
    marginBottom: 10,
  },
  presetContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 14,
    gap: 6,
  },
  presetChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#E2E8F0',
  },
  presetChipActive: {
    backgroundColor: '#0F8B8D',
  },
  presetText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  presetTextActive: {
    color: '#FFFFFF',
  },
  customDateRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  dateLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 4,
  },
  dateInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: '#0F172A',
  },
  periodBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E0F2FE',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 16,
    alignSelf: 'flex-start',
  },
  periodBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0369A1',
  },
  loadingBox: {
    padding: 30,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 13,
    color: '#64748B',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 16,
    gap: 8,
  },
  statCard: {
    width: '48%',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'flex-start',
  },
  statVal: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 6,
  },
  statLbl: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
    marginTop: 2,
  },
  breakdownBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    marginBottom: 16,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  breakdownRowLast: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 8,
  },
  breakdownKey: {
    fontSize: 12,
    fontWeight: '500',
    color: '#475569',
    flex: 1,
  },
  breakdownVal: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  insightsCard: {
    backgroundColor: '#F0F9FF',
    borderWidth: 1,
    borderColor: '#BAE6FD',
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
  },
  insightsTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0369A1',
  },
  bulletPoint: {
    fontSize: 14,
    color: '#0284C7',
    fontWeight: 'bold',
  },
  insightsText: {
    fontSize: 12,
    color: '#334155',
    lineHeight: 17,
    flex: 1,
  },
  modalFooter: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  downloadButton: {
    borderRadius: 14,
    overflow: 'hidden',
    elevation: 3,
  },
  gradientBtn: {
    flexDirection: 'row',
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  downloadBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
