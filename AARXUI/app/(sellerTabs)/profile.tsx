import { LocalizedText as Text, LocalizedTextInput as TextInput } from '@/components/Language/LocalizedPrimitives';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import axios from 'axios';
import Constants from 'expo-constants';
import * as DocumentPicker from 'expo-document-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
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

function MetricPill({ icon, label, value, color }: { icon: string; label: string; value: string; color: string }) {
  return (
    <View style={styles.metricPill}>
      <View style={[styles.metricIconBox, { backgroundColor: `${color}15`, borderColor: `${color}30` }]}>
        <MaterialCommunityIcons name={icon as any} size={17} color={color} />
      </View>
      <View style={{ marginLeft: 8 }}>
        <Text style={styles.metricLabel}>{label}</Text>
        <Text style={styles.metricValue}>{value}</Text>
      </View>
    </View>
  );
}

function SectionCard({
  title,
  subtitle,
  icon,
  badge,
  children
}: {
  title: string;
  subtitle?: string;
  icon: string;
  badge?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.sectionCard}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionHeaderTitleRow}>
          <View style={styles.sectionHeaderIcon}>
            <MaterialCommunityIcons name={icon as any} size={20} color={THEME.primaryNavy} />
          </View>
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={styles.sectionTitle}>{title}</Text>
            {subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}
          </View>
          {badge}
        </View>
      </View>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

