import { LocalizedText as Text } from '@/components/Language/LocalizedPrimitives';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import React, { useState, useRef, useEffect } from 'react';
import {
  ActivityIndicator,
  Animated,
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
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [notifSheetVisible, setNotifSheetVisible] = useState(false);
  const topInset = Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) + 8 : 14;
  const isSeller = variant === 'seller';
  const unreadCount = Math.max(0, Number(notificationCount) || 0);
  const badgeLabel = unreadCount > 99 ? '99+' : String(unreadCount);

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

  const handleSheetNotificationPress = (notification: HeaderNotification) => {
    setNotifSheetVisible(false);
    onNotificationPress?.(notification);
  };

  return (
    <>
      <View className="bg-[#fbfcfd] px-5 pb-2" style={{ paddingTop: topInset }}>
        <View className="h-[88px] flex-row items-center justify-between">
          <TouchableOpacity
            activeOpacity={0.82}
            onPress={handleMenuPress}
            className="h-12 w-12 items-center justify-center"
          >
            <MaterialCommunityIcons name="menu" size={32} color="#0f172a" />
          </TouchableOpacity>

          <View className="flex-1 items-center px-2">
            <Image
              source={require('../assets/images/aarxcolorthemelogo.png')}
              style={{ width: 270, height: 160, maxWidth: '100%' }}
              resizeMode="contain"
            />
          </View>

          <TouchableOpacity
            activeOpacity={0.82}
            onPress={handleNotificationClick}
            className="h-12 w-12 items-center justify-center"
          >
            <MaterialCommunityIcons name="bell-outline" size={29} color="#0f172a" />
            {unreadCount > 0 ? (
              <View style={styles.notificationBadge}>
                <Text style={styles.notificationBadgeText}>{badgeLabel}</Text>
              </View>
            ) : showNotificationDot ? (
              <View className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-[#0fbf84]" />
            ) : null}
          </TouchableOpacity>
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
});
