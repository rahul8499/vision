import { LocalizedText as Text } from '@/components/Language/LocalizedPrimitives';
import { AntDesign, Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import axios from 'axios';
import Constants from 'expo-constants';
import * as DocumentPicker from 'expo-document-picker';
import * as IntentLauncher from 'expo-intent-launcher';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  View,
  Image
} from 'react-native';
import Toast from 'react-native-toast-message';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '../../redux/store';
import { fetchUserProfile } from '../../redux/userSlice';

const BASE_URL = Constants.expoConfig?.extra?.BASE_URL;

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
          text2: 'Select a file under 2 MB',
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
        text1: 'Upload Successful',
        text2: `${file.name} has been uploaded.`,
        position: 'bottom',
      });
    } catch (e) {
      console.log('Upload error:', e);
      Toast.show({
        type: 'error',
        text1: 'Upload Failed',
        text2: 'Could not upload the document.',
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
        text2: 'The document has been removed.',
        position: 'bottom',
      });
    } catch (e) {
      console.log(e);
      Toast.show({
        type: 'error',
        text1: 'Delete Failed',
        text2: 'Could not remove the document.',
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

  const renderDocCard = (label: string, field: string, description: string) => {
    const url = (storeData as any)?.[field];
    const isUploaded = !!url;
    const isImage = url ? /\.(png|jpe?g|jpg)$/i.test(url) : false;

    return (
      <View style={{
        backgroundColor: '#ffffff',
        borderRadius: 24,
        padding: 20,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: isUploaded ? '#e6f4ea' : '#f1f5f9',
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.03,
        shadowRadius: 10,
        elevation: 2,
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
            <View style={{
              width: 52,
              height: 52,
              borderRadius: 16,
              backgroundColor: isUploaded ? '#ecfdf5' : '#f1f5f9',
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: 1,
              borderColor: isUploaded ? '#d1fae5' : '#e2e8f0',
            }}>
              <MaterialCommunityIcons
                name={isImage ? 'file-image-outline' : 'file-document-outline'}
                size={26}
                color={isUploaded ? '#059669' : '#64748b'}
              />
            </View>
            <View style={{ marginLeft: 16, flex: 1 }}>
              <Text style={{ fontSize: 16, fontWeight: '800', color: '#0f172a' }}>{label}</Text>
              <Text style={{ fontSize: 12, fontWeight: '500', color: '#94a3b8', marginTop: 2 }}>{description}</Text>
            </View>
          </View>
        </View>

        {isUploaded ? (
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: '#f8fafc',
            borderRadius: 16,
            padding: 12,
            marginTop: 16,
            borderWidth: 1,
            borderColor: '#e2e8f0',
          }}>
            <TouchableOpacity
              onPress={() => handleDocumentClick(url)}
              style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}
            >
              <Feather name="eye" size={16} color="#059669" />
              <Text style={{ fontSize: 13, fontWeight: '700', color: '#059669', marginLeft: 8 }} numberOfLines={1}>
                View Document
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => pickFileForField(field)}
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                backgroundColor: '#ffffff',
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 1,
                borderColor: '#e2e8f0',
                marginRight: 8,
              }}
            >
              <Feather name="edit-3" size={16} color="#475569" />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                setDeleteField(field);
                setDeleteVisible(true);
              }}
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                backgroundColor: '#fff1f2',
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 1,
                borderColor: '#fecdd3',
              }}
            >
              <Ionicons name="trash-outline" size={16} color="#e11d48" />
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            onPress={() => pickFileForField(field)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: '#f8fafc',
              borderRadius: 16,
              padding: 16,
              marginTop: 16,
              borderWidth: 1.5,
              borderColor: '#cbd5e1',
              borderStyle: 'dashed',
            }}
          >
            <Feather name="upload-cloud" size={18} color="#64748b" />
            <Text style={{ fontSize: 14, fontWeight: '800', color: '#64748b', marginLeft: 10 }}>
              Upload Document
            </Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#f8fafc' }}>
      {/* ── Header ── */}
      <View style={{ overflow: 'hidden' }}>
        <LinearGradient
          colors={['#0f172a', '#1e293b', '#064e3b']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            paddingTop: Platform.OS === 'android' ? 50 : 20,
            paddingBottom: 28,
            paddingHorizontal: 24,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <TouchableOpacity
              onPress={() => router.back()}
              style={{
                width: 42,
                height: 42,
                borderRadius: 14,
                backgroundColor: 'rgba(255,255,255,0.1)',
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.08)',
              }}
            >
              <MaterialCommunityIcons name="arrow-left" size={22} color="#ffffff" />
            </TouchableOpacity>
            <Text style={{ color: '#ffffff', fontSize: 16, fontWeight: '900', letterSpacing: 2, textTransform: 'uppercase' }}>
              Store Documents
            </Text>
            <View style={{ width: 42 }} />
          </View>

          <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, fontWeight: '600', marginTop: 16, textAlign: 'center' }}>
            Manage your store license, verification proofs, and photos for AARX verification.
          </Text>
        </LinearGradient>
      </View>

      {/* ── Document List ── */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 20, paddingBottom: 60 }}
        showsVerticalScrollIndicator={false}
      >
        {docUploadBusy && (
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#e0f2fe',
            padding: 12,
            borderRadius: 16,
            marginBottom: 20,
            borderWidth: 1,
            borderColor: '#bae6fd',
          }}>
            <ActivityIndicator size="small" color="#0284c7" />
            <Text style={{ fontSize: 13, fontWeight: '700', color: '#0369a1', marginLeft: 10 }}>
              Uploading and processing file...
            </Text>
          </View>
        )}

        {renderDocCard('Store Licence', 'store_license_document', 'Official pharmacy license or certificate')}
        {renderDocCard('Owner ID Proof', 'owner_id_proof', 'Aadhaar Card, PAN Card or Passport')}
        {renderDocCard('Store Photo', 'store_image', 'Clear exterior front photo showing store name board')}
      </ScrollView>

      {/* ── Delete Modal Confirmation ── */}
      <Modal visible={deleteVisible} transparent animationType="fade">
        <View style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.5)',
          justifyContent: 'center',
          alignItems: 'center',
          padding: 24,
        }}>
          <View style={{
            backgroundColor: '#ffffff',
            borderRadius: 28,
            padding: 24,
            width: '100%',
            maxWidth: 340,
            alignItems: 'center',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 10 },
            shadowOpacity: 0.1,
            shadowRadius: 20,
            elevation: 10,
          }}>
            <View style={{
              width: 56,
              height: 56,
              borderRadius: 20,
              backgroundColor: '#fff1f2',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 16,
            }}>
              <Ionicons name="trash-outline" size={26} color="#e11d48" />
            </View>
            <Text style={{ fontSize: 18, fontWeight: '800', color: '#0f172a', textAlign: 'center' }}>
              Delete Document?
            </Text>
            <Text style={{ fontSize: 14, color: '#64748b', textAlign: 'center', marginTop: 8, lineHeight: 20 }}>
              Are you sure you want to remove this document? This cannot be undone.
            </Text>
            <View style={{ flexDirection: 'row', gap: 12, width: '100%', marginTop: 24 }}>
              <TouchableOpacity
                onPress={() => setDeleteVisible(false)}
                style={{
                  flex: 1,
                  paddingVertical: 14,
                  borderRadius: 14,
                  backgroundColor: '#f1f5f9',
                  alignItems: 'center',
                }}
              >
                <Text style={{ fontSize: 14, fontWeight: '700', color: '#475569' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => handleDeleteConfirmed(deleteField)}
                disabled={loading}
                style={{
                  flex: 1,
                  paddingVertical: 14,
                  borderRadius: 14,
                  backgroundColor: '#e11d48',
                  alignItems: 'center',
                }}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={{ fontSize: 14, fontWeight: '700', color: '#ffffff' }}>Delete</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Image Preview Modal ── */}
      <Modal visible={!!previewUrl} transparent animationType="slide">
        <View style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.9)',
          justifyContent: 'center',
          alignItems: 'center',
        }}>
          <TouchableOpacity
            onPress={() => setPreviewUrl(null)}
            style={{
              position: 'absolute',
              top: Platform.OS === 'ios' ? 60 : 40,
              right: 20,
              width: 44,
              height: 44,
              borderRadius: 22,
              backgroundColor: 'rgba(255,255,255,0.2)',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 10,
            }}
          >
            <MaterialCommunityIcons name="close" size={24} color="#ffffff" />
          </TouchableOpacity>

          {previewUrl && (
            <Image
              source={{ uri: previewUrl }}
              style={{ width: '100%', height: '80%' }}
              resizeMode="contain"
            />
          )}
        </View>
      </Modal>
    </View>
  );
}
