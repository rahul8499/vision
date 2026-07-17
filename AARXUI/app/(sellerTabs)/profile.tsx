import { LocalizedText as Text, LocalizedTextInput as TextInput } from '@/components/Language/LocalizedPrimitives';
import { AntDesign, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import axios from 'axios';
import Constants from 'expo-constants';
import * as DocumentPicker from 'expo-document-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  View
} from 'react-native';
import Toast from 'react-native-toast-message';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '../../redux/store';
import { fetchUserProfile } from '../../redux/userSlice';

const BASE_URL = Constants.expoConfig?.extra?.BASE_URL;

function InfoRow({ icon, label, value }: { icon: string; label: string; value?: string | null }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' }}>
      <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: '#ecfdf5', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#d1fae5' }}>
        <MaterialCommunityIcons name={icon as any} size={19} color="#059669" />
      </View>
      <View style={{ flex: 1, marginLeft: 14 }}>
        <Text style={{ fontSize: 10, fontWeight: '800', color: '#94a3b8', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 4 }}>{label}</Text>
        <Text style={{ fontSize: 15, fontWeight: '700', color: value ? '#0f172a' : '#cbd5e1' }} numberOfLines={2}>
          {value || 'Not added'}
        </Text>
      </View>
    </View>
  );
}

function EditField({ label, value, onChangeText, placeholder, keyboardType, editable = true }: any) {
  return (
    <View style={{ marginBottom: 18 }}>
      <Text style={{ fontSize: 10, fontWeight: '800', color: '#64748b', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 8 }}>{label}</Text>
      <View style={{ backgroundColor: editable ? '#f8fafc' : '#f1f5f9', borderRadius: 14, borderWidth: 1.5, borderColor: editable ? '#e2e8f0' : '#f1f5f9', overflow: 'hidden' }}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder || label}
          placeholderTextColor="#cbd5e1"
          editable={editable}
          keyboardType={keyboardType || 'default'}
          style={{ paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, fontWeight: '600', color: '#0f172a' }}
        />
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
  const [docUploadBusy, setDocUploadBusy] = useState(false);

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
    if (!name.trim()) { Toast.show({ type: 'error', text1: 'Required', text2: 'Store name is required', position: 'bottom' }); return; }
    if (mobile.trim().length < 10) { Toast.show({ type: 'error', text1: 'Invalid Mobile', text2: 'Enter a 10-digit number', position: 'bottom' }); return; }

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
      Toast.show({ type: 'success', text1: 'Profile Updated', text2: 'Your store details have been saved.', position: 'bottom' });
    } catch {
      Toast.show({ type: 'error', text1: 'Update Failed', text2: 'Something went wrong. Please try again.', position: 'bottom' });
    } finally {
      setEditBusy(false);
    }
  };

  const completion = (storeData as any)?.profile_completion_percent || 0;
  const isVerified = (storeData as any)?.is_verified;

  return (
    <View style={{ flex: 1, backgroundColor: '#f8fafc' }}>
      {/* ── Premium Header ── */}
      <View style={{ overflow: 'hidden' }}>
        <LinearGradient colors={['#0f172a', '#1e293b', '#064e3b']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ paddingTop: Platform.OS === 'android' ? 50 : 20, paddingBottom: 32, paddingHorizontal: 24 }}>
          {/* Back + Edit buttons */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
            <TouchableOpacity onPress={() => router.back()} style={{ width: 42, height: 42, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' }}>
              <MaterialCommunityIcons name="arrow-left" size={22} color="#ffffff" />
            </TouchableOpacity>
            <Text style={{ color: '#ffffff', fontSize: 16, fontWeight: '900', letterSpacing: 2, textTransform: 'uppercase' }}>My Profile</Text>
            <TouchableOpacity onPress={() => setEditOpen(true)} style={{ width: 42, height: 42, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' }}>
              <Feather name="edit-2" size={18} color="#34d399" />
            </TouchableOpacity>
          </View>

          {/* Avatar */}
          <View style={{ alignItems: 'center' }}>
            <View style={{ width: 90, height: 90, borderRadius: 28, backgroundColor: '#059669', alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: 'rgba(255,255,255,0.15)', shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 16, elevation: 12 }}>
              <MaterialCommunityIcons name="storefront-outline" size={44} color="#ffffff" />
            </View>

            <Text style={{ color: '#ffffff', fontSize: 24, fontWeight: '900', marginTop: 16, letterSpacing: 0.3, textAlign: 'center' }}>{(storeData as any)?.name || 'My Pharmacy'}</Text>
            <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, fontWeight: '600', marginTop: 4 }}>{(storeData as any)?.owner_name || ''}</Text>

            {/* Badges */}
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12, gap: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: isVerified ? '#059669' : '#dc2626', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 99 }}>
                <MaterialCommunityIcons name={isVerified ? 'check-decagram' : 'shield-alert-outline'} size={13} color="#fff" />
                <Text style={{ color: '#fff', fontSize: 10, fontWeight: '900', letterSpacing: 1, textTransform: 'uppercase', marginLeft: 5 }}>{isVerified ? 'Verified' : 'Unverified'}</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.12)', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 99 }}>
                <MaterialCommunityIcons name="progress-check" size={13} color="#34d399" />
                <Text style={{ color: '#d1fae5', fontSize: 10, fontWeight: '900', letterSpacing: 1, textTransform: 'uppercase', marginLeft: 5 }}>{completion}% Complete</Text>
              </View>
            </View>
          </View>
        </LinearGradient>
      </View>

      {/* ── Profile Details ── */}
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20, paddingBottom: 60 }} showsVerticalScrollIndicator={false}>

        <Text style={{ fontSize: 10, fontWeight: '800', color: '#94a3b8', letterSpacing: 3, textTransform: 'uppercase', marginBottom: 4 }}>Store Information</Text>
        <View style={{ backgroundColor: '#ffffff', borderRadius: 20, paddingHorizontal: 16, marginBottom: 20, borderWidth: 1, borderColor: '#f1f5f9', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 }}>
          <InfoRow icon="storefront-outline" label="Store Name" value={(storeData as any)?.name} />
          <InfoRow icon="account-tie-outline" label="Owner Name" value={(storeData as any)?.owner_name} />
          <InfoRow icon="phone-outline" label="Mobile Number" value={(storeData as any)?.mobile} />
          <InfoRow icon="email-outline" label="Email Address" value={(storeData as any)?.email} />
          <InfoRow icon="map-marker-outline" label="Store Address" value={(storeData as any)?.address ? `${(storeData as any)?.address}${(storeData as any)?.pincode ? `, ${(storeData as any)?.pincode}` : ''}` : null} />
        </View>

        <Text style={{ fontSize: 10, fontWeight: '800', color: '#94a3b8', letterSpacing: 3, textTransform: 'uppercase', marginBottom: 4 }}>Compliance</Text>
        <View style={{ backgroundColor: '#ffffff', borderRadius: 20, paddingHorizontal: 16, marginBottom: 20, borderWidth: 1, borderColor: '#f1f5f9', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 }}>
          <InfoRow icon="file-document-outline" label="GST Number" value={(storeData as any)?.gst_number} />
          <InfoRow icon="clipboard-text-outline" label="Drug License No." value={(storeData as any)?.drug_license_number} />
        </View>

        {/* Edit Profile Button */}
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => setEditOpen(true)}
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#059669', paddingVertical: 17, borderRadius: 18, shadowColor: '#059669', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.35, shadowRadius: 16, elevation: 8 }}
        >
          <Feather name="edit-2" size={18} color="#fff" />
          <Text style={{ color: '#fff', fontSize: 14, fontWeight: '900', marginLeft: 10, letterSpacing: 1.5, textTransform: 'uppercase' }}>Edit Profile</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* ── Edit Profile Modal ── */}
      <Modal visible={editOpen} animationType="slide" onRequestClose={() => !editBusy && setEditOpen(false)} transparent={false}>
        <SafeAreaView style={{ flex: 1, backgroundColor: '#f8fafc' }}>
          {/* Modal Header */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16, backgroundColor: '#ffffff', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' }}>
            <TouchableOpacity onPress={() => !editBusy && setEditOpen(false)} style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: '#f8fafc', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#e2e8f0' }}>
              <MaterialCommunityIcons name="close" size={20} color="#64748b" />
            </TouchableOpacity>
            <Text style={{ fontSize: 16, fontWeight: '900', color: '#0f172a', letterSpacing: 0.5 }}>Edit Store Profile</Text>
            <TouchableOpacity
              onPress={saveProfile}
              disabled={editBusy}
              style={{ backgroundColor: '#059669', paddingHorizontal: 18, paddingVertical: 10, borderRadius: 12, opacity: editBusy ? 0.6 : 1 }}
            >
              {editBusy ? <ActivityIndicator color="#fff" size="small" /> : <Text style={{ color: '#fff', fontSize: 13, fontWeight: '900' }}>Save</Text>}
            </TouchableOpacity>
          </View>

          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20, paddingBottom: 60 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Text style={{ fontSize: 10, fontWeight: '800', color: '#94a3b8', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 16 }}>Store Details</Text>

            <EditField label="Store Name" value={name} onChangeText={setName} placeholder="e.g. City Pharmacy" />
            <EditField label="Owner Name" value={ownerName} onChangeText={setOwnerName} placeholder="e.g. Rahul Kolhe" />
            <EditField label="Mobile Number" value={mobile} onChangeText={setMobile} placeholder="10-digit mobile" keyboardType="phone-pad" />
            <EditField label="Email Address" value={email} editable={false} placeholder="email@example.com" keyboardType="email-address" />
            <EditField label="Store Address" value={address} onChangeText={setAddress} placeholder="Full store address" />
            <EditField label="Pincode" value={pincode} onChangeText={setPincode} placeholder="6-digit pincode" keyboardType="numeric" />

            <Text style={{ fontSize: 10, fontWeight: '800', color: '#94a3b8', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 16, marginTop: 8 }}>Compliance</Text>
            <EditField label="GST Number" value={gstNumber} onChangeText={setGstNumber} placeholder="e.g. 22AAAAA0000A1Z5" />
            <EditField label="Drug License Number" value={drugLicense} onChangeText={setDrugLicense} placeholder="e.g. DL-12345" />

            {/* Documents */}
            <Text style={{ fontSize: 10, fontWeight: '800', color: '#94a3b8', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 16, marginTop: 8 }}>Documents</Text>
            {[
              { label: 'Store Licence', field: 'store_license_document' },
              { label: 'Owner ID Proof', field: 'owner_id_proof' },
              { label: 'Store Photo', field: 'store_image' },
            ].map(({ label, field }) => {
              const selected = docUpdates[field];
              return (
                <TouchableOpacity
                  key={field}
                  onPress={() => pickFileForField(field)}
                  style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: selected ? '#ecfdf5' : '#f8fafc', borderRadius: 14, borderWidth: 1.5, borderColor: selected ? '#6ee7b7' : '#e2e8f0', paddingHorizontal: 16, paddingVertical: 14, marginBottom: 12 }}
                >
                  <MaterialCommunityIcons name={selected ? 'check-circle-outline' : 'cloud-upload-outline'} size={22} color={selected ? '#059669' : '#94a3b8'} />
                  <Text style={{ flex: 1, marginLeft: 12, fontSize: 14, fontWeight: '700', color: selected ? '#059669' : '#64748b' }}>
                    {selected ? `✓ ${selected.name}` : `Upload ${label}`}
                  </Text>
                  <MaterialCommunityIcons name="chevron-right" size={18} color="#cbd5e1" />
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </View>
  );
}
