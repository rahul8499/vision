// // File: app/(sellerTabs)/_layout.tsx
// import { SellerHeader } from '@/components/Header';
// import {
//   Roboto_400Regular,
//   Roboto_500Medium,
//   Roboto_700Bold,
//   useFonts,
// } from '@expo-google-fonts/roboto';
// import { Ionicons } from '@expo/vector-icons';
// import { Tabs } from 'expo-router';
// import React from 'react';
// import {
//   ActivityIndicator,
//   SafeAreaView,
//   StyleSheet,
//   View
// } from 'react-native';

// export default function SellerTabLayout() {
//   const [fontsLoaded] = useFonts({
//     Roboto_400Regular,
//     Roboto_500Medium,
//     Roboto_700Bold,
//   });

//   if (!fontsLoaded) {
//     return (
//       <View style={styles.loadingContainer}>
//         <ActivityIndicator size="large" color="#4FC3F7" />
//       </View>
//     );
//   }

//   return (
//     <SafeAreaView style={{ flex: 1 }}>
//       <Header />
//       <Tabs
//         initialRouteName="home"
//         screenOptions={({ route }) => ({
//           headerShown: false,
//           tabBarActiveTintColor: '#047857',
//           tabBarInactiveTintColor: '#607D8B',
//           tabBarStyle: styles.tabBarStyle,
//           tabBarLabelStyle: styles.tabBarLabelStyle,
//           tabBarIconStyle: styles.tabBarIconStyle,
//           animationEnabled: false,
//           tabBarIcon: ({ color, size }) => {
//             let iconName: keyof typeof Ionicons.glyphMap = 'home-outline';

//             if (route.name === 'index') iconName = 'arrow-down-circle-outline';
//             else if (route.name === 'quotes') iconName = 'chatbox-outline';
//             else if (route.name === 'history') iconName = 'time-outline';
//             else if (route.name === 'settings') iconName = 'settings-outline';

//             return <Ionicons name={iconName} size={size} color={color} />;
//           },
//         })}
//       >
//         <Tabs.Screen name="home" options={{ title: 'Home' }} />
//         <Tabs.Screen name="index" options={{ title: 'Enquiry' }} />
//         <Tabs.Screen name="quotes" options={{ title: 'Quotes' }} />
//         <Tabs.Screen name="history" options={{ title: 'History' }} />
        <Tabs.Screen name="emergency-rewards" options={{ title: "Emergency Rewards", href: null }} />
//         <Tabs.Screen name="settings" options={{ title: 'Settings' }} />
//       </Tabs>
//     </SafeAreaView>
//   );
// }

// const styles = StyleSheet.create({
//   loadingContainer: {
//     flex: 1,
//     justifyContent: 'center',
//     alignItems: 'center',
//   },
//   tabBarStyle: {
//     backgroundColor: '#fff',
//     borderTopWidth: 0,
//     height: 100,
//     shadowColor: '#000',
//     shadowOffset: { width: 0, height: -2 },
//     shadowOpacity: 0.04,
//     shadowRadius: 10,
//     elevation: 10,
//     paddingBottom: 10,
//     justifyContent: 'center',
//   },
//   tabBarLabelStyle: {
//     fontSize: 14,
//     fontFamily: 'Roboto_500Medium',
//     paddingBottom: 6,
//     textAlign: 'center',
//     marginTop: -2,
//   },
//   tabBarIconStyle: {
//     marginBottom: 0,
//     justifyContent: 'center',
//   },
// });
import { SellerHeader, type HeaderNotification } from '@/components/Header';
import { useAppNotifications } from '@/hooks/useAppNotifications';
import { useAppLanguage } from '@/context/LanguageContext';
import {
  Roboto_400Regular,
  Roboto_500Medium,
  Roboto_700Bold,
  useFonts,
} from '@expo-google-fonts/roboto';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import Constants from 'expo-constants';
import { Tabs, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  DeviceEventEmitter,
  Platform,
  SafeAreaView,
  StyleSheet,
  View
} from 'react-native';
import * as Notifications from 'expo-notifications';
import { registerForPushNotificationsAsync } from '../../components/NotificationSetup';
import { useDispatch, useSelector } from 'react-redux';
import { RootState, AppDispatch } from '../../redux/store';
import { fetchUserProfile } from '../../redux/userSlice';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});
type ChatInboxThread = {
  unread_count?: number;
};

