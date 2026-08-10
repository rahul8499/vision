import { LocalizedText as Text } from '@/components/Language/LocalizedPrimitives';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState, useRef, useEffect } from 'react';
import {
  ActivityIndicator,
  Animated,
  DeviceEventEmitter,
  Easing,
  Image,
  Modal,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View
} from 'react-native';
import PremiumSideDrawer from './PremiumSideDrawer';
import UserSideDrawer from './UserSideDrawer';

export type HeaderNotification = {
  id: number | string;
  title?: string;
  body?: string;
  notification_type?: string;
  data?: Record<string, unknown>;
  is_read?: boolean;
  created_at?: string | null;
};

type HeaderProps = {
  variant?: 'buyer' | 'seller';
  onMenuPress?: () => void;
  onNotificationPress?: (notification?: HeaderNotification) => void;
  onOpenNotifications?: () => void;
  notifications?: HeaderNotification[];
  notificationCount?: number;
  notificationLoading?: boolean;
  showNotificationDot?: boolean;
};

function Header({
  variant = 'buyer',
  onMenuPress,
  onNotificationPress,
  onOpenNotifications,
  notifications = [],
  notificationCount = 0,
  notificationLoading = false,
  showNotificationDot = false,
}: HeaderProps) {
  const router = useRouter();
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [notifSheetVisible, setNotifSheetVisible] = useState(false);
  const [guideSheetVisible, setGuideSheetVisible] = useState(false);
  const isSeller = variant === 'seller';
  const topInset = Platform.OS === 'android'
    ? (StatusBar.currentHeight ?? 0) + (isSeller ? 2 : 8)
    : (isSeller ? 8 : 14);
  const unreadCount = Math.max(0, Number(notificationCount) || 0);
  const badgeLabel = unreadCount > 99 ? '99+' : String(unreadCount);

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('open-seller-drawer', () => {
      setDrawerVisible(true);
    });
    return () => sub.remove();
  }, []);

  const handleMenuPress = () => {
    if (onMenuPress) {
      onMenuPress();
      return;
    }
    setDrawerVisible(true);
  };

  const handleNotificationClick = () => {
    setNotifSheetVisible(true);
    onOpenNotifications?.();
  };

  const handleDocGuideClick = () => {
    setGuideSheetVisible(true);
  };

  const handleSheetNotificationPress = (notification: HeaderNotification) => {
    setNotifSheetVisible(false);
    onNotificationPress?.(notification);
  };

  return (
    <>
      <View
        className="px-5 pb-2"
        style={{
          paddingTop: topInset,
          marginTop: isSeller ? -30 : 0,
          backgroundColor: isSeller ? '#F4F8FA' : '#fbfcfd',
        }}
      >
        <View className="h-[88px] flex-row items-center justify-between">
          <TouchableOpacity
            activeOpacity={0.82}
            onPress={handleMenuPress}
            className="h-12 w-12 items-center justify-center"
          >
            <MaterialCommunityIcons name="menu" size={32} color={isSeller ? '#123B5D' : '#0f172a'} />
          </TouchableOpacity>

          <View className="flex-1 items-center px-2">
            <Image
              source={require('../assets/images/aarxcolorthemelogo.png')}
              style={{ width: 270, height: 160, maxWidth: '100%' }}
              resizeMode="contain"
            />
          </View>

          <View className="flex-row items-center">
            {isSeller ? (
              <TouchableOpacity
                activeOpacity={0.82}
                onPress={handleDocGuideClick}
                className="h-11 w-11 items-center justify-center rounded-xl mr-2 bg-[#E8F4F5] border border-[#B9DDE0]"
              >
                <MaterialCommunityIcons name="book-open-page-variant-outline" size={23} color="#0F8B8D" />
              </TouchableOpacity>
            ) : null}

            <TouchableOpacity
              activeOpacity={0.82}
              onPress={handleNotificationClick}
              className="h-12 w-12 items-center justify-center"
            >
              <MaterialCommunityIcons name="bell-outline" size={29} color={isSeller ? '#123B5D' : '#0f172a'} />
              {unreadCount > 0 ? (
                <View style={styles.notificationBadge}>
                  <Text style={styles.notificationBadgeText}>{badgeLabel}</Text>
                </View>
              ) : showNotificationDot ? (
                <View className={`absolute right-2.5 top-2.5 h-2 w-2 rounded-full ${isSeller ? 'bg-[#0F8B8D]' : 'bg-[#0fbf84]'}`} />
              ) : null}
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {isSeller ? (
        <PremiumSideDrawer visible={drawerVisible} onClose={() => setDrawerVisible(false)} />
      ) : (
        <UserSideDrawer visible={drawerVisible} onClose={() => setDrawerVisible(false)} />
      )}

      <NotificationSheet
        visible={notifSheetVisible}
        onClose={() => setNotifSheetVisible(false)}
        notifications={notifications}
        loading={notificationLoading}
        onNotificationPress={handleSheetNotificationPress}
      />

      <SellerQuickGuideSheet
        visible={guideSheetVisible}
        onClose={() => setGuideSheetVisible(false)}
      />
    </>
  );
}

