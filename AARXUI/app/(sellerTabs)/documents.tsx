import { LocalizedText as Text } from '@/components/Language/LocalizedPrimitives';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import axios from 'axios';
import Constants from 'expo-constants';
import * as DocumentPicker from 'expo-document-picker';
import * as IntentLauncher from 'expo-intent-launcher';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Linking,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  TouchableOpacity,
  View
} from 'react-native';
import Toast from 'react-native-toast-message';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '../../redux/store';
import { fetchUserProfile } from '../../redux/userSlice';

const BASE_URL = Constants.expoConfig?.extra?.BASE_URL;

// ── Enterprise Color Palette ──
const THEME = {
  primaryNavy: '#123B5D',
  secondaryTeal: '#0F8B8D',
  background: '#F4F8FA',
  lightTealCard: '#E8F4F5',
  borderTeal: '#B9DDE0',
  whiteCard: '#FFFFFF',
  mainText: '#102A43',
  secondaryText: '#627D98',
  successGreen: '#16A34A',
  warningAmber: '#F59E0B',
  errorRed: '#DC2626',
};

export default function StoreDocumentsScreen() {
  const router = useRouter();
  const dispatch = useDispatch<AppDispatch>();
  const { user: storeData, token } = useSelector((state: RootState) => state.user);

  const [loading, setLoading] = useState(false);
  const [docUploadBusy, setDocUploadBusy] = useState(false);
  const [deleteVisible, setDeleteVisible] = useState(false);
  const [deleteField, setDeleteField] = useState('');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const fetchProfile = async () => {
    dispatch(fetchUserProfile());
  };

  const pickFileForField = async (field: string) => {
    try {
      const res = await DocumentPicker.getDocumentAsync({ type: '*/*' });
      if (res.canceled) return;

      const file = res.assets?.[0];
      if (!file) return;
      if (file.size && file.size > 2 * 1024 * 1024) {
        Toast.show({
          type: 'error',
          text1: 'File Too Large',
          text2: 'Please select a file under 2 MB',
          position: 'bottom',
        });
        return;
      }

      setDocUploadBusy(true);

      const fd = new FormData();
      fd.append(field, {
        uri: file.uri,
        name: file.name,
        type: file.mimeType || 'application/octet-stream',
      } as any);

      await axios.patch(
        `${BASE_URL}/api/store-me/`,
        fd,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'multipart/form-data',
          },
          transformRequest: (data) => data,
        }
      );

      await fetchProfile();
      Toast.show({
        type: 'success',
        text1: 'Upload Successful ✅',
        text2: `${file.name} has been securely uploaded.`,
        position: 'bottom',
      });
    } catch (e) {
      console.log('Upload error:', e);
      Toast.show({
        type: 'error',
        text1: 'Upload Failed',
        text2: 'Could not upload document. Please retry.',
        position: 'bottom',
      });
    } finally {
      setDocUploadBusy(false);
    }
  };

  const handleDeleteConfirmed = async (field: string) => {
    if (!token) return;

    try {
      setLoading(true);
      await axios.patch(
        `${BASE_URL}/api/store-me/`,
        { [field]: null },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );
      await fetchProfile();
      Toast.show({
        type: 'success',
        text1: 'Document Deleted',
        text2: 'Document has been safely removed.',
        position: 'bottom',
      });
    } catch (e) {
      console.log(e);
      Toast.show({
        type: 'error',
        text1: 'Delete Failed',
        text2: 'Could not remove document.',
        position: 'bottom',
      });
    } finally {
      setLoading(false);
      setDeleteVisible(false);
    }
  };

  const openPdfFile = async (uri: string) => {
    if (Platform.OS === 'android') {
      IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
        data: uri,
        flags: 1,
        type: 'application/pdf',
      });
    } else {
      await Linking.openURL(uri);
    }
  };

  const handleDocumentClick = (url: string) => {
    const isPdf = /\.pdf$/i.test(url);
    if (isPdf) {
      openPdfFile(url);
    } else {
      setPreviewUrl(url);
    }
  };

  // ── Calculate Document Compliance Progress ──
  const requiredDocs = ['store_license_document', 'owner_id_proof', 'store_image'];
  const uploadedCount = requiredDocs.filter(field => !!(storeData as any)?.[field]).length;
  const isFullyCompliant = uploadedCount === requiredDocs.length;

  const renderDocCard = (label: string, field: string, description: string) => {
    const url = (storeData as any)?.[field];
    const isUploaded = !!url;
    const isImage = url ? /\.(png|jpe?g|jpg)$/i.test(url) : false;

    return (
      <View style={[styles.docCard, isUploaded ? styles.docCardUploaded : styles.docCardPending]}>
        <View style={styles.docCardHeader}>
          <View style={[styles.docIconCircle, isUploaded ? styles.docIconCircleUploaded : styles.docIconCirclePending]}>
            <MaterialCommunityIcons
              name={isImage ? 'file-image-outline' : 'file-document-outline'}
              size={24}
              color={isUploaded ? THEME.secondaryTeal : THEME.secondaryText}
            />
          </View>

          <View style={{ flex: 1, marginLeft: 14 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={styles.docLabelText}>{label}</Text>
              <View style={[styles.statusBadge, isUploaded ? styles.statusBadgeVerified : styles.statusBadgePending]}>
                <View style={[styles.statusDot, { backgroundColor: isUploaded ? THEME.successGreen : THEME.warningAmber }]} />
                <Text style={[styles.statusBadgeText, { color: isUploaded ? THEME.successGreen : '#92400E' }]}>
                  {isUploaded ? 'VERIFIED' : 'ACTION REQUIRED'}
                </Text>
              </View>
            </View>
            <Text style={styles.docDescText}>{description}</Text>
          </View>
        </View>

        {isUploaded ? (
          <View style={styles.uploadedActionBox}>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => handleDocumentClick(url)}
              style={styles.viewDocButton}
            >
              <Feather name="eye" size={15} color={THEME.secondaryTeal} />
              <Text style={styles.viewDocButtonText} numberOfLines={1}>
                View Document
              </Text>
            </TouchableOpacity>

            <View style={styles.docIconActionGroup}>
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => pickFileForField(field)}
                style={styles.editIconButton}
              >
                <Feather name="edit-3" size={15} color={THEME.primaryNavy} />
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => {
                  setDeleteField(field);
                  setDeleteVisible(true);
                }}
                style={styles.deleteIconButton}
              >
                <Ionicons name="trash-outline" size={16} color={THEME.errorRed} />
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => pickFileForField(field)}
            style={styles.uploadDropzone}
          >
            <View style={styles.uploadCircleIcon}>
              <Feather name="upload-cloud" size={18} color={THEME.secondaryTeal} />
            </View>
            <View style={{ marginLeft: 10 }}>
              <Text style={styles.uploadDropzoneTitle}>Upload Document File</Text>
              <Text style={styles.uploadDropzoneSubtitle}>PDF, PNG, JPG (Max 2 MB)</Text>
            </View>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={THEME.background} />

      <SafeAreaView style={{ flex: 1 }}>
        {/* ── Header Card with Side Margins (Exact Parity with Billing Screen) ── */}
        <View style={styles.heroHeaderWrapper}>
          <LinearGradient
            colors={[THEME.primaryNavy, '#184C75', THEME.secondaryTeal]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroHeader}
          >
            {/* Top Navigation Row */}
            <View style={styles.topNavRow}>
              <TouchableOpacity
                onPress={() => router.back()}
                activeOpacity={0.76}
                style={styles.navIconButton}
              >
                <MaterialCommunityIcons name="arrow-left" size={20} color={THEME.whiteCard} />
              </TouchableOpacity>

              <Text style={styles.headerTitleText}>STORE DOCUMENTS</Text>

              <TouchableOpacity
                onPress={fetchProfile}
                activeOpacity={0.76}
                style={styles.navIconButton}
              >
                <Feather name="refresh-cw" size={16} color="#4ADE80" />
              </TouchableOpacity>
            </View>
          </LinearGradient>
        </View>

        {/* ── Scroll Content ── */}
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.scrollContainer}
          showsVerticalScrollIndicator={false}
        >
          {/* ── Verification Compliance Banner Card ── */}
          <View style={[styles.sectionCard, styles.complianceCard]}>
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionHeaderIcon, { backgroundColor: isFullyCompliant ? '#DCFCE7' : THEME.lightTealCard }]}>
                <MaterialCommunityIcons
                  name={isFullyCompliant ? 'shield-check' : 'shield-alert-outline'}
                  size={22}
                  color={isFullyCompliant ? THEME.successGreen : THEME.secondaryTeal}
                />
              </View>

              <View style={{ flex: 1, marginLeft: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text style={styles.complianceTitle}>Store Verification Compliance</Text>
                  <Text style={styles.complianceProgressText}>{uploadedCount} of {requiredDocs.length} Completed</Text>
                </View>
                <Text style={styles.complianceSubtitle}>
                  {isFullyCompliant
                    ? 'All required documents verified. Your pharmacy is 100% compliant.'
                    : 'Upload missing licenses and ID proofs to maintain verified partner status.'}
                </Text>
              </View>
            </View>

            {/* Compliance Progress Bar */}
            <View style={styles.progressBarTrack}>
              <View
                style={[
                  styles.progressBarFill,
                  { width: `${(uploadedCount / requiredDocs.length) * 100}%` }
                ]}
              />
            </View>
          </View>

          {/* Busy Upload Indicator Bar */}
          {docUploadBusy && (
            <View style={styles.busyIndicatorCard}>
              <ActivityIndicator size="small" color={THEME.secondaryTeal} />
              <Text style={styles.busyIndicatorText}>
                Processing and uploading document securely...
              </Text>
            </View>
          )}

          {/* ── Documents Section ── */}
          <View style={styles.sectionGroup}>
            <Text style={styles.sectionGroupTitle}>REQUIRED LEGAL PROOFS</Text>
            {renderDocCard('Store Licence', 'store_license_document', 'Official pharmacy drug licence certificate')}
            {renderDocCard('Owner ID Proof', 'owner_id_proof', 'Government issued ID (Aadhaar, PAN, Passport)')}
            {renderDocCard('Store Photo', 'store_image', 'Clear exterior front photo showing pharmacy name board')}
          </View>
        </ScrollView>
      </SafeAreaView>

      {/* ── Custom Delete Confirmation Modal ── */}
      <Modal visible={deleteVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.deleteModalCard}>
            <View style={styles.deleteHeaderIcon}>
              <Ionicons name="trash-outline" size={28} color={THEME.errorRed} />
            </View>

            <Text style={styles.deleteModalTitle}>Remove Document?</Text>
            <Text style={styles.deleteModalSubtitle}>
              Are you sure you want to remove this document proof? You will need to re-upload for store re-verification.
            </Text>

            <View style={styles.deleteModalActions}>
              <TouchableOpacity
                onPress={() => setDeleteVisible(false)}
                activeOpacity={0.8}
                style={styles.cancelDeleteButton}
              >
                <Text style={styles.cancelDeleteText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => handleDeleteConfirmed(deleteField)}
                disabled={loading}
                activeOpacity={0.85}
                style={styles.confirmDeleteButton}
              >
                {loading ? (
                  <ActivityIndicator color={THEME.whiteCard} size="small" />
                ) : (
                  <Text style={styles.confirmDeleteText}>Delete Document</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Image Preview Modal ── */}
      <Modal visible={!!previewUrl} transparent animationType="slide">
        <View style={styles.previewModalOverlay}>
          <TouchableOpacity
            onPress={() => setPreviewUrl(null)}
            style={styles.closePreviewButton}
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons name="close" size={24} color={THEME.whiteCard} />
          </TouchableOpacity>

          {previewUrl && (
            <Image
              source={{ uri: previewUrl }}
              style={styles.previewImage}
              resizeMode="contain"
            />
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.background,
  },

  /* Hero Header with Side Margins */
  heroHeaderWrapper: {
    marginHorizontal: 16,
    marginTop: 0,
    borderRadius: 22,
    overflow: 'hidden',
    shadowColor: THEME.primaryNavy,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 6,
  },
  heroHeader: {
    height: 72,
    paddingHorizontal: 16,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  topNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  navIconButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleText: {
    color: THEME.whiteCard,
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 1.5,
  },

  scrollContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 40,
  },

  /* Compliance Card */
  sectionCard: {
    backgroundColor: THEME.whiteCard,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: THEME.borderTeal,
    padding: 16,
    marginBottom: 16,
    shadowColor: THEME.primaryNavy,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 2,
  },
  complianceCard: {
    backgroundColor: THEME.whiteCard,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionHeaderIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: THEME.lightTealCard,
    borderWidth: 1,
    borderColor: THEME.borderTeal,
    alignItems: 'center',
    justifyContent: 'center',
  },
  complianceTitle: {
    color: THEME.mainText,
    fontSize: 14.5,
    fontWeight: '900',
  },
  complianceProgressText: {
    color: THEME.secondaryTeal,
    fontSize: 11,
    fontWeight: '800',
  },
  complianceSubtitle: {
    color: THEME.secondaryText,
    fontSize: 11.5,
    fontWeight: '600',
    marginTop: 2,
    lineHeight: 16,
  },
  progressBarTrack: {
    height: 6,
    backgroundColor: THEME.lightTealCard,
    borderRadius: 3,
    marginTop: 14,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: THEME.secondaryTeal,
    borderRadius: 3,
  },

  /* Busy Indicator */
  busyIndicatorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.lightTealCard,
    borderWidth: 1,
    borderColor: THEME.borderTeal,
    borderRadius: 14,
    padding: 12,
    marginBottom: 16,
    gap: 10,
  },
  busyIndicatorText: {
    color: THEME.primaryNavy,
    fontSize: 12,
    fontWeight: '700',
  },

  /* Section Group */
  sectionGroup: {
    marginBottom: 16,
  },
  sectionGroupTitle: {
    color: THEME.secondaryText,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
    marginBottom: 10,
    marginLeft: 4,
  },

  /* Doc Cards */
  docCard: {
    backgroundColor: THEME.whiteCard,
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
    shadowColor: THEME.primaryNavy,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 10,
    elevation: 2,
  },
  docCardUploaded: {
    borderColor: THEME.borderTeal,
  },
  docCardPending: {
    borderColor: THEME.borderTeal,
  },
  docCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  docIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  docIconCircleUploaded: {
    backgroundColor: THEME.lightTealCard,
    borderColor: THEME.borderTeal,
  },
  docIconCirclePending: {
    backgroundColor: THEME.background,
    borderColor: THEME.borderTeal,
  },
  docLabelText: {
    color: THEME.mainText,
    fontSize: 15,
    fontWeight: '900',
  },
  docDescText: {
    color: THEME.secondaryText,
    fontSize: 11.5,
    fontWeight: '600',
    marginTop: 2,
  },

  /* Status Badges */
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 99,
    borderWidth: 1,
    gap: 4,
  },
  statusBadgeVerified: {
    backgroundColor: '#DCFCE7',
    borderColor: '#86EFAC',
  },
  statusBadgePending: {
    backgroundColor: '#FEF3C7',
    borderColor: '#FDE68A',
  },
  statusDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  statusBadgeText: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.4,
  },

  /* Actions Box */
  uploadedActionBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: THEME.lightTealCard,
    borderRadius: 14,
    padding: 10,
    marginTop: 14,
    borderWidth: 1,
    borderColor: THEME.borderTeal,
  },
  viewDocButton: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 6,
  },
  viewDocButtonText: {
    color: THEME.secondaryTeal,
    fontSize: 12.5,
    fontWeight: '800',
  },
  docIconActionGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  editIconButton: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: THEME.whiteCard,
    borderWidth: 1,
    borderColor: THEME.borderTeal,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteIconButton: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* Upload Dropzone */
  uploadDropzone: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.background,
    borderRadius: 14,
    padding: 12,
    marginTop: 14,
    borderWidth: 1.5,
    borderColor: THEME.borderTeal,
    borderStyle: 'dashed',
  },
  uploadCircleIcon: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: THEME.lightTealCard,
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadDropzoneTitle: {
    color: THEME.primaryNavy,
    fontSize: 13,
    fontWeight: '800',
  },
  uploadDropzoneSubtitle: {
    color: THEME.secondaryText,
    fontSize: 10.5,
    fontWeight: '600',
    marginTop: 1,
  },

  /* Delete Modal */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(11, 25, 44, 0.65)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  deleteModalCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: THEME.whiteCard,
    borderRadius: 24,
    padding: 22,
    alignItems: 'center',
    shadowColor: THEME.primaryNavy,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 12,
  },
  deleteHeaderIcon: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  deleteModalTitle: {
    color: THEME.mainText,
    fontSize: 18,
    fontWeight: '900',
    textAlign: 'center',
  },
  deleteModalSubtitle: {
    color: THEME.secondaryText,
    fontSize: 12.5,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },
  deleteModalActions: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
    marginTop: 20,
  },
  cancelDeleteButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: THEME.borderTeal,
    alignItems: 'center',
    backgroundColor: THEME.background,
  },
  cancelDeleteText: {
    color: THEME.primaryNavy,
    fontSize: 13,
    fontWeight: '800',
  },
  confirmDeleteButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: THEME.errorRed,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmDeleteText: {
    color: THEME.whiteCard,
    fontSize: 13,
    fontWeight: '900',
  },

  /* Preview Modal */
  previewModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(11, 25, 44, 0.95)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closePreviewButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 40,
    right: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  previewImage: {
    width: '100%',
    height: '80%',
  },
});