const SELLER_NOTIFICATION_TYPES = new Set([
  'NEW_PRESCRIPTION',
  'QUOTE_ACCEPTED',
  'TARGETED_ORDER',
  'ACCEPTED',
  'DELIVERY_SELECTED',
  'ORDER_CANCELLED_BY_USER',
  'REFRESH_REQUEST',
  'USER_NOTE',
  'ORDER_STUCK_ALERT',
  'STUCK_PROCESSING_ALERT',
  'ORDER_AUTO_CANCELLED_STORE',
]);

export default function TabLayout() {
  const [fontsLoaded] = useFonts({
    Roboto_400Regular,
    Roboto_500Medium,
    Roboto_700Bold,
  });

  const { token, user } = useSelector((state: RootState) => state.user);
  const [chatUnreadCount, setChatUnreadCount] = useState(0);
  const [complaintOpenCount, setComplaintOpenCount] = useState(0);
  const dispatch = useDispatch<AppDispatch>();
  const BASE_URL = Constants.expoConfig?.extra?.BASE_URL;
  const router = useRouter();
  const { t } = useAppLanguage();
  const {
    notifications,
    unreadCount: notificationUnreadCount,
    loading: notificationLoading,
    fetchNotifications,
    markRead,
    handleRealtimeMessage,
  } = useAppNotifications({
    baseUrl: BASE_URL,
    token,
    enabled: user?.user_type === 'store',
  });

  // 0️⃣ Redirect if wrong role
  useEffect(() => {
    if (user?.user_type === 'user') {
      router.replace('/(tabs)');
    }
  }, [router, user]);

  const routeSellerNotification = useCallback((data?: Record<string, unknown>) => {
    const notificationType = String(data?.type || '');

    if (notificationType === 'SUPPORT_RATING') {
      const caseId = Number(data?.case_id || 0);
      const route = String(data?.path || '');
      if (caseId && route === 'platform-support') router.push(`/platform-support/${caseId}` as any);
      else if (caseId) router.push(`/support/${caseId}` as any);
    } else if (notificationType.toLowerCase().startsWith('replacement_')) {
      router.push('/(sellerTabs)/replacements' as any);
    } else if (SELLER_NOTIFICATION_TYPES.has(notificationType)) {
      router.push('/(sellerTabs)/active-orders' as any);
    } else if (notificationType === 'NEW_CHAT_MESSAGE') {
      router.push('/(sellerTabs)/inbox' as any);
    } else if (notificationType === 'PHARMACIST_CONSULTATION' || notificationType === 'PHARMACIST_CALLBACK') {
      const consultationId = Number(data?.consultation_id || 0);
      router.push((consultationId ? '/(sellerTabs)/pharmacist/' + consultationId : '/(sellerTabs)/pharmacist') as any);
    }
  }, [router]);

  const handleSellerNotificationPress = useCallback((notification?: HeaderNotification) => {
    if (notification?.id != null) markRead(notification.id);
    const data = notification?.data || {};
    routeSellerNotification({
      ...data,
      type: data.type || notification?.notification_type,
    });
  }, [markRead, routeSellerNotification]);

  // Handle incoming notification deep links
  const notificationResponse = Notifications.useLastNotificationResponse();
  useEffect(() => {
    if (!notificationResponse) return;

    const data = notificationResponse.notification.request.content.data as Record<string, unknown> | undefined;
    routeSellerNotification(data);
    fetchNotifications();
  }, [fetchNotifications, notificationResponse, routeSellerNotification]);

  // 1️⃣ Ensure profile is fetched (which sets the token)
  useEffect(() => {
    if (!token || !user) {
      dispatch(fetchUserProfile());
    }
  }, [dispatch, token, user]);

  // 2️⃣ Setup push notification after token is available
  useEffect(() => {
    if (!token || user?.user_type !== 'store') return; // wait until store auth is ready

    const setupPush = async () => {
      const pushToken = await registerForPushNotificationsAsync();
      if (pushToken) {
        try {
          await axios.post(`${BASE_URL}/api/save-expo-token/`, {
            expo_push_token: pushToken,
          }, {
            headers: {
              Authorization: `Bearer ${token}`,
            }
          });
          console.log('✅ Push token saved successfully');
        } catch (error) {
          console.log('❌ Error saving push token:', error);
        }
      }
    };

    setupPush();
  }, [BASE_URL, token, user?.user_type]);

  useEffect(() => {
    if (!token || user?.user_type !== 'store') return;

    const subscription = Notifications.addNotificationReceivedListener(() => {
      fetchNotifications();
    });

    return () => subscription.remove();
  }, [fetchNotifications, token, user?.user_type]);

  const fetchChatUnreadCount = useCallback(async () => {
    if (!token || !BASE_URL || user?.user_type !== 'store') {
      setChatUnreadCount(0);
      return;
    }

    try {
      const res = await axios.get<ChatInboxThread[]>(`${BASE_URL}/api/chat/inbox/`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
      });
      const totalUnread = res.data.reduce((sum, thread) => sum + (thread.unread_count || 0), 0);
      setChatUnreadCount(totalUnread);
    } catch (error) {
      console.log('❌ Error fetching seller chat unread count:', error);
    }
  }, [BASE_URL, token, user?.user_type]);

  useEffect(() => {
    if (!token || user?.user_type !== 'store') return;

    fetchChatUnreadCount();
    const unreadSync = setInterval(fetchChatUnreadCount, 15000);
    const readSubscription = DeviceEventEmitter.addListener('seller-chat-read', (count: number) => {
      const decrement = Math.max(0, Number(count) || 0);
      setChatUnreadCount((current) => Math.max(0, current - decrement));
    });

    return () => {
      clearInterval(unreadSync);
      readSubscription.remove();
    };
  }, [fetchChatUnreadCount, token, user?.user_type]);

  const fetchComplaintCounts = useCallback(async () => {
    if (!token || !BASE_URL || user?.user_type !== 'store') {
      setComplaintOpenCount(0);
      return;
    }
    try {
      const res = await axios.get<{ filed: number; against: number; open_against: number }>(
        `${BASE_URL}/api/complaints/counts/`,
        { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } }
      );
      setComplaintOpenCount(res.data.open_against || 0);
    } catch (error) {
      console.log('❌ Error fetching seller complaint counts:', error);
    }
  }, [BASE_URL, token, user?.user_type]);

  useEffect(() => {
    if (!token || user?.user_type !== 'store') return;

    fetchComplaintCounts();
    const sync = setInterval(fetchComplaintCounts, 30000);

    return () => clearInterval(sync);
  }, [fetchComplaintCounts, token, user?.user_type]);

  useEffect(() => {
    if (!token || !BASE_URL || user?.user_type !== 'store') return;

    let socket: WebSocket | null = null;
    let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
    let isMounted = true;

    const connectUnreadSocket = () => {
      const socketUrl = `${BASE_URL.replace(/^http/, 'ws')}/ws/store-orders/?token=${token}`;
      socket = new WebSocket(socketUrl);

      socket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          handleRealtimeMessage(message);
          if (message.type === 'fulfillment_update' && message.action === 'new_chat_message') {
            fetchChatUnreadCount();
          }
        } catch (error) {
          console.log('❌ Seller chat unread WS parse error:', error);
        }
      };

      socket.onclose = () => {
        if (!isMounted) return;
        reconnectTimeout = setTimeout(connectUnreadSocket, 3000);
      };
    };

    connectUnreadSocket();

    return () => {
      isMounted = false;
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      socket?.close();
    };
  }, [BASE_URL, fetchChatUnreadCount, handleRealtimeMessage, token, user?.user_type]);

  // 3️⃣ Show loading spinner while fonts load
  if (!fontsLoaded) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4FC3F7" />
      </View>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <SellerHeader
        notifications={notifications}
        notificationCount={notificationUnreadCount}
        notificationLoading={notificationLoading}
        onNotificationPress={handleSellerNotificationPress}
        showNotificationDot={chatUnreadCount > 0}
      />

      <Tabs
        initialRouteName="home"
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarActiveTintColor: "#007a53",
          tabBarInactiveTintColor: "#94a3b8",
          tabBarStyle: styles.tabBarStyle,
          tabBarItemStyle: styles.tabBarItemStyle,
          tabBarLabelStyle: styles.tabBarLabelStyle,
          tabBarIconStyle: styles.tabBarIconStyle,
          tabBarHideOnKeyboard: true,
          tabBarAllowFontScaling: false,
          animationEnabled: false,
          tabBarIcon: ({ color, focused }) => {
            let iconName: keyof typeof Ionicons.glyphMap = focused ? "home" : "home-outline";

            if (route.name === "home") iconName = focused ? "storefront" : "storefront-outline";
            else if (route.name === "index") iconName = focused ? "document-text" : "document-text-outline";
            else if (route.name === "active-orders") iconName = focused ? "bag-handle" : "bag-handle-outline";
            else if (route.name === "history") iconName = focused ? "receipt" : "receipt-outline";
            else if (route.name === "inbox") iconName = focused ? "chatbubbles" : "chatbubbles-outline";
            else if (route.name === "support") iconName = focused ? "help-circle" : "help-circle-outline";
            else if (route.name === "settings") iconName = focused ? "settings" : "settings-outline";

            return (
              <View style={styles.tabIconSlot}>
                <View style={[styles.tabIconShell, focused && styles.tabIconShellActive]}>
                  <Ionicons name={iconName} size={focused ? 21 : 20} color={focused ? "#ffffff" : color} />
                </View>
                <View style={[styles.tabActiveLine, { opacity: focused ? 1 : 0 }]} />
              </View>
            );
          },
        })}
      >
        <Tabs.Screen name="home" options={{ title: t('nav.home') }} />
        <Tabs.Screen name="index" options={{ title: t('nav.enquiry') }} />
        <Tabs.Screen name="active-orders" options={{ title: t('nav.orders') }} />
        <Tabs.Screen
          name="inbox"
          options={{
            title: t('nav.chat'),
            tabBarBadge: chatUnreadCount > 0 ? (chatUnreadCount > 99 ? '99+' : chatUnreadCount) : undefined,
            tabBarBadgeStyle: styles.tabBarBadgeStyle,
          }}
        />
        <Tabs.Screen
          name="support"
          options={{
            title: t('nav.support'),
            href: null,
          }}
        />
        <Tabs.Screen name="support/index" options={{ href: null }} />
        <Tabs.Screen name="support/filed" options={{ href: null }} />
        <Tabs.Screen name="support/against" options={{ href: null }} />
        <Tabs.Screen name="support/raise" options={{ href: null }} />
        <Tabs.Screen name="support/[id]" options={{ href: null }} />
        <Tabs.Screen name="pharmacist" options={{ href: null }} />
        <Tabs.Screen name="pharmacist/index" options={{ href: null }} />
        <Tabs.Screen name="pharmacist/[id]" options={{ href: null }} />
        <Tabs.Screen name="legal/[document]" options={{ href: null }} />
        <Tabs.Screen name="help-center" options={{ href: null }} />
        <Tabs.Screen name="help-center/index" options={{ href: null }} />
        <Tabs.Screen name="platform-support" options={{ href: null }} />
        <Tabs.Screen name="platform-support/index" options={{ href: null }} />
        <Tabs.Screen name="platform-support/raise" options={{ href: null }} />
        <Tabs.Screen name="platform-support/[id]" options={{ href: null }} />
        <Tabs.Screen
          name="reports"
          options={{
            title: t('nav.reports'),
            href: null,
          }}
        />
        <Tabs.Screen
          name="history"
          options={{
            title: t('nav.history'),
            href: null,
          }}
        />
        <Tabs.Screen name="emergency-rewards" options={{ title: "Emergency Rewards", href: null }} />
        <Tabs.Screen name="settings" options={{ title: t('nav.settings'), href: null }} />
        <Tabs.Screen name="profile" options={{ title: t('nav.profile'), href: null }} />
        <Tabs.Screen name="documents" options={{ title: t('nav.documents'), href: null }} />
        <Tabs.Screen
          name="replacements"
          options={{
            title: t('nav.replacements'),
            href: null,
          }}
        />
      </Tabs>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  headerContainer: {
    height: Platform.OS === 'ios' ? 100 : 100,
    backgroundColor: '#10B981',
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 40 : 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 4,
  },
  tabBarStyle: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 18,
    marginHorizontal: 10,
    height: Platform.OS === "ios" ? 86 : 80,
    paddingTop: 5,
    paddingBottom: Platform.OS === "ios" ? 14 : 10,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 18,
    transform: [{ translateY: -20 }],
  },
  tabBarItemStyle: {
    height: 58,
    paddingHorizontal: 2,
  },
  tabBarLabelStyle: {
    fontSize: 12,
    lineHeight: 16,
    fontFamily: "Roboto_700Bold",
    letterSpacing: 0,
    marginTop: 1,
    paddingBottom: 2,
  },
  tabBarIconStyle: {
    width: 54,
    height: 36,
  },
  tabIconSlot: {
    width: 54,
    height: 38,
    alignItems: "center",
    justifyContent: "flex-start",
  },
  tabIconShell: {
    width: 42,
    height: 31,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
  },
  tabIconShellActive: {
    backgroundColor: "#007a53",
    shadowColor: "#007a53",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 7,
    elevation: 5,
  },
  tabActiveLine: {
    width: 18,
    height: 2,
    borderRadius: 1,
    marginTop: 3,
    backgroundColor: "#007a53",
  },
  tabBarBadgeStyle: {
    backgroundColor: '#22c55e',
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '900',
  },
});