export function BuyerHeader(props: Omit<HeaderProps, 'variant'>) {
  return <Header {...props} variant="buyer" />;
}

export function SellerHeader(props: Omit<HeaderProps, 'variant'>) {
  return <Header {...props} variant="seller" />;
}

export default Header;

function NotificationSheet({
  visible,
  onClose,
  notifications,
  loading,
  onNotificationPress,
}: {
  visible: boolean;
  onClose: () => void;
  notifications: HeaderNotification[];
  loading: boolean;
  onNotificationPress: (notification: HeaderNotification) => void;
}) {
  const slideAnim = useRef(new Animated.Value(500)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const hasNotifications = notifications.length > 0;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: 0, duration: 320, easing: Easing.out(Easing.bezier(0.16, 1, 0.3, 1)), useNativeDriver: true }),
        Animated.timing(fadeAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: 500, duration: 250, easing: Easing.in(Easing.ease), useNativeDriver: true }),
        Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start();
    }
  }, [fadeAnim, slideAnim, visible]);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <View style={StyleSheet.absoluteFill}>
        <TouchableWithoutFeedback onPress={onClose}>
          <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.5)', opacity: fadeAnim }]} />
        </TouchableWithoutFeedback>

        <Animated.View style={[styles.sheetContainer, { transform: [{ translateY: slideAnim }] }]}>
          <View style={styles.sheetHandle} />

          <View style={styles.sheetHeader}>
            <View style={styles.sheetTitleRow}>
              <Text style={styles.sheetTitle}>Notifications</Text>
              {loading ? <ActivityIndicator size="small" color="#047857" /> : null}
            </View>
            <TouchableOpacity onPress={onClose} className="bg-slate-100 p-1.5 rounded-full">
              <MaterialCommunityIcons name="close" size={20} color="#64748b" />
            </TouchableOpacity>
          </View>

          {loading && !hasNotifications ? (
            <View style={styles.emptyContainer}>
              <ActivityIndicator size="large" color="#047857" />
            </View>
          ) : hasNotifications ? (
            <ScrollView
              style={styles.notificationList}
              contentContainerStyle={styles.notificationListContent}
              showsVerticalScrollIndicator={false}
            >
              {notifications.map((notification) => (
                <TouchableOpacity
                  key={String(notification.id)}
                  activeOpacity={0.84}
                  onPress={() => onNotificationPress(notification)}
                  style={[styles.notificationItem, !notification.is_read && styles.notificationItemUnread]}
                >
                  <View style={styles.notificationIconShell}>
                    <MaterialCommunityIcons
                      name={getNotificationIcon(notification)}
                      size={21}
                      color="#047857"
                    />
                  </View>
                  <View style={styles.notificationTextBlock}>
                    <View style={styles.notificationTitleRow}>
                      <Text style={styles.notificationTitle} numberOfLines={1}>
                        {notification.title || 'Notification'}
                      </Text>
                      {!notification.is_read ? <View style={styles.unreadDot} /> : null}
                    </View>
                    {notification.body ? (
                      <Text style={styles.notificationBody} numberOfLines={2}>
                        {notification.body}
                      </Text>
                    ) : null}
                    {notification.created_at ? (
                      <Text style={styles.notificationTime}>{formatNotificationTime(notification.created_at)}</Text>
                    ) : null}
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          ) : (
            <View style={styles.emptyContainer}>
              <View className="w-20 h-20 bg-emerald-50 rounded-full items-center justify-center mb-4">
                <MaterialCommunityIcons name="bell-sleep-outline" size={38} color="#10b981" />
              </View>
              <Text className="text-lg font-black text-slate-800">No New Notifications</Text>
              <Text className="text-sm font-semibold text-slate-500 mt-1 text-center px-4 leading-5">
                {"You're all caught up! New alerts for orders and enquiries will appear here."}
              </Text>
            </View>
          )}
        </Animated.View>
      </View>
    </Modal>
  );
}

function getNotificationIcon(notification: HeaderNotification): keyof typeof MaterialCommunityIcons.glyphMap {
  const type = String(notification.data?.type || notification.notification_type || '');

  if (type === 'NEW_CHAT_MESSAGE') return 'chat-processing-outline';
  if (type.includes('ORDER') || type.includes('DELIVERY') || type.includes('PACK') || type.includes('BILLING')) {
    return 'package-variant-closed';
  }
  if (type.includes('PRESCRIPTION') || type.includes('QUOTE') || type.includes('STOCK') || type.includes('REPORT')) {
    return 'file-document-outline';
  }

  return 'bell-ring-outline';
}

function formatNotificationTime(value: string) {
  const createdAt = new Date(value).getTime();
  if (!Number.isFinite(createdAt)) return '';

  const diffMs = Date.now() - createdAt;
  const minutes = Math.max(0, Math.floor(diffMs / 60000));

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;

  return new Date(value).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

const styles = StyleSheet.create({
  notificationBadge: {
    position: 'absolute',
    right: 0,
    top: 4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ef4444',
    borderWidth: 2,
    borderColor: '#fbfcfd',
  },
  notificationBadgeText: {
    color: '#ffffff',
    fontSize: 10,
    lineHeight: 12,
    fontWeight: '900',
  },
  sheetContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    minHeight: 350,
    maxHeight: '78%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -5 },
    shadowOpacity: 0.1,
    shadowRadius: 15,
    elevation: 20,
  },
  sheetHandle: {
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#cbd5e1',
    alignSelf: 'center',
    marginBottom: 20,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 18,
  },
  sheetTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  sheetTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0f172a',
  },
  notificationList: {
    flexGrow: 0,
  },
  notificationListContent: {
    gap: 10,
    paddingBottom: 6,
  },
  notificationItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#ffffff',
    padding: 12,
  },
  notificationItemUnread: {
    borderColor: '#bbf7d0',
    backgroundColor: '#f0fdf4',
  },
  notificationIconShell: {
    width: 38,
    height: 38,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#dcfce7',
    marginRight: 10,
  },
  notificationTextBlock: {
    flex: 1,
    minWidth: 0,
  },
  notificationTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  notificationTitle: {
    flex: 1,
    minWidth: 0,
    color: '#0f172a',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '900',
  },
  notificationBody: {
    marginTop: 3,
    color: '#475569',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
  notificationTime: {
    marginTop: 6,
    color: '#94a3b8',
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '700',
  },
  unreadDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#ef4444',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 20,
    minHeight: 230,
  },
  guideSheetContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    maxHeight: '82%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -5 },
    shadowOpacity: 0.12,
    shadowRadius: 15,
    elevation: 20,
  },
  guideSheetTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#123B5D',
  },
  guideSheetSubtitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#627D98',
    marginTop: 2,
  },
  guideItemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#B9DDE0',
    backgroundColor: '#F4F8FA',
    padding: 12,
    gap: 10,
  },
  guideIconShell: {
    width: 42,
    height: 42,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E8F4F5',
  },
  guideItemTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: '#102A43',
    flex: 1,
  },
  guideItemDesc: {
    fontSize: 12,
    fontWeight: '500',
    color: '#627D98',
    marginTop: 2,
    lineHeight: 16,
  },
  guideBadgePill: {
    backgroundColor: '#E8F4F5',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#B9DDE0',
  },
  guideBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#0F8B8D',
  },
});

