import { LocalizedText as Text } from '@/components/Language/LocalizedPrimitives';
// import {
//   Roboto_400Regular,
//   Roboto_500Medium,
//   useFonts,
// } from '@expo-google-fonts/roboto';
// import { Ionicons } from '@expo/vector-icons';
// import { Tabs } from 'expo-router';
// import {
  // Platform,
  // SafeAreaView,
  // StyleSheet,
  // View
// } from 'react-native';

// export default function TabLayout() {
//   const [fontsLoaded] = useFonts({
//     Roboto_400Regular,
//     Roboto_500Medium,
//   });

//   if (!fontsLoaded) return null;

//   return (
//      <SafeAreaView style={{ flex: 1 }}>
//       {/* Header Section */}
//       <View style={styles.headerContainer}>
//         <Text style={styles.headerText}>+ AarX</Text>
//       </View>
//     <Tabs
//       initialRouteName="index"
//       screenOptions={({ route }) => ({
//         headerShown: false,
//         tabBarActiveTintColor: '#4FC3F7',
//         tabBarInactiveTintColor: '#607D8B',
//         tabBarStyle: styles.tabBarStyle,
//         tabBarLabelStyle: styles.tabBarLabelStyle,
//         tabBarIconStyle: styles.tabBarIconStyle,
//         tabBarIcon: ({ color, size }) => {
//           let iconName: keyof typeof Ionicons.glyphMap = 'home-outline';

//           if (route.name === 'index') iconName = 'home-outline';
//           else if (route.name === 'prescription') iconName = 'document-text-outline';
//           else if (route.name === 'history') iconName = 'cart-outline';
//           else if (route.name === 'settings') iconName = 'settings-outline';

//           return <Ionicons name={iconName} size={size} color={color} />;
//         },
//       })}
//     >
//       <Tabs.Screen name="index" />
//       <Tabs.Screen name="prescription" />
//       <Tabs.Screen name="history" />
//       <Tabs.Screen name="settings" />
//     </Tabs>
//         </SafeAreaView>

//   );
// }
// const styles = StyleSheet.create({
//   //   headerContainer: {
//   //   height: 100, // Adjust header height
//   //   justifyContent: 'center', // Vertically center the content
//   //   alignItems: 'center', // Horizontally center the content
//   //   paddingTop: Platform.OS === 'ios' ? 40 : 20, // Account for different status bar heights on iOS and Android
//   // },
//   headerContainer: {
//   height: Platform.OS === 'ios' ? 100 : 100,
//   backgroundColor: '#B3E5FC', // Light background for modern feel
//   justifyContent: 'center',
//   alignItems: 'center',
//   paddingTop: Platform.OS === 'ios' ? 40 : 20,
//   borderBottomWidth: 1,
//   borderBottomColor: '#e0e0e0', // subtle border like modern apps
//   shadowColor: '#000',
//   shadowOffset: { width: 0, height: 2 },
//   shadowOpacity: 0.05,
//   shadowRadius: 4,
//   elevation: 4, // For Android shadow
// },
// headerText: {
//   color: 'white', // Or use '#212121' for neutral black
//   fontSize: 32,
//   fontWeight: '900',
//   // fontFamily: 'Roboto_500Medium', // if using Roboto
//   letterSpacing: 2,
// },
//   tabBarStyle: {
//     backgroundColor: '#fff',
//     borderTopWidth: 0,
//     height: 70,
//     shadowColor: '#000',
//     shadowOffset: { width: 0, height: -2 },
//   shadowOpacity: 0.04,
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
//   marginTop: -2,

//   },
//   tabBarIconStyle: {
//     marginBottom: 0,
//     justifyContent: 'center',
//   },
// });

