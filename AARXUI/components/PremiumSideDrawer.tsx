import { LocalizedText as Text } from '@/components/Language/LocalizedPrimitives';
import { MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import axios from 'axios';
import Constants from 'expo-constants';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Dimensions,
  Easing,
  Linking,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
  ActivityIndicator
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { logout as logoutAction } from '../redux/userSlice';
import { AppDispatch, RootState } from '../redux/store';
import { useAppLanguage } from '@/context/LanguageContext';

const { width } = Dimensions.get('window');
const DRAWER_WIDTH = Math.min(width * 0.88, 390);
const BASE_URL = Constants.expoConfig?.extra?.BASE_URL;

type PremiumSideDrawerProps = {
  visible: boolean;
  onClose: () => void;
};

export default function PremiumSideDrawer({ visible, onClose }: PremiumSideDrawerProps) {
  const slideAnim = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const router = useRouter();
  const dispatch = useDispatch<AppDispatch>();
  const { user, token } = useSelector((state: RootState) => state.user);
  const { t } = useAppLanguage();
  const isStore = user?.user_type === 'store';

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 380,
          easing: Easing.out(Easing.bezier(0.16, 1, 0.3, 1)),
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 320,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: -DRAWER_WIDTH,
          duration: 300,
          easing: Easing.in(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 280,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  const handleClose = () => { onClose(); };

  const navigate = (path: string) => {
    handleClose();
    setTimeout(() => router.push(path as any), 200);
  };

  const [logoutVisible, setLogoutVisible] = useState(false);
  const [confirmBusy, setConfirmBusy] = useState(false);

  const confirmLogout = async () => {
    try {
      setConfirmBusy(true);
      await axios.post(`${BASE_URL}/api/store/logout/`, null, {
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch (_) { }
    dispatch(logoutAction());
    handleClose();
    setConfirmBusy(false);
    setLogoutVisible(false);
    router.replace('/onboarding' as any);
  };

  const handleLogout = () => {
    setLogoutVisible(true);
  };

  const mainMenuItems = [
    { icon: 'grid-large', label: 'Dashboard', subtitle: 'Live overview & stats', color: '#10b981', onPress: () => navigate(isStore ? '/(sellerTabs)/home' : '/(tabs)') },
    { icon: 'alarm-light-outline', label: 'Emergency', subtitle: 'Urgent medicine requests', color: '#e11d48', onPress: () => navigate(isStore ? '/(sellerTabs)?section=emergency' : '/(tabs)/emergency-requests') },
    { icon: 'clipboard-list-outline', label: 'Orders', subtitle: 'Open new orders first', color: '#0f766e', onPress: () => navigate(isStore ? '/(sellerTabs)/active-orders?stage=new' : '/(tabs)/orders') },
    { icon: 'arrow-down-bold-circle-outline', label: 'Enquiry Board', subtitle: 'Manage request quotes', color: '#3b82f6', onPress: () => navigate(isStore ? '/(sellerTabs)' : '/(tabs)') },
    { icon: 'truck-delivery-outline', label: 'Active Orders', subtitle: 'Ongoing order deliveries', color: '#8b5cf6', onPress: () => navigate(isStore ? '/(sellerTabs)/active-orders' : '/(tabs)/history') },
    { icon: 'chat-processing-outline', label: 'Chat Inbox', subtitle: 'Connect with patients', color: '#f59e0b', onPress: () => navigate(isStore ? '/(sellerTabs)/inbox' : '/(tabs)/inbox') },
  ];

  const accountMenuItems = [
    { icon: 'storefront-outline', label: 'My Profile', subtitle: 'Store details & identity', color: '#10b981', onPress: () => navigate(isStore ? '/(sellerTabs)/profile' : '/(tabs)/settings') },
    { icon: 'file-document-multiple-outline', label: 'Store Documents', subtitle: 'Licence & verification proofs', color: '#6366f1', onPress: () => navigate(isStore ? '/(sellerTabs)/documents' : '/(tabs)/settings') },
    { icon: 'cog-outline', label: 'Settings', subtitle: 'Notification & preferences', color: '#64748b', onPress: () => navigate(isStore ? '/(sellerTabs)/settings' : '/(tabs)/settings') },
  ];

  const renderMenuItem = (
    { icon, label, subtitle, color, onPress }: typeof mainMenuItems[0],
    index: number,
    totalItems: number,
  ) => (
    <TouchableOpacity
      key={index}
      activeOpacity={0.68}
      onPress={onPress}
      style={[styles.menuItem, index !== totalItems - 1 && styles.menuItemDivider]}
    >
      <View style={[styles.menuIcon, { backgroundColor: `${color}12`, borderColor: `${color}20` }]}>
        <MaterialCommunityIcons name={icon as any} size={21} color={color} />
      </View>
      <View style={styles.menuCopy}>
        <Text style={styles.menuLabel}>{label}</Text>
        <Text style={styles.menuSubtitle}>{subtitle}</Text>
      </View>
      <View style={styles.chevronShell}>
        <Feather name="chevron-right" size={15} color="#64748b" />
      </View>
    </TouchableOpacity>
  );

  const completionPercent = Math.min(100, Math.max(0, Number((user as any)?.profile_completion_percent) || 70));
  const isVerified = (user as any)?.is_verified;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={handleClose} statusBarTranslucent>
      {Platform.OS === 'android' && <StatusBar backgroundColor="rgba(2,6,23,0.68)" translucent />}
      <View style={styles.modalRoot}>
        {/* Backdrop */}
        <TouchableWithoutFeedback onPress={handleClose}>
          <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]} />
        </TouchableWithoutFeedback>

        {/* Drawer Panel */}
        <Animated.View style={[styles.drawerShadow, { transform: [{ translateX: slideAnim }] }]}>
          <SafeAreaView style={styles.drawerPanel}>

            {/* ── Premium Gradient Header ── */}
            <LinearGradient
              colors={['#0f172a', '#1e293b', '#064e3b']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.hero}
            >
              <View pointerEvents="none" style={[styles.orb, styles.orbTop]} />
              <View pointerEvents="none" style={[styles.orb, styles.orbBottom]} />

              <View style={styles.heroTopRow}>
                <View>
                  <Text style={styles.eyebrow}>AARX SELLER</Text>
                  <Text style={styles.consoleLabel}>Business Console</Text>
                </View>
                <TouchableOpacity onPress={handleClose} activeOpacity={0.72} style={styles.closeButton}>
                  <MaterialCommunityIcons name="close" size={20} color="#ffffff" />
                </TouchableOpacity>
              </View>

              {/* Profile Overview */}
              <View style={styles.profileRow}>
                <View style={styles.avatarOuter}>
                  <LinearGradient colors={['#34d399', '#059669']} style={styles.avatar}>
                    <MaterialCommunityIcons name={isStore ? 'storefront-outline' : 'account-outline'} size={32} color="#ffffff" />
                  </LinearGradient>
                </View>

                <View style={styles.profileCopy}>
                  <Text style={styles.profileName} numberOfLines={1}>
                    {user?.name || (isStore ? 'My Pharmacy' : 'My Account')}
                  </Text>
                  <Text style={styles.profilePhone} numberOfLines={1}>{user?.mobile || 'No Mobile'}</Text>
                  <View style={[styles.verificationBadge, isVerified ? styles.verifiedBadge : styles.pendingBadge]}>
                    <MaterialCommunityIcons name={isVerified ? 'check-decagram' : 'clock-outline'} size={12} color={isVerified ? '#6ee7b7' : '#fde68a'} />
                    <Text style={[styles.verificationText, { color: isVerified ? '#a7f3d0' : '#fef3c7' }]}>
                      {isVerified ? 'Verified business' : 'Verification pending'}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Profile Completion Indicator */}
              <View style={styles.progressCard}>
                <View style={styles.progressHeader}>
                  <View style={styles.progressTitleRow}>
                    <MaterialCommunityIcons name="shield-check-outline" size={15} color="#a7f3d0" />
                    <Text style={styles.progressLabel}>Store setup</Text>
                  </View>
                  <Text style={styles.progressValue}>{completionPercent}%</Text>
                </View>
                <View style={styles.progressTrack}>
                  <LinearGradient
                    colors={['#34d399', '#10b981']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={[styles.progressFill, { width: `${completionPercent}%` as any }]}
                  />
                </View>
              </View>
            </LinearGradient>

            {/* ── Scrollable Menu List ── */}
            <ScrollView
              style={{ flex: 1 }}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.scrollContent}
              bounces={false}
            >
              {/* Category 1: CORE WORK */}
              <Text style={styles.sectionLabel}>
                Core Operations
              </Text>
              <View style={styles.menuGroup}>
                {mainMenuItems.map((item, index) => renderMenuItem(item, index, mainMenuItems.length))}
              </View>

              {/* Category 2: STORE MANAGEMENT */}
              <Text style={[styles.sectionLabel, styles.sectionSpacing]}>
                Store Management
              </Text>
              <View style={styles.menuGroup}>
                {accountMenuItems.map((item, index) => renderMenuItem(item, index, accountMenuItems.length))}
              </View>

              {/* Category 3: HELP & SUPPORT */}
              <Text style={[styles.sectionLabel, styles.sectionSpacing]}>
                Help & Assistance
              </Text>
              <TouchableOpacity
                activeOpacity={0.72}
                onPress={() => Linking.openURL('tel:7796216506')}
                style={styles.supportCard}
              >
                <View style={styles.supportIcon}>
                  <MaterialCommunityIcons name="headset" size={22} color="#047857" />
                </View>
                <View style={styles.menuCopy}>
                  <Text style={styles.supportTitle}>Call Support</Text>
                  <Text style={styles.supportSubtitle}>Get live operator help</Text>
                </View>
                <View style={styles.supportAction}>
                  <Feather name="phone" size={15} color="#ffffff" />
                </View>
              </TouchableOpacity>
            </ScrollView>

            {/* ── Premium Footer ── */}
            <View style={styles.footer}>
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={handleLogout}
                style={styles.logoutButton}
              >
                <View style={styles.logoutIcon}>
                  <MaterialCommunityIcons name="logout-variant" size={18} color="#e11d48" />
                </View>
                <Text style={styles.logoutText}>
                  Sign Out Account
                </Text>
                <Feather name="arrow-right" size={15} color="#fb7185" />
              </TouchableOpacity>

              <Text style={styles.versionText}>
                AARX SELLER • v1.0.0
              </Text>
            </View>
          </SafeAreaView>
        </Animated.View>

        {logoutVisible && (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20, zIndex: 100 }]}>
            <View className="bg-white rounded-[2.25rem] w-full max-w-sm overflow-hidden shadow-2xl border border-slate-200">
              <LinearGradient
                colors={['#0f172a', '#1e293b', '#064e3b']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                className="h-2"
              />
              <View className="p-6">
                <View className="flex-row items-center mb-5">
                  <View className="w-14 h-14 rounded-2xl bg-red-50 border border-red-100 items-center justify-center">
                    <MaterialCommunityIcons name="logout-variant" size={26} color="#DC2626" />
                  </View>
                  <View className="ml-4 flex-1">
                    <Text className="text-xl font-black text-slate-900">{t('logout.title')}</Text>
                    <Text className="text-[9px] font-black text-red-500 uppercase tracking-[2px] mt-0.5">{t('logout.storeEyebrow')}</Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => setLogoutVisible(false)}
                    disabled={confirmBusy}
                    className={`w-9 h-9 rounded-full bg-slate-50 border border-slate-200 items-center justify-center ${confirmBusy ? 'opacity-50' : ''}`}
                  >
                    <MaterialCommunityIcons name="close" size={18} color="#64748b" />
                  </TouchableOpacity>
                </View>

                <View className="bg-slate-50 rounded-[1.5rem] border border-slate-200 p-4 mb-5">
                  <View className="flex-row items-start">
                    <MaterialCommunityIcons name="shield-lock-outline" size={18} color="#059669" />
                    <Text className="text-sm font-semibold text-slate-500 leading-5 ml-3 flex-1">
                      {t('logout.storeMessage')}
                    </Text>
                  </View>
                </View>

                <View className="flex-row w-full gap-3">
                  <TouchableOpacity
                    disabled={confirmBusy}
                    onPress={() => setLogoutVisible(false)}
                    className={`flex-1 py-3.5 bg-slate-50 rounded-full items-center border border-slate-200 ${confirmBusy ? 'opacity-50' : ''}`}
                  >
                    <Text className="text-slate-600 font-black text-sm">{t('logout.stay')}</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={confirmLogout}
                    disabled={confirmBusy}
                    className="flex-1 py-3.5 bg-slate-900 rounded-full items-center shadow-sm"
                  >
                    {confirmBusy ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text className="text-white font-black text-sm">{t('logout.confirm')}</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalRoot: { flex: 1 },
  backdrop: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(2, 6, 23, 0.68)',
  },
  drawerShadow: {
    width: DRAWER_WIDTH,
    height: '100%',
    shadowColor: '#020617',
    shadowOffset: { width: 12, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 32,
    elevation: 30,
  },
  drawerPanel: {
    flex: 1,
    backgroundColor: '#f6f8fb',
    borderTopRightRadius: 28,
    borderBottomRightRadius: 28,
    overflow: 'hidden',
  },
  hero: {
    paddingTop: Platform.OS === 'android' ? 46 : 16,
    paddingHorizontal: 22,
    paddingBottom: 20,
    overflow: 'hidden',
  },
  orb: {
    position: 'absolute',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    backgroundColor: 'rgba(52,211,153,0.08)',
  },
  orbTop: { width: 180, height: 180, right: -76, top: -82 },
  orbBottom: { width: 110, height: 110, left: -54, bottom: -40 },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 22,
  },
  eyebrow: { color: '#6ee7b7', fontSize: 10, fontWeight: '900', letterSpacing: 2.2 },
  consoleLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: '600', marginTop: 3 },
  closeButton: {
    width: 38,
    height: 38,
    borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.09)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileRow: { flexDirection: 'row', alignItems: 'center' },
  avatarOuter: {
    width: 68,
    height: 68,
    borderRadius: 22,
    padding: 3,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  avatar: {
    flex: 1,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#020617',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.22,
    shadowRadius: 10,
    elevation: 5,
  },
  profileCopy: { flex: 1, marginLeft: 15 },
  profileName: { color: '#ffffff', fontSize: 19, lineHeight: 24, fontWeight: '900', letterSpacing: 0.1 },
  profilePhone: { color: 'rgba(255,255,255,0.56)', fontSize: 11, fontWeight: '600', marginTop: 2 },
  verificationBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 7,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  verifiedBadge: { backgroundColor: 'rgba(16,185,129,0.17)', borderColor: 'rgba(110,231,183,0.2)' },
  pendingBadge: { backgroundColor: 'rgba(245,158,11,0.15)', borderColor: 'rgba(253,230,138,0.18)' },
  verificationText: { fontSize: 9, fontWeight: '800', letterSpacing: 0.35, textTransform: 'uppercase' },
  progressCard: {
    marginTop: 18,
    padding: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  progressHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 9 },
  progressTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  progressLabel: { color: 'rgba(255,255,255,0.72)', fontSize: 11, fontWeight: '700' },
  progressValue: { color: '#6ee7b7', fontSize: 11, fontWeight: '900' },
  progressTrack: {
    height: 5,
    borderRadius: 99,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  progressFill: { height: '100%', borderRadius: 99 },
  scrollContent: { paddingHorizontal: 18, paddingTop: 20, paddingBottom: 24 },
  sectionLabel: {
    color: '#94a3b8',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    marginLeft: 5,
    marginBottom: 9,
  },
  sectionSpacing: { marginTop: 21 },
  menuGroup: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e9eef5',
    paddingHorizontal: 12,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.045,
    shadowRadius: 12,
    elevation: 2,
  },
  menuItem: {
    minHeight: 67,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  menuItemDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e8edf3',
  },
  menuIcon: {
    width: 41,
    height: 41,
    borderRadius: 13,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuCopy: { flex: 1, marginLeft: 12 },
  menuLabel: { color: '#172033', fontSize: 13.5, fontWeight: '800' },
  menuSubtitle: { color: '#8a97aa', fontSize: 10.5, fontWeight: '500', marginTop: 2 },
  chevronShell: {
    width: 27,
    height: 27,
    borderRadius: 9,
    backgroundColor: '#f6f8fb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  supportCard: {
    minHeight: 70,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 13,
    borderRadius: 19,
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#c9f3df',
  },
  supportIcon: {
    width: 43,
    height: 43,
    borderRadius: 14,
    backgroundColor: '#d1fae5',
    borderWidth: 1,
    borderColor: '#a7f3d0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  supportTitle: { color: '#065f46', fontSize: 13.5, fontWeight: '900' },
  supportSubtitle: { color: '#47927a', fontSize: 10.5, fontWeight: '600', marginTop: 2 },
  supportAction: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: '#059669',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  footer: {
    paddingHorizontal: 18,
    paddingTop: 13,
    paddingBottom: 15,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#edf1f5',
  },
  logoutButton: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 11,
    borderRadius: 15,
    backgroundColor: '#fff7f8',
    borderWidth: 1,
    borderColor: '#ffe1e6',
  },
  logoutIcon: {
    width: 31,
    height: 31,
    borderRadius: 10,
    backgroundColor: '#ffe4e8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutText: { flex: 1, color: '#be123c', fontSize: 13, fontWeight: '800', marginLeft: 10 },
  versionText: {
    textAlign: 'center',
    color: '#a3adbc',
    fontSize: 9,
    fontWeight: '800',
    marginTop: 11,
    letterSpacing: 1.3,
  },
});