type GuideModuleKey = 'home' | 'enquiry' | 'orders' | 'inbox' | 'documents' | 'reports' | 'support' | 'rewards';

const GUIDE_MODULES: Record<GuideModuleKey, {
  id: GuideModuleKey;
  title: string;
  badge: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  route: string;
  overview: string;
  steps: { step: number; title: string; desc: string }[];
  legends?: { label: string; title: string; color: string; bg: string; desc: string }[];
  rules: string[];
}> = {
  home: {
    id: 'home',
    title: 'Store Home Dashboard',
    badge: 'Main',
    icon: 'storefront-outline',
    route: '/(sellerTabs)/home',
    overview: 'Central command center for store online availability, live revenue tracking, emergency alert banners, and daily metrics.',
    steps: [
      { step: 1, title: 'Online/Offline Store Switch', desc: 'Action: Toggle top-right Online/Offline switch to start or pause receiving customer prescription enquiries.' },
      { step: 2, title: 'Live Sales & Metric Summary', desc: 'Action: View today\'s gross sales, completed order count, pending quote count, and fulfillment rate.' },
      { step: 3, title: 'Emergency Alert Banner', desc: 'Action: Check top red banner for urgent medicine requests in your local area and tap to quote instantly.' },
    ],
    rules: [
      'Keep store ONLINE during working hours for maximum prescription enquiry matching.',
      'Check top emergency banners daily for high-priority local medicine requests.',
    ]
  },
  enquiry: {
    id: 'enquiry',
    title: '1. Prescription Enquiries & Quotation Engine',
    badge: 'Quotes',
    icon: 'file-document-outline',
    route: '/(sellerTabs)',
    overview: 'PHASE 1 of Seller Lifecycle: Process Rx uploads, AI OCR extraction, Manual Review tags, Repeat Patient badges, Quotation Scenarios, and Stock Re-check requests.',
    steps: [
      { step: 1, title: 'Step 1: Patient Rx Upload & AI Check', desc: 'Rx request appears in "Enquiry" (or "Emergency" 🚨). Card shows AI Scan status (AI Rx Verified 🟢 / AI Medicine / Manual Review 🟠). Action: Tap card to inspect doctor handwriting photo, extracted medicines & patient location.' },
      { step: 2, title: 'Step 2: Check Repeat Patient & Scenarios', desc: 'Review "Repeat Patient" badge (shows past purchase count) to offer loyalty discounts. Select Quotation Scenario (Prescribed Brands / All Generics / Brand Substitutes / Partial Availability).' },
      { step: 3, title: 'Step 3: Add Price Quote & Submit', desc: 'Action: Tap "Add Price Quote" button -> Enter medicine unit prices, GST tax %, discount %, and substitute brand names if out of stock -> Tap "Submit Quote".' },
      { step: 4, title: 'Step 4: Stock Re-check (Verification Tab)', desc: 'If buyer requests a fresh stock re-check before placing order, card moves to "Verification" tab. Action: Check physical stock & tap "Verify Stock" button.' },
      { step: 5, title: 'Step 5: Buyer Accepts -> Converts to Active Order', desc: 'Buyer receives quotation notification and taps "Accept Quote". Card automatically disappears from Enquiries and moves to "Active Orders" as a NEW order!' },
    ],
    legends: [
      { label: 'EMERGENCY', title: 'Emergency Rx Request (🚨 Red Alert)', color: '#dc2626', bg: '#fef2f2', desc: 'Urgent prescription upload. Action: Tap card & submit quote within 5 minutes.' },
      { label: 'AI VERIFIED', title: 'AI OCR Scan (🟢 Rx Verified)', color: '#16A34A', bg: '#ECFDF3', desc: 'AI verified authentic doctor prescription and extracted dosage details.' },
      { label: 'MANUAL REVIEW', title: 'Manual Review Needed (🟠 Text/Unclear Rx)', color: '#c2410c', bg: '#fff7ed', desc: 'Handwritten Rx or text request. Action: Seller must manually review Rx photo before quoting.' },
      { label: 'REPEAT PATIENT', title: 'Repeat Customer Badge (💜 Loyalty)', color: '#7c3aed', bg: '#f3e8ff', desc: 'Shows patient purchase history & order count to offer loyal customer discounts.' },
      { label: 'VERIFY STOCK', title: 'Stock Re-check Request (🔄 Verification Tab)', color: '#123B5D', bg: '#F4F8FA', desc: 'Buyer asked for fresh stock confirmation. Action: Check stock & tap "Verify Stock".' },
      { label: 'SENT QUOTE', title: 'Sent Price Quote (🟢 Quote Tab)', color: '#16A34A', bg: '#ECFDF3', desc: 'Quote sent with unit price, GST tax, brand substitutes & delivery ETA. Awaiting buyer acceptance.' },
      { label: 'REJECTED', title: 'Rejected Quote (🔴 Rejected Tab)', color: '#dc2626', bg: '#fef2f2', desc: 'Quote declined or dismissed by the patient.' },
    ],
    rules: [
      'Submit quotes within 10 minutes for maximum conversion rate.',
      'Check AI extracted medicine confidence score and verify doctor handwriting manually.',
      'Promptly tap "Verify Stock" when buyers request stock re-check verification.',
    ]
  },
  orders: {
    id: 'orders',
    title: '2. Active Orders & Dispatch Pipeline',
    badge: 'Orders',
    icon: 'package-variant-closed',
    route: '/(sellerTabs)/active-orders',
    overview: 'PHASE 2 of Seller Lifecycle: Process accepted quote orders through billing, packing, Mappls GPS courier dispatch / counter pickup, and OTP completion for bank payout.',
    steps: [
      { step: 1, title: 'Step 1: Stage NEW -> Tap Start Billing', desc: 'Order converted from accepted quote appears under NEW stage. Action: Review medicine items & tap "Start Billing" button (Status changes to BILLING).' },
      { step: 2, title: 'Step 2: Stage BILLING -> Pack & Print Invoice', desc: 'Action: Pick medicines from pharmacy shelf, pack securely, print tax invoice, attach invoice to box, and tap "Mark as Packed" button (Status changes to PACKED).' },
      { step: 3, title: 'Step 3: Stage PACKED -> Mappls GPS Dispatch / Pickup', desc: 'For Home Delivery -> Action: Tap "Dispatch Order" -> Select courier partner -> Tap "Start Navigation" to view live Mappls GPS map pin. For Store Pickup -> Action: Tap "Ready for Pickup".' },
      { step: 4, title: 'Step 4: Stage DELIVERY/READY -> OTP Completion', desc: 'Action: Ask customer/courier for 4-digit OTP -> Tap "Enter OTP" -> Enter code -> Tap "Verify & Complete". Status becomes COMPLETED & store payout is logged in bank settlement!' },
    ],
    legends: [
      { label: 'EMERGENCY', title: 'Emergency Order (🚨 Red Urgency)', color: '#dc2626', bg: '#fef2f2', desc: 'High priority order with strict SLA. Action: Immediate billing & priority courier dispatch.' },
      { label: 'DELIVERY', title: 'Home Delivery Order (🚚 Mappls Map)', color: '#0284c7', bg: '#f0f9ff', desc: 'Delivery partner assigned with Mappls GPS destination map & delivery OTP verification.' },
      { label: 'PICKUP', title: 'Store Counter Pickup (🏪 Counter Pickup)', color: '#059669', bg: '#ecfdf5', desc: 'Patient collects medicines at store counter after providing 4-digit OTP.' },
      { label: 'RETURNS', title: 'Delivery Returns (🔄 Courier Package Return)', color: '#ea580c', bg: '#fff7ed', desc: 'Courier brings back undelivered package. Action: Inspect box -> Tap "Receive Return" (or "Dispute Return" if damaged).' },
      { label: 'REPLACE', title: 'Customer Replacement (🔁 Item Defect Claim)', color: '#8b5cf6', bg: '#f3e8ff', desc: 'Customer replacement claim for item defect/expiry. Action: Inspect damage photos -> Tap "Approve & Dispatch Replacement".' },
      { label: 'CONSULT', title: 'Pharmacist Consultation (👨‍⚕️ Advisory Call)', color: '#0F8B8D', bg: '#E8F4F5', desc: 'Advisory request linked to prescription. Action: Tap "Call Customer" for phone consultation or send dosage notes.' },
      { label: 'COMPLETED', title: 'Order Completed (✅ Bank Payout Settlement)', color: '#64748b', bg: '#f8fafc', desc: 'Safely delivered & OTP verified order with payout logged in store settlement.' },
      { label: 'CANCELLED', title: 'Order Cancelled (❌ Cancellation Audit)', color: '#dc2626', bg: '#fef2f2', desc: 'Order cancelled with audit trail recording who cancelled (Customer/Store/System) and exact reason.' },
    ],
    rules: [
      'Always verify 4-digit OTP before handing over medicine packages.',
      'Use built-in Mappls map GPS navigation for accurate home delivery address pins.',
      'Inspect return packages from delivery partners carefully before tapping "Receive Return".',
      'For replacement claims, review customer uploaded damage photos before approving dispatch.',
    ]
  },
  inbox: {
    id: 'inbox',
    title: 'Customer Chat & Pharmacist Consultation',
    badge: 'Chat',
    icon: 'chat-processing-outline',
    route: '/(sellerTabs)/inbox',
    overview: 'Direct real-time chat with buyers and live Pharmacist Consultation advisory sessions.',
    steps: [
      { step: 1, title: 'Step 1: Real-Time Buyer Chat', desc: 'Action: Open chat thread to answer patient queries regarding quote prices, delivery timings & dosage instructions.' },
      { step: 2, title: 'Step 2: Pharmacist Advisory Session', desc: 'Action: Tap "Pharmacist Call" to conduct phone consultation or send written patient guidance notes.' },
      { step: 3, title: 'Step 3: Attach Medicine Photos', desc: 'Action: Tap paperclip icon to send photos of medicine packaging, batch numbers, or alternative brands.' },
    ],
    rules: [
      'Provide clear dosage advice during pharmacist consultation sessions.',
      'Keep all customer communications professional and within platform chat.',
    ]
  },
  documents: {
    id: 'documents',
    title: 'Store Verification & License Compliance',
    badge: 'Compliance',
    icon: 'shield-check-outline',
    route: '/(sellerTabs)/documents?fromDrawer=true',
    overview: 'Manage pharmacy licenses, Form 20/21 Drug License, GSTIN registration, and store compliance verification.',
    steps: [
      { step: 1, title: 'Step 1: Upload License Documents', desc: 'Action: Tap "Upload Document" -> Select clear PDF or image files of Form 20/21 Drug License and GST Certificate.' },
      { step: 2, title: 'Step 2: Admin Verification Status', desc: 'Action: Monitor verification status badges: Verified 🟢 (Full store operations enabled), Pending 🟡 (Under review by compliance team), Action Needed 🔴 (Re-upload requested).' },
      { step: 3, title: 'Step 3: Expiration Reminders', desc: 'Action: Automated notification alerts sent 30 days prior to license expiry date to upload renewed license.' },
    ],
    legends: [
      { label: 'VERIFIED', title: 'Verified Store (🟢 Compliance Approved)', color: '#16A34A', bg: '#ECFDF3', desc: 'Form 20/21 Drug License and GSTIN approved by admin.' },
      { label: 'PENDING', title: 'Pending Review (🟡 Admin Review)', color: '#d97706', bg: '#fffbeb', desc: 'Uploaded documents are currently under review by AARX compliance officers.' },
      { label: 'ACTION NEEDED', title: 'Action Needed (🔴 Re-upload Required)', color: '#dc2626', bg: '#fef2f2', desc: 'License document expired or blurry. Re-upload required to maintain active store listing.' },
    ],
    rules: [
      'Valid Drug License is mandatory for store operation on AARX platform.',
      'Keep license copies updated to avoid temporary store suspension.',
    ]
  },
  reports: {
    id: 'reports',
    title: 'Enterprise PDF Business Reports',
    badge: 'Reports',
    icon: 'chart-box-outline',
    route: '/(sellerTabs)/reports',
    overview: 'Generate pixel-perfect 1-page PDF executive performance reports with live store analytics.',
    steps: [
      { step: 1, title: 'Step 1: Select Date Range', desc: 'Action: Tap date range pill ("Today", "Last 7 Days", "Last 30 Days", or "Custom Range").' },
      { step: 2, title: 'Step 2: Generate PDF Report', desc: 'Action: Tap "Generate & View PDF Report". Engine calculates live DB revenue, fulfillment rate, top 5 selling medicines & category demand split.' },
      { step: 3, title: 'Step 3: Preview & Print/Share', desc: 'Action: Preview 1-page AARX corporate PDF, print or share report directly via WhatsApp or Email.' },
    ],
    legends: [
      { label: '1-PAGE PDF', title: 'Strict 1-Page Printable PDF', color: '#123B5D', bg: '#F4F8FA', desc: 'Executive layout featuring enlarged AARX logo, financial grid & zero 2nd page overflow.' },
      { label: 'LIVE DB STATS', title: 'Dynamic Database Metrics', color: '#0F8B8D', bg: '#E8F4F5', desc: 'Gross sales, net payouts, cancellation rate, top medicines & category demand split.' },
    ],
    rules: [
      'Report is strictly optimized to fit on 1 printable A4 page.',
      'All revenue and order statistics are dynamically calculated from actual DB transactions.',
    ]
  },
  support: {
    id: 'support',
    title: 'Support, Complaints & Safety Resolution',
    badge: 'Support',
    icon: 'headphones',
    route: '/(sellerTabs)/support',
    overview: 'Support ticketing system, customer complaint resolution, and store safety escalations.',
    steps: [
      { step: 1, title: 'Step 1: Raise Support Ticket', desc: 'Action: Tap "Raise Support Ticket" -> Select category (Payout, Technical, Account Help) -> Enter details & submit.' },
      { step: 2, title: 'Step 2: Resolve Buyer Complaints', desc: 'Action: Open "Buyer Complaints" -> Review issue -> Tap "Submit Store Resolution" or "Issue Replacement".' },
      { step: 3, title: 'Step 3: Safety Moderation Escalations', desc: 'Action: Escalate prescription safety, fraudulent buyer behavior, or policy violations directly to platform moderation.' },
    ],
    legends: [
      { label: 'SUPPORT TICKET', title: 'Staff Support Ticket (🟢 Open)', color: '#16A34A', bg: '#ECFDF3', desc: 'Direct ticket with AARX support agents for payouts & technical issues.' },
      { label: 'COMPLAINT', title: 'Buyer Complaint (🟡 Action Required)', color: '#d97706', bg: '#fffbeb', desc: 'Customer issue on delivered items requiring store response within 24 hours.' },
      { label: 'SAFETY', title: 'Safety Moderation (🔴 Escalation)', color: '#dc2626', bg: '#fef2f2', desc: 'Safety report escalation for prescription forgery or policy violations.' },
    ],
    rules: [
      'Respond to buyer complaints within 24 hours to maintain clean store rating.',
      'Escalate safety concerns or abusive behavior directly to platform moderation.',
    ]
  },
  rewards: {
    id: 'rewards',
    title: 'Emergency Rewards & Incentive Handbook',
    badge: 'Rewards',
    icon: 'gift-outline',
    route: '/(sellerTabs)/emergency-rewards',
    overview: 'Seller reward tier program, emergency delivery bonus points, and seller handbook.',
    steps: [
      { step: 1, title: 'Step 1: Earn Incentive Points', desc: 'Action: Fulfill emergency Rx orders quickly and maintain >90% completion rate to earn bonus points.' },
      { step: 2, title: 'Step 2: Unlock Tier Benefits', desc: 'Action: Track progress towards Silver, Gold & Platinum seller tiers for reduced commission fees.' },
      { step: 3, title: 'Step 3: Read Seller Handbook', desc: 'Action: Tap "View Handbook" to read official guidelines for reward points and payout cycles.' },
    ],
    legends: [
      { label: 'PLATINUM', title: 'Platinum Tier (🏆 Top Seller)', color: '#123B5D', bg: '#F4F8FA', desc: 'Lowest platform commission fees & priority prescription dispatch matching.' },
      { label: 'BONUS POINTS', title: 'Emergency Bonus Points (⚡ Fast Delivery)', color: '#0F8B8D', bg: '#E8F4F5', desc: 'Extra reward points earned for fulfilling emergency Rx requests under 15 minutes.' },
    ],
    rules: [
      'Maintain high customer ratings (>4.5 stars) to unlock top tier incentives.',
    ]
  },
};