import { BuyerHeader, type HeaderNotification } from '@/components/Header';
import { registerForPushNotificationsAsync } from '@/components/NotificationSetup';
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
import * as SecureStore from 'expo-secure-store';
import React, { useCallback, useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../../redux/store';

import {
  ActivityIndicator,
  Platform,
  SafeAreaView,
  StyleSheet,
  View
} from 'react-native';
import * as Notifications from 'expo-notifications';

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

const PRESCRIPTION_NOTIFICATION_TYPES = new Set([
  'NEW_QUOTATION',
  'PRESCRIPTION_RESPONSE',
  'STORE_UNRESPONSIVE',
  'STOCK_VERIFIED',
  'STORE_REPORT',
]);

const ORDER_NOTIFICATION_TYPES = new Set([
  'BILLING_STARTED',
  'ORDER_PACKED',
  'ORDER_READY_FOR_PICKUP',
  'OUT_FOR_DELIVERY',
  'COMPLETION_OTP_REQUESTED',
  'ORDER_COMPLETED',
  'ORDER_CANCELLED_BY_STORE',
  'MARK_LOCKED',
  'MARK_COMPLETED',
]);

export default function TabLayout() {
  const [fontsLoaded] = useFonts({
    Roboto_400Regular,
    Roboto_500Medium,
    Roboto_700Bold,
  });
  const [token, setToken] = useState<string | null>(null);
  const [chatUnreadCount, setChatUnreadCount] = useState(0);
  const [complaintOpenCount, setComplaintOpenCount] = useState(0);
  const BASE_URL = Constants.expoConfig?.extra?.BASE_URL;
  const router = useRouter();
  const { t } = useAppLanguage();
  const { user } = useSelector((state: RootState) => state.user);
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
    enabled: user?.user_type === 'user',
  });

  // 0️⃣ Redirect if wrong role
  useEffect(() => {
    if (user?.user_type === 'store') {
      router.replace('/(sellerTabs)/home' as any);
    }
  }, [user, router]);

  const routeUserNotification = useCallback((data?: Record<string, unknown>) => {
    const notificationType = String(data?.type || '');

    if (notificationType === 'SUPPORT_RATING') {
      const caseId = Number(data?.case_id || 0);
      const route = String(data?.path || '');
      if (caseId && route === 'platform-support') router.push(`/platform-support/${caseId}` as any);
      else if (caseId) router.push(`/support/${caseId}` as any);
    } else if (PRESCRIPTION_NOTIFICATION_TYPES.has(notificationType)) {
      router.push('/(tabs)/prescription' as any);
    } else if (ORDER_NOTIFICATION_TYPES.has(notificationType)) {
      router.push('/(tabs)/orders' as any);
    } else if (notificationType === 'NEW_CHAT_MESSAGE') {
      router.push('/(tabs)/inbox' as any);
    } else if (notificationType === 'PHARMACIST_CONSULTATION') {
      const consultationId = Number(data?.consultation_id || 0);
      router.push((consultationId ? '/(tabs)/pharmacist/consultation/' + consultationId : '/(tabs)/orders') as any);
    }
  }, [router]);

  const handleUserNotificationPress = useCallback((notification?: HeaderNotification) => {
    if (notification?.id != null) markRead(notification.id);
    const data = notification?.data || {};
    routeUserNotification({
      ...data,
      type: data.type || notification?.notification_type,
    });
  }, [markRead, routeUserNotification]);

  // Handle incoming notification deep links
  const notificationResponse = Notifications.useLastNotificationResponse();
  useEffect(() => {
    if (!notificationResponse) return;

    const data = notificationResponse.notification.request.content.data as Record<string, unknown> | undefined;
    routeUserNotification(data);
    fetchNotifications();
  }, [fetchNotifications, notificationResponse, routeUserNotification]);

  // 1️⃣ Get auth token from SecureStore
  useEffect(() => {
    const getToken = async () => {
      const storedToken = await SecureStore.getItemAsync('authToken');
      console.log("Stored auth token:", storedToken);
      setToken(storedToken);
    };
    getToken();
  }, []);

  // 2️⃣ Setup push notifications for user
  useEffect(() => {
    if (!token || user?.user_type !== 'user') return; // wait until user auth is ready

    const setupPush = async () => {
      const pushToken = await registerForPushNotificationsAsync();
      console.log("Push token:", pushToken);

      if (pushToken) {
        try {
          await axios.post(
            `${BASE_URL}/api/user-save-expo-token/`,
            { expo_push_token: pushToken },
            {
              headers: { Authorization: `Bearer ${token}` },
            }
          );
          console.log('✅ User push token saved successfully');
        } catch (error) {
          console.log('❌ Error saving user push token:', error);
        }
      }
    };

    setupPush();
  }, [token, BASE_URL, user?.user_type]);

  useEffect(() => {
    if (!token || user?.user_type !== 'user') return;

    const subscription = Notifications.addNotificationReceivedListener(() => {
      fetchNotifications();
    });

    return () => subscription.remove();
  }, [fetchNotifications, token, user?.user_type]);

  const fetchChatUnreadCount = useCallback(async () => {
    if (!token || !BASE_URL || user?.user_type !== 'user') {
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
      console.log('❌ Error fetching chat unread count:', error);
    }
  }, [BASE_URL, token, user?.user_type]);

  useEffect(() => {
    if (!token || user?.user_type !== 'user') return;

    fetchChatUnreadCount();
    const unreadSync = setInterval(fetchChatUnreadCount, 15000);

    return () => clearInterval(unreadSync);
  }, [fetchChatUnreadCount, token, user?.user_type]);

  const fetchComplaintCounts = useCallback(async () => {
    if (!token || !BASE_URL || user?.user_type !== 'user') {
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
      console.log('❌ Error fetching complaint counts:', error);
    }
  }, [BASE_URL, token, user?.user_type]);

  useEffect(() => {
    if (!token || user?.user_type !== 'user') return;

    fetchComplaintCounts();
    const sync = setInterval(fetchComplaintCounts, 30000);

    return () => clearInterval(sync);
  }, [fetchComplaintCounts, token, user?.user_type]);

  useEffect(() => {
    if (!token || !BASE_URL || user?.user_type !== 'user') return;

    let socket: WebSocket | null = null;
    let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
    let isMounted = true;

    const connectUnreadSocket = () => {
      const socketUrl = `${BASE_URL.replace(/^http/, 'ws')}/ws/orders/?token=${token}`;
      socket = new WebSocket(socketUrl);

      socket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          handleRealtimeMessage(message);
          if (message.type === 'fulfillment_update' && message.action === 'new_chat_message') {
            fetchChatUnreadCount();
          }
        } catch (error) {
          console.log('❌ Chat unread WS parse error:', error);
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

  // Show spinner while fonts load
  if (!fontsLoaded) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4FC3F7" />
      </View>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1 }}>
      {/* Custom Header */}
      <BuyerHeader
        notifications={notifications}
        notificationCount={notificationUnreadCount}
        notificationLoading={notificationLoading}
        onNotificationPress={handleUserNotificationPress}
        showNotificationDot={chatUnreadCount > 0}
      />
      {/* <Text style={styles.headerText}>+ AarX</Text> */}
      {/* </View> */}

      {/* Tabs Navigation */}
      <Tabs
        initialRouteName="index"
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarActiveTintColor: '#047857',
          tabBarInactiveTintColor: '#607D8B',
          tabBarStyle: styles.tabBarStyle,
          tabBarLabelStyle: styles.tabBarLabelStyle,
          tabBarIconStyle: styles.tabBarIconStyle,
          animationEnabled: false, // Disable animation for instant tab switch
          tabBarIcon: ({ color, size }) => {
            let iconName: keyof typeof Ionicons.glyphMap = 'home-outline';

            if (route.name === 'index') iconName = 'cloud-upload-outline';
            else if (route.name === 'prescription') iconName = 'document-text-outline';
            else if (route.name === 'history') iconName = 'cart-outline';
            else if (route.name === 'orders') iconName = 'receipt-outline';
            else if (route.name === 'inbox') iconName = 'chatbubble-ellipses-outline';
            else if (route.name === 'support') iconName = 'help-circle-outline';
            else if (route.name === 'settings') iconName = 'settings-outline';

            return <Ionicons name={iconName} size={size} color={color} />;
          },
        })}
      >
        <Tabs.Screen name="index" options={{ title: t('nav.upload') }} />
        <Tabs.Screen name="prescription" options={{ title: t('nav.offers') }} />
        <Tabs.Screen name="history" />
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
        <Tabs.Screen name="emergency-requests" options={{ href: null }} />
        <Tabs.Screen name="emergency-payments" options={{ href: null }} />
        <Tabs.Screen name="pharmacist/order/[orderId]" options={{ href: null }} />
        <Tabs.Screen name="pharmacist/consultation/[id]" options={{ href: null }} />
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
        <Tabs.Screen name="orders" options={{ title: t('nav.orders') }} />
        <Tabs.Screen name="settings" />
      </Tabs>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerContainer: {
    height: Platform.OS === 'ios' ? 100 : 100,
    backgroundColor: '#10B981', // Light blue background
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 40 : 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 4, // Android shadow
  },
  headerText: {
    color: '#FFFFFF', // Dark text for contrast
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: 2,
    fontFamily: 'Roboto_500Medium',
  },
  tabBarStyle: {
    backgroundColor: '#fff',
    borderTopWidth: 0,
    height: 100,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 10,
    paddingBottom: 10,
    justifyContent: 'center',
  },
  tabBarLabelStyle: {
    fontSize: 14,
    fontFamily: 'Roboto_500Medium',
    paddingBottom: 6,
    textAlign: 'center',
    marginTop: -2,
  },
  tabBarIconStyle: {
    marginBottom: 0,
    justifyContent: 'center',
  },
  tabBarBadgeStyle: {
    backgroundColor: '#22c55e',
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '900',
  },
});