function DetailRow({
  icon,
  label,
  value,
  verified,
  isLast = false
}: {
  icon: string;
  label: string;
  value?: string | null;
  verified?: boolean;
  isLast?: boolean;
}) {
  return (
    <View style={[styles.detailRow, !isLast && styles.detailRowBorder]}>
      <View style={styles.detailIconBox}>
        <MaterialCommunityIcons name={icon as any} size={18} color={THEME.primaryNavy} />
      </View>
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text style={styles.detailLabel}>{label}</Text>
        <Text style={[styles.detailValue, !value && styles.detailValueEmpty]} numberOfLines={2}>
          {value || 'Not added'}
        </Text>
      </View>
      {verified !== undefined ? (
        <View style={[styles.inlineBadge, verified ? styles.inlineBadgeVerified : styles.inlineBadgePending]}>
          <MaterialCommunityIcons
            name={verified ? 'check-circle' : 'alert-circle-outline'}
            size={12}
            color={verified ? THEME.successGreen : THEME.warningAmber}
          />
          <Text style={[styles.inlineBadgeText, { color: verified ? THEME.successGreen : THEME.warningAmber }]}>
            {verified ? 'Added' : 'Pending'}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

function DocCard({
  title,
  field,
  documentUrl,
  pendingUpload,
  onPick,
}: {
  title: string;
  field: string;
  documentUrl?: string | null;
  pendingUpload?: any;
  onPick: () => void;
}) {
  const isUploaded = Boolean(documentUrl || pendingUpload);

  return (
    <View style={styles.docCard}>
      <View style={styles.docCardLeft}>
        <View style={[styles.docIconBox, isUploaded ? styles.docIconUploaded : styles.docIconEmpty]}>
          <MaterialCommunityIcons
            name={isUploaded ? 'file-check-outline' : 'file-outline'}
            size={20}
            color={isUploaded ? THEME.successGreen : THEME.warningAmber}
          />
        </View>
        <View style={{ marginLeft: 12, flex: 1 }}>
          <Text style={styles.docTitle}>{title}</Text>
          <Text style={styles.docStatusText}>
            {pendingUpload ? `✓ ${pendingUpload.name}` : documentUrl ? 'Document uploaded' : 'Not uploaded yet'}
          </Text>
        </View>
      </View>
      <TouchableOpacity activeOpacity={0.78} onPress={onPick} style={styles.docActionButton}>
        <Feather name={isUploaded ? 'refresh-cw' : 'upload'} size={13} color={THEME.primaryNavy} />
        <Text style={styles.docActionText}>{isUploaded ? 'Change' : 'Upload'}</Text>
      </TouchableOpacity>
    </View>
  );
}

function EditInput({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  editable = true,
  icon,
}: any) {
  return (
    <View style={styles.inputContainer}>
      <Text style={styles.inputLabel}>{label}</Text>
      <View style={[styles.inputWrapper, !editable && styles.inputWrapperDisabled]}>
        <MaterialCommunityIcons name={icon} size={18} color={editable ? THEME.primaryNavy : THEME.secondaryText} style={styles.inputIcon} />
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder || label}
          placeholderTextColor={THEME.secondaryText}
          editable={editable}
          keyboardType={keyboardType || 'default'}
          style={styles.textInput}
        />
        {!editable ? <MaterialCommunityIcons name="lock-outline" size={16} color={THEME.secondaryText} /> : null}
      </View>
    </View>
  );
}

export default function SellerProfileScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ edit?: string }>();
  const dispatch = useDispatch<AppDispatch>();
  const { user: storeData, token } = useSelector((state: RootState) => state.user);

  const [editOpen, setEditOpen] = useState(false);
  const [editBusy, setEditBusy] = useState(false);
  const [docUpdates, setDocUpdates] = useState<{ [k: string]: any }>({});

  const [name, setName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [pincode, setPincode] = useState('');
  const [gstNumber, setGstNumber] = useState('');
  const [drugLicense, setDrugLicense] = useState('');

  useEffect(() => {
    if (params?.edit === 'true') setEditOpen(true);
  }, [params?.edit]);

  useEffect(() => {
    if (storeData) {
      setName((storeData as any).name || '');
      setOwnerName((storeData as any).owner_name || '');
      setMobile((storeData as any).mobile || '');
      setEmail((storeData as any).email || '');
      setAddress((storeData as any).address || '');
      setPincode((storeData as any).pincode || '');
      setGstNumber((storeData as any).gst_number || '');
      setDrugLicense((storeData as any).drug_license_number || '');
    }
  }, [storeData]);

  const pickFileForField = async (field: string) => {
    try {
      const res = await DocumentPicker.getDocumentAsync({ type: '*/*' });
      if (res.canceled) return;
      const file = res.assets?.[0];
      if (!file) return;
      if (file.size && file.size > 2 * 1024 * 1024) {
        Toast.show({ type: 'error', text1: 'File Too Large', text2: 'Select a file under 2 MB', position: 'bottom' });
        return;
      }
      const fileObj = { uri: file.uri, name: file.name, type: file.mimeType || 'application/octet-stream' };
      setDocUpdates(prev => ({ ...prev, [field]: fileObj }));
    } catch { }
  };

  const saveProfile = async () => {
    if (!token) return;
    if (!name.trim()) {
      Toast.show({ type: 'error', text1: 'Required', text2: 'Store name is required', position: 'bottom' });
      return;
    }
    if (mobile.trim().length < 10) {
      Toast.show({ type: 'error', text1: 'Invalid Mobile', text2: 'Enter a 10-digit mobile number', position: 'bottom' });
      return;
    }

    try {
      setEditBusy(true);
      const fd = new FormData();
      Object.entries(docUpdates).forEach(([field, file]: any) => {
        if (file?.uri) fd.append(field, { uri: file.uri, name: file.name, type: file.type } as any);
      });
      fd.append('name', name);
      fd.append('owner_name', ownerName);
      fd.append('mobile', mobile);
      fd.append('address', address);
      fd.append('pincode', pincode);
      fd.append('gst_number', gstNumber);
      fd.append('drug_license_number', drugLicense);

      await axios.patch(`${BASE_URL}/api/store-me/`, fd, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' },
        transformRequest: (data) => data,
      });
      await dispatch(fetchUserProfile());
      setEditOpen(false);
      setDocUpdates({});
      Toast.show({ type: 'success', text1: 'Profile Saved', text2: 'Your store details have been updated.', position: 'bottom' });
    } catch {
      Toast.show({ type: 'error', text1: 'Update Failed', text2: 'Could not save profile details.', position: 'bottom' });
    } finally {
      setEditBusy(false);
    }
  };

  const completion = Math.min(100, Math.max(0, Number((storeData as any)?.profile_completion_percent) || 75));
  const isVerified = (storeData as any)?.is_verified;

  return (
    <View style={{ flex: 1, backgroundColor: THEME.background }}>
      <StatusBar barStyle="dark-content" backgroundColor={THEME.background} />

      <SafeAreaView style={{ flex: 1 }}>
        {/* ── Outer Header Container with side margins ── */}
        <View style={styles.heroHeaderWrapper}>
          <LinearGradient
            colors={[THEME.primaryNavy, '#184C75', THEME.secondaryTeal]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroHeader}
          >
            <View pointerEvents="none" style={styles.heroOrbTop} />
            <View pointerEvents="none" style={styles.heroOrbBottom} />

            {/* Top Nav Bar */}
            <View style={styles.topNavRow}>
              <TouchableOpacity onPress={() => router.back()} activeOpacity={0.76} style={styles.navIconButton}>
                <MaterialCommunityIcons name="arrow-left" size={20} color={THEME.whiteCard} />
              </TouchableOpacity>

              <View style={styles.navHeaderTitleBox}>
                <Text style={styles.navHeaderTitle}>My Store Profile</Text>
              </View>

              <TouchableOpacity onPress={() => setEditOpen(true)} activeOpacity={0.76} style={styles.navIconButton}>
                <Feather name="edit-2" size={18} color="#4ADE80" />
              </TouchableOpacity>
            </View>

            {/* Store Info Banner */}
            <View style={styles.heroIdentityCard}>
              <View style={styles.avatarContainer}>
                <LinearGradient colors={[THEME.secondaryTeal, THEME.primaryNavy]} style={styles.avatarGradient}>
                  <MaterialCommunityIcons name="storefront-outline" size={40} color={THEME.whiteCard} />
                </LinearGradient>
                <View style={[styles.avatarStatusBadge, isVerified ? styles.statusBadgeActive : styles.statusBadgePending]}>
                  <MaterialCommunityIcons name={isVerified ? 'check-decagram' : 'clock-outline'} size={12} color={THEME.whiteCard} />
                </View>
              </View>

              <View style={styles.identityMetaBox}>
                <Text style={styles.storeNameText} numberOfLines={1}>
                  {(storeData as any)?.name || 'My Store'}
                </Text>

                <Text style={styles.ownerTitleText}>
                  {(storeData as any)?.owner_name ? `Owner: ${(storeData as any)?.owner_name}` : 'Pharmacy Partner'}
                </Text>

                <View style={styles.badgeCluster}>
                  <View style={[styles.heroPill, isVerified ? styles.heroPillVerified : styles.heroPillPending]}>
                    <MaterialCommunityIcons name={isVerified ? 'check-decagram' : 'clock-outline'} size={13} color={isVerified ? '#4ADE80' : '#FBBF24'} />
                    <Text style={[styles.heroPillText, { color: isVerified ? '#DCFCE7' : '#FEF3C7' }]}>
                      {isVerified ? 'Verified Store' : 'Verification Pending'}
                    </Text>
                  </View>

                  <View style={[styles.heroPill, styles.heroPillCompletion]}>
                    <MaterialCommunityIcons name="progress-check" size={13} color={THEME.borderTeal} />
                    <Text style={[styles.heroPillText, { color: THEME.lightTealCard }]}>
                      {completion}% Complete
                    </Text>
                  </View>
                </View>
              </View>
            </View>

            {/* Key Quick Info Pills */}
            <View style={styles.metricsBarContainer}>
              <MetricPill icon="file-document-outline" label="Drug License" value={drugLicense ? 'Added' : 'Not Added'} color={drugLicense ? THEME.successGreen : THEME.warningAmber} />
              <View style={styles.metricDivider} />
              <MetricPill icon="file-certificate-outline" label="GST Number" value={gstNumber ? 'Added' : 'Not Added'} color={gstNumber ? THEME.secondaryTeal : THEME.warningAmber} />
              <View style={styles.metricDivider} />
              <MetricPill icon="map-marker-outline" label="Pincode" value={pincode || 'Not Set'} color={THEME.primaryNavy} />
            </View>
          </LinearGradient>
        </View>

        {/* ── Details List ── */}
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.scrollContainer}
          showsVerticalScrollIndicator={false}
        >
          {/* Section 1: Basic Store Details */}
          <SectionCard
            title="Store Information"
            subtitle="Basic contact and location details"
            icon="storefront-outline"
            badge={
              <TouchableOpacity onPress={() => setEditOpen(true)} style={styles.editSectionBadge}>
                <Feather name="edit-2" size={12} color={THEME.primaryNavy} />
                <Text style={styles.editSectionText}>Edit</Text>
              </TouchableOpacity>
            }
          >
            <DetailRow icon="storefront" label="Store Name" value={(storeData as any)?.name} />
            <DetailRow icon="account-tie-outline" label="Owner Name" value={(storeData as any)?.owner_name} />
            <DetailRow icon="phone-outline" label="Mobile Number" value={(storeData as any)?.mobile} />
            <DetailRow icon="email-outline" label="Email Address" value={(storeData as any)?.email} />
            <DetailRow
              icon="map-marker-outline"
              label="Address & Pincode"
              value={(storeData as any)?.address ? `${(storeData as any)?.address}${(storeData as any)?.pincode ? ` (${(storeData as any)?.pincode})` : ''}` : null}
              isLast
            />
          </SectionCard>

          {/* Section 2: Licenses & GST */}
          <SectionCard
            title="Licenses & GST"
            subtitle="Store license and GST tax numbers"
            icon="shield-check-outline"
          >
            <DetailRow
              icon="file-document-outline"
              label="GST Number"
              value={(storeData as any)?.gst_number}
              verified={Boolean((storeData as any)?.gst_number)}
            />
            <DetailRow
              icon="clipboard-text-outline"
              label="Drug License Number"
              value={(storeData as any)?.drug_license_number}
              verified={Boolean((storeData as any)?.drug_license_number)}
              isLast
            />
          </SectionCard>

          {/* Section 3: Store Documents */}
          <SectionCard
            title="Store Documents"
            subtitle="Uploaded licenses and ID proofs"
            icon="folder-text-outline"
          >
            <DocCard
              title="Drug License Document"
              field="store_license_document"
              documentUrl={(storeData as any)?.store_license_document}
              pendingUpload={docUpdates?.store_license_document}
              onPick={() => pickFileForField('store_license_document')}
            />
            <DocCard
              title="Owner ID Proof"
              field="owner_id_proof"
              documentUrl={(storeData as any)?.owner_id_proof}
              pendingUpload={docUpdates?.owner_id_proof}
              onPick={() => pickFileForField('owner_id_proof')}
            />
            <DocCard
              title="Store Photo"
              field="store_image"
              documentUrl={(storeData as any)?.store_image}
              pendingUpload={docUpdates?.store_image}
              onPick={() => pickFileForField('store_image')}
            />
          </SectionCard>

          {/* Action Buttons */}
          <View style={styles.actionGrid}>
            <TouchableOpacity
              activeOpacity={0.82}
              onPress={() => setEditOpen(true)}
              style={styles.primaryActionButton}
            >
              <LinearGradient colors={[THEME.primaryNavy, THEME.secondaryTeal]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.primaryActionGradient}>
                <Feather name="edit-2" size={18} color={THEME.whiteCard} />
                <Text style={styles.primaryActionText}>Edit Profile</Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.82}
              onPress={() => router.push('/(sellerTabs)/documents' as any)}
              style={styles.secondaryActionButton}
            >
              <MaterialCommunityIcons name="file-account-outline" size={19} color={THEME.primaryNavy} />
              <Text style={styles.secondaryActionText}>Manage All Documents</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.profileFooterNote}>
            AARX SELLER PLATFORM
          </Text>
        </ScrollView>
      </SafeAreaView>

      {/* ── Edit Profile Modal ── */}
      <Modal visible={editOpen} animationType="slide" onRequestClose={() => !editBusy && setEditOpen(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: THEME.background }}>
          <StatusBar barStyle="dark-content" backgroundColor={THEME.whiteCard} />

          {/* Modal Header */}
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => !editBusy && setEditOpen(false)} style={styles.modalCloseButton}>
              <MaterialCommunityIcons name="close" size={20} color={THEME.mainText} />
            </TouchableOpacity>
            <Text style={styles.modalHeaderTitle}>Edit Store Profile</Text>
            <TouchableOpacity
              onPress={saveProfile}
              disabled={editBusy}
              style={[styles.modalSaveButton, editBusy && { opacity: 0.6 }]}
            >
              {editBusy ? (
                <ActivityIndicator color={THEME.whiteCard} size="small" />
              ) : (
                <Text style={styles.modalSaveText}>Save</Text>
              )}
            </TouchableOpacity>
          </View>

          <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.modalBody} keyboardShouldPersistTaps="handled">
            <Text style={styles.modalSectionLabel}>STORE DETAILS</Text>
            <EditInput label="Store Name" value={name} onChangeText={setName} placeholder="e.g. City Pharmacy" icon="storefront" />
            <EditInput label="Owner Name" value={ownerName} onChangeText={setOwnerName} placeholder="e.g. Rahul Kolhe" icon="account-tie-outline" />
            <EditInput label="Mobile Number" value={mobile} onChangeText={setMobile} placeholder="10-digit mobile" keyboardType="phone-pad" icon="phone-outline" />
            <EditInput label="Email Address (Locked)" value={email} editable={false} placeholder="email@example.com" icon="email-outline" />
            <EditInput label="Store Address" value={address} onChangeText={setAddress} placeholder="Full address" icon="map-marker-outline" />
            <EditInput label="Pincode" value={pincode} onChangeText={setPincode} placeholder="6-digit pincode" keyboardType="numeric" icon="numeric" />

            <Text style={[styles.modalSectionLabel, { marginTop: 16 }]}>LICENSES & GST</Text>
            <EditInput label="GST Number" value={gstNumber} onChangeText={setGstNumber} placeholder="e.g. 27AAAAA0000A1Z5" icon="file-document-outline" />
            <EditInput label="Drug License Number" value={drugLicense} onChangeText={setDrugLicense} placeholder="e.g. DL-123456" icon="clipboard-text-outline" />

            <Text style={[styles.modalSectionLabel, { marginTop: 16 }]}>UPLOAD DOCUMENTS</Text>
            {[
              { label: 'Drug License Document', field: 'store_license_document' },
              { label: 'Owner ID Proof', field: 'owner_id_proof' },
              { label: 'Store Photo', field: 'store_image' },
            ].map(({ label, field }) => {
              const selected = docUpdates[field];
              return (
                <TouchableOpacity
                  key={field}
                  activeOpacity={0.8}
                  onPress={() => pickFileForField(field)}
                  style={[styles.modalDocPicker, selected && styles.modalDocPickerSelected]}
                >
                  <View style={[styles.modalDocIcon, selected && styles.modalDocIconSelected]}>
                    <MaterialCommunityIcons
                      name={selected ? 'check-circle-outline' : 'cloud-upload-outline'}
                      size={20}
                      color={selected ? THEME.successGreen : THEME.secondaryText}
                    />
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.modalDocTitle}>{label}</Text>
                    <Text style={styles.modalDocSubtitle}>
                      {selected ? `Selected: ${selected.name}` : 'Tap to upload file (under 2MB)'}
                    </Text>
                  </View>
                  <Ionicons name="attach" size={20} color={selected ? THEME.successGreen : THEME.secondaryText} />
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Modal Bottom Save Bar */}
          <View style={styles.modalFooterBar}>
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={saveProfile}
              disabled={editBusy}
              style={styles.modalFooterSaveButton}
            >
              <LinearGradient colors={[THEME.primaryNavy, THEME.secondaryTeal]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.modalFooterSaveGradient}>
                {editBusy ? (
                  <ActivityIndicator color={THEME.whiteCard} />
                ) : (
                  <>
                    <MaterialCommunityIcons name="check-circle-outline" size={19} color={THEME.whiteCard} />
                    <Text style={styles.modalFooterSaveText}>Save Profile Details</Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  heroHeaderWrapper: {
    marginHorizontal: 16,
    marginTop: Platform.OS === 'android' ? 12 : 6,
    borderRadius: 22,
    overflow: 'hidden',
    shadowColor: THEME.primaryNavy,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 6,
  },
  heroHeader: {
    paddingTop: 16,
    paddingHorizontal: 16,
    paddingBottom: 16,
    overflow: 'hidden',
  },
  heroOrbTop: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 999,
    right: -50,
    top: -50,
    backgroundColor: 'rgba(15, 139, 141, 0.12)',
  },
  heroOrbBottom: {
    position: 'absolute',
    width: 130,
    height: 130,
    borderRadius: 999,
    left: -40,
    bottom: -30,
    backgroundColor: 'rgba(18, 59, 93, 0.15)',
  },
  topNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  navIconButton: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navHeaderTitleBox: { alignItems: 'center' },
  navHeaderTitle: { color: THEME.whiteCard, fontSize: 16, fontWeight: '900', letterSpacing: 0.3 },

  heroIdentityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
  },
  avatarContainer: { position: 'relative' },
  avatarGradient: {
    width: 60,
    height: 60,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.25)',
  },
  avatarStatusBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: THEME.primaryNavy,
  },
  statusBadgeActive: { backgroundColor: THEME.successGreen },
  statusBadgePending: { backgroundColor: THEME.warningAmber },

  identityMetaBox: { flex: 1, marginLeft: 14 },
  storeNameText: { color: THEME.whiteCard, fontSize: 17, fontWeight: '900', letterSpacing: 0.2 },
  ownerTitleText: { color: 'rgba(255, 255, 255, 0.78)', fontSize: 11.5, fontWeight: '600', marginTop: 2 },
  badgeCluster: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },

  heroPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 99,
    borderWidth: 1,
    gap: 4,
  },
  heroPillVerified: { backgroundColor: 'rgba(22, 163, 74, 0.25)', borderColor: 'rgba(74, 222, 128, 0.4)' },
  heroPillPending: { backgroundColor: 'rgba(245, 158, 11, 0.25)', borderColor: 'rgba(251, 191, 36, 0.4)' },
  heroPillCompletion: { backgroundColor: 'rgba(255, 255, 255, 0.12)', borderColor: 'rgba(255, 255, 255, 0.18)' },
  heroPillText: { fontSize: 9.5, fontWeight: '900', letterSpacing: 0.3 },

  metricsBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.whiteCard,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 14,
    shadowColor: THEME.primaryNavy,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 6,
  },
  metricPill: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  metricIconBox: { width: 30, height: 30, borderRadius: 9, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  metricLabel: { color: THEME.secondaryText, fontSize: 8.5, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  metricValue: { color: THEME.mainText, fontSize: 11.5, fontWeight: '900', marginTop: 1 },
  metricDivider: { width: 1, height: 24, backgroundColor: THEME.borderTeal, marginHorizontal: 4 },

  scrollContainer: { padding: 18, paddingBottom: 40 },
  sectionCard: {
    backgroundColor: THEME.whiteCard,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: THEME.borderTeal,
    marginBottom: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    shadowColor: THEME.primaryNavy,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 2,
  },
  sectionHeader: { marginBottom: 12, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: THEME.lightTealCard },
  sectionHeaderTitleRow: { flexDirection: 'row', alignItems: 'center' },
  sectionHeaderIcon: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: THEME.lightTealCard,
    borderWidth: 1,
    borderColor: THEME.borderTeal,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: { color: THEME.mainText, fontSize: 14, fontWeight: '900' },
  sectionSubtitle: { color: THEME.secondaryText, fontSize: 10.5, fontWeight: '600', marginTop: 1 },
  editSectionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4.5,
    borderRadius: 99,
    backgroundColor: THEME.lightTealCard,
    borderWidth: 1,
    borderColor: THEME.borderTeal,
  },
  editSectionText: { color: THEME.primaryNavy, fontSize: 10.5, fontWeight: '800' },

  sectionBody: { gap: 2 },
  detailRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  detailRowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: THEME.borderTeal },
  detailIconBox: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: THEME.lightTealCard,
    borderWidth: 1,
    borderColor: THEME.borderTeal,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailLabel: { color: THEME.secondaryText, fontSize: 9.5, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.6 },
  detailValue: { color: THEME.mainText, fontSize: 13.5, fontWeight: '700', marginTop: 2 },
  detailValueEmpty: { color: THEME.secondaryText, fontStyle: 'italic' },
  inlineBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3.5, borderRadius: 99, borderWidth: 1 },
  inlineBadgeVerified: { backgroundColor: '#DCFCE7', borderColor: '#86EFAC' },
  inlineBadgePending: { backgroundColor: '#FEF3C7', borderColor: '#FDE68A' },
  inlineBadgeText: { fontSize: 8.5, fontWeight: '900', letterSpacing: 0.4 },

  docCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 14,
    backgroundColor: THEME.background,
    borderWidth: 1,
    borderColor: THEME.borderTeal,
    marginBottom: 8,
  },
  docCardLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  docIconBox: { width: 36, height: 36, borderRadius: 11, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  docIconUploaded: { backgroundColor: '#DCFCE7', borderColor: '#86EFAC' },
  docIconEmpty: { backgroundColor: '#FEF3C7', borderColor: '#FDE68A' },
  docTitle: { color: THEME.mainText, fontSize: 12.5, fontWeight: '800' },
  docStatusText: { color: THEME.secondaryText, fontSize: 10, fontWeight: '600', marginTop: 1 },
  docActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5.5,
    borderRadius: 9,
    backgroundColor: THEME.whiteCard,
    borderWidth: 1,
    borderColor: THEME.borderTeal,
    marginLeft: 8,
  },
  docActionText: { color: THEME.primaryNavy, fontSize: 11, fontWeight: '800' },

  actionGrid: { gap: 10, marginTop: 4 },
  primaryActionButton: { borderRadius: 16, overflow: 'hidden', elevation: 3 },
  primaryActionGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  primaryActionText: { color: THEME.whiteCard, fontSize: 13.5, fontWeight: '900', letterSpacing: 0.3 },
  secondaryActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 13,
    borderRadius: 16,
    backgroundColor: THEME.whiteCard,
    borderWidth: 1,
    borderColor: THEME.borderTeal,
  },
  secondaryActionText: { color: THEME.primaryNavy, fontSize: 13, fontWeight: '800' },

  profileFooterNote: {
    textAlign: 'center',
    color: THEME.secondaryText,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginTop: 20,
    marginBottom: 10,
  },

  /* Modal Styles */
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 14,
    backgroundColor: THEME.whiteCard,
    borderBottomWidth: 1,
    borderBottomColor: THEME.borderTeal,
  },
  modalCloseButton: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: THEME.background,
    borderWidth: 1,
    borderColor: THEME.borderTeal,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalHeaderTitle: { color: THEME.mainText, fontSize: 16, fontWeight: '900' },
  modalSaveButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: THEME.primaryNavy,
  },
  modalSaveText: { color: THEME.whiteCard, fontSize: 12.5, fontWeight: '900' },
  modalBody: { padding: 18, paddingBottom: 40 },
  modalSectionLabel: {
    color: THEME.secondaryText,
    fontSize: 9.5,
    fontWeight: '900',
    letterSpacing: 1.5,
    marginBottom: 12,
  },

  inputContainer: { marginBottom: 14 },
  inputLabel: { color: THEME.secondaryText, fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.whiteCard,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: THEME.borderTeal,
    paddingHorizontal: 12,
  },
  inputWrapperDisabled: { backgroundColor: THEME.lightTealCard, borderColor: THEME.borderTeal },
  inputIcon: { marginRight: 8 },
  textInput: { flex: 1, paddingVertical: 12, fontSize: 13.5, fontWeight: '700', color: THEME.mainText },

  modalDocPicker: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.whiteCard,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: THEME.borderTeal,
    padding: 12,
    marginBottom: 10,
  },
  modalDocPickerSelected: { backgroundColor: '#DCFCE7', borderColor: '#86EFAC' },
  modalDocIcon: { width: 34, height: 34, borderRadius: 10, backgroundColor: THEME.background, alignItems: 'center', justifyContent: 'center' },
  modalDocIconSelected: { backgroundColor: '#DCFCE7' },
  modalDocTitle: { color: THEME.mainText, fontSize: 12.5, fontWeight: '800' },
  modalDocSubtitle: { color: THEME.secondaryText, fontSize: 10, fontWeight: '600', marginTop: 1 },

  modalFooterBar: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    backgroundColor: THEME.whiteCard,
    borderTopWidth: 1,
    borderTopColor: THEME.borderTeal,
  },
  modalFooterSaveButton: { borderRadius: 14, overflow: 'hidden' },
  modalFooterSaveGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
  },
  modalFooterSaveText: { color: THEME.whiteCard, fontSize: 13.5, fontWeight: '900', letterSpacing: 0.5 },
});