function SellerQuickGuideSheet({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<GuideModuleKey>('home');
  const slideAnim = useRef(new Animated.Value(600)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: 0, duration: 320, easing: Easing.out(Easing.bezier(0.16, 1, 0.3, 1)), useNativeDriver: true }),
        Animated.timing(fadeAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: 600, duration: 250, easing: Easing.in(Easing.ease), useNativeDriver: true }),
        Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start();
    }
  }, [fadeAnim, slideAnim, visible]);

  const activeModule = GUIDE_MODULES[activeTab] || GUIDE_MODULES.home;

  const handleNavigate = (route: string) => {
    onClose();
    setTimeout(() => {
      router.push(route as any);
    }, 150);
  };

  const moduleKeys = Object.keys(GUIDE_MODULES) as GuideModuleKey[];

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <View style={StyleSheet.absoluteFill}>
        <TouchableWithoutFeedback onPress={onClose}>
          <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.55)', opacity: fadeAnim }]} />
        </TouchableWithoutFeedback>

        <Animated.View style={[styles.guideSheetContainer, { transform: [{ translateY: slideAnim }] }]}>
          <View style={styles.sheetHandle} />

          {/* Header */}
          <View style={styles.sheetHeader}>
            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={styles.guideIconShell}>
                <MaterialCommunityIcons name="book-open-page-variant-outline" size={22} color="#0F8B8D" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.guideSheetTitle}>AARX System Guide 📖</Text>
                <Text style={styles.guideSheetSubtitle}>Comprehensive feature documentation & workflows</Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} className="bg-slate-100 p-2 rounded-full">
              <MaterialCommunityIcons name="close" size={20} color="#64748b" />
            </TouchableOpacity>
          </View>

          {/* Module Selector Pills */}
          <View style={{ marginBottom: 14 }}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {moduleKeys.map((key) => {
                const item = GUIDE_MODULES[key];
                const isActive = activeTab === key;
                return (
                  <TouchableOpacity
                    key={key}
                    activeOpacity={0.82}
                    onPress={() => setActiveTab(key)}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      paddingHorizontal: 12,
                      paddingVertical: 7,
                      borderRadius: 10,
                      backgroundColor: isActive ? '#123B5D' : '#F4F8FA',
                      borderWidth: 1,
                      borderColor: isActive ? '#123B5D' : '#B9DDE0',
                      gap: 6,
                    }}
                  >
                    <MaterialCommunityIcons name={item.icon} size={16} color={isActive ? '#FFFFFF' : '#0F8B8D'} />
                    <Text style={{ fontSize: 12, fontWeight: '800', color: isActive ? '#FFFFFF' : '#102A43' }}>
                      {item.badge}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* Active Module Detailed Documentation Content */}
          <ScrollView style={{ flexGrow: 0 }} contentContainerStyle={{ gap: 14, paddingBottom: 20 }} showsVerticalScrollIndicator={false}>
            {/* 1️⃣ WHAT IS THIS FEATURE? (Overview Card) */}
            <View style={{ borderRadius: 14, borderWidth: 1, borderColor: '#B9DDE0', backgroundColor: '#E8F4F5', padding: 14 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                  <MaterialCommunityIcons name={activeModule.icon} size={22} color="#0F8B8D" />
                  <Text style={{ fontSize: 15, fontWeight: '900', color: '#123B5D', flex: 1 }}>
                    💡 WHAT IS THIS FEATURE? — {activeModule.title}
                  </Text>
                </View>
                <View style={styles.guideBadgePill}>
                  <Text style={styles.guideBadgeText}>{activeModule.badge}</Text>
                </View>
              </View>
              <Text style={{ fontSize: 12, fontWeight: '700', color: '#102A43', lineHeight: 18, marginTop: 4 }}>
                {activeModule.overview}
              </Text>
            </View>

            {/* 2️⃣ WHAT ACTION TO TAKE? (Step-by-Step Seller Actions) */}
            <View>
              <Text style={{ fontSize: 12, fontWeight: '900', color: '#123B5D', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
                ⚡ WHAT ACTION TO TAKE? (Step-by-Step Store Workflow)
              </Text>
              <View style={{ borderRadius: 14, borderWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#F8FAFC', padding: 12, gap: 10 }}>
                {activeModule.steps.map((st) => (
                  <View key={st.step} style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                    <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: '#0F8B8D', alignItems: 'center', justifyContent: 'center', marginRight: 10, marginTop: 1 }}>
                      <Text style={{ fontSize: 11, fontWeight: '900', color: '#FFFFFF' }}>{st.step}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 13, fontWeight: '900', color: '#102A43' }}>{st.title}</Text>
                      <Text style={{ fontSize: 12, fontWeight: '600', color: '#475569', marginTop: 2, lineHeight: 17 }}>{st.desc}</Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>

            {/* 3️⃣ STAGE STRIP COLORS (If available) */}
            {activeModule.legends ? (
              <View>
                <Text style={{ fontSize: 12, fontWeight: '900', color: '#123B5D', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
                  🎨 STAGE STRIP COLORS (Card Color Patti Legend)
                </Text>
                <View style={{ gap: 8 }}>
                  {activeModule.legends.map((item) => (
                    <View key={item.label} style={{ flexDirection: 'row', alignItems: 'flex-start', borderRadius: 12, borderWidth: 1, padding: 10, backgroundColor: item.bg, borderColor: `${item.color}30` }}>
                      <View style={{ height: '100%', width: 5, borderRadius: 3, backgroundColor: item.color, marginRight: 10 }} />
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                          <Text style={{ fontSize: 12, fontWeight: '900', color: item.color }}>{item.title}</Text>
                          <View style={{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#cbd5e1' }}>
                            <Text style={{ fontSize: 9, fontWeight: '900', color: item.color }}>{item.label}</Text>
                          </View>
                        </View>
                        <Text style={{ fontSize: 11, fontWeight: '600', color: '#475569', marginTop: 3, lineHeight: 15 }}>{item.desc}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}

            {/* 4️⃣ KEY STORE RULES & BEST PRACTICES */}
            <View>
              <Text style={{ fontSize: 12, fontWeight: '900', color: '#123B5D', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
                📜 KEY STORE RULES & BEST PRACTICES
              </Text>
              <View style={{ borderRadius: 14, borderWidth: 1, borderColor: '#B9DDE0', backgroundColor: '#ffffff', padding: 12, gap: 8 }}>
                {activeModule.rules.map((rule, idx) => (
                  <View key={idx} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
                    <MaterialCommunityIcons name="check-circle-outline" size={17} color="#0F8B8D" style={{ marginTop: 1 }} />
                    <Text style={{ fontSize: 12, fontWeight: '600', color: '#102A43', flex: 1, lineHeight: 17 }}>
                      {rule}
                    </Text>
                  </View>
                ))}
              </View>
            </View>

            {/* 5️⃣ Navigation Action Button */}
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => handleNavigate(activeModule.route)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#123B5D',
                borderRadius: 14,
                paddingVertical: 14,
                paddingHorizontal: 16,
                marginTop: 6,
                gap: 8,
              }}
            >
              <Text style={{ fontSize: 14, fontWeight: '900', color: '#FFFFFF' }}>
                Open {activeModule.title} Screen
              </Text>
              <MaterialCommunityIcons name="arrow-right" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}
