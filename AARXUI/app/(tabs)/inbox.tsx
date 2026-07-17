import { LocalizedText as Text } from '@/components/Language/LocalizedPrimitives';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import axios from 'axios';
import Constants from 'expo-constants';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useFocusEffect } from 'expo-router';
import React, { useState, useCallback, useEffect, memo } from 'react';
import {
  FlatList,
  TouchableOpacity,
  View,
  RefreshControl,
  ImageBackground
} from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { useDispatch, useSelector } from 'react-redux';
import { RootState, AppDispatch } from '../../redux/store';
import { fetchUserProfile } from '../../redux/userSlice';
import Toast from 'react-native-toast-message';

// ✅ TYPES
type LatestMessage = {
    text: string;
};

type ChatThread = {
    id: number;
    store_name: string;
    latest_message?: LatestMessage | null;
    updated_at: string;
    prescription_image?: string | null;
    prescription_id?: number | null;
    unread_count?: number;
    order_status?: string;
    is_chat_locked?: boolean;
};

// 📦 MEMOIZED THREAD ITEM
const ThreadItem = memo(({ item, onPress }: { item: ChatThread, onPress: () => void }) => {
    const unreadCount = item.unread_count || 0;
    const hasUnread = unreadCount > 0;
    const unreadLabel = unreadCount > 99 ? '99+' : String(unreadCount);
    const isLocked = item.is_chat_locked;

    return (
        <TouchableOpacity
            onPress={onPress}
            className={`bg-white rounded-[2rem] mb-4 border border-slate-200/50 shadow-xl shadow-slate-200/40 p-5 flex-row items-center active:bg-slate-50 ${isLocked ? 'opacity-80' : ''}`}
        >
            <View className="w-14 h-14 rounded-2xl bg-emerald-50 border border-emerald-100 items-center justify-center relative shadow-sm overflow-hidden">
                {item.prescription_image ? (
                    <ExpoImage
                        source={{ uri: item.prescription_image }}
                        style={{ width: '100%', height: '100%' }}
                        contentFit="cover"
                        transition={200}
                    />
                ) : (
                    <MaterialCommunityIcons name="storefront-outline" size={24} color={isLocked ? "#94a3b8" : "#059669"} />
                )}
                {!isLocked && <View className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-emerald-500 border-2 border-white rounded-full" />}
            </View>

            <View className="ml-4 flex-1">
                <View className="flex-row justify-between items-center mb-1">
                    <Text className="text-lg font-black text-slate-900 tracking-tighter flex-1 pr-3" numberOfLines={1}>
                        {item.store_name}
                    </Text>
                    {isLocked ? (
                        <View className="px-2 py-0.5 rounded-full bg-slate-100 border border-slate-200 flex-row items-center">
                            <MaterialCommunityIcons name="lock" size={10} color="#64748b" style={{ marginRight: 2 }} />
                            <Text className="text-slate-500 text-[9px] font-black uppercase tracking-wider">
                                {item.order_status === 'completed' ? 'Done' : 'Closed'}
                            </Text>
                        </View>
                    ) : hasUnread ? (
                        <View className="min-w-[22px] h-[22px] px-1.5 rounded-full bg-emerald-500 items-center justify-center">
                            <Text className="text-white text-[10px] font-black">
                                {unreadLabel}
                            </Text>
                        </View>
                    ) : (
                        <MaterialCommunityIcons name="chevron-right" size={18} color="#cbd5e1" />
                    )}
                </View>

                <Text className={hasUnread ? "text-slate-900 font-black text-xs leading-5" : "text-slate-500 font-semibold text-xs leading-5"} numberOfLines={1}>
                    {item.latest_message?.text ?? 'Start conversation by saying hello.'}
                </Text>
            </View>
        </TouchableOpacity>
    );
});
ThreadItem.displayName = 'ThreadItem';

export default function InboxScreen() {
    const router = useRouter();

    const { user, token } = useSelector((state: RootState) => state.user);
    const dispatch = useDispatch<AppDispatch>();
    const [threads, setThreads] = useState<ChatThread[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [refreshing, setRefreshing] = useState<boolean>(false);

    const BASE_URL = Constants.expoConfig?.extra?.BASE_URL || "http://localhost:8000";

    // ✅ TOKEN LOAD ON FOCUS
    useEffect(() => {
        if (!token || !user) {
            dispatch(fetchUserProfile());
        }
    }, [dispatch, token, user]);

    // ✅ FETCH API
    const fetchInbox = useCallback(async (showLoading = true) => {
        if (!token || !user) return;

        try {
            if (showLoading) setLoading(true);
            const res = await axios.get<ChatThread[]>(`${BASE_URL}/api/chat/inbox/`, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    Accept: 'application/json',
                },
            });
            setThreads(res.data);
        } catch (err: any) {
            console.error("Inbox fetch error:", err?.response?.data || err.message);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [BASE_URL, token, user]);

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        fetchInbox(false);
    }, [fetchInbox]);

    useEffect(() => {
        if (token && user) fetchInbox();
    }, [token, user, fetchInbox]);

    useFocusEffect(
        useCallback(() => {
            fetchInbox(false);
            const liveSync = setInterval(() => {
                fetchInbox(false);
            }, 1500);

            return () => clearInterval(liveSync);
        }, [fetchInbox])
    );

    useEffect(() => {
        if (!token || !user || user.user_type !== 'user' || !BASE_URL) return;

        let socket: WebSocket | null = null;
        let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
        let isMounted = true;

        const connectInboxSocket = () => {
            const socketUrl = `${BASE_URL.replace(/^http/, 'ws')}/ws/orders/?token=${token}`;
            socket = new WebSocket(socketUrl);

            socket.onmessage = (event) => {
                try {
                    const message = JSON.parse(event.data);
                    if (message.type !== 'fulfillment_update' || message.action !== 'new_chat_message') return;

                    const update = message.data;
                    fetchInbox(false);
                    Toast.show({
                        type: 'info',
                        text1: `New chat from ${update.sender_name || 'Pharmacy'}`,
                        text2: update.text || 'New message received',
                        position: 'bottom',
                        visibilityTime: 3500,
                    });
                } catch (err) {
                    console.error('Chat inbox WS parse error:', err);
                }
            };

            socket.onclose = () => {
                if (!isMounted) return;
                reconnectTimeout = setTimeout(connectInboxSocket, 3000);
            };
        };

        connectInboxSocket();

        return () => {
            isMounted = false;
            if (reconnectTimeout) clearTimeout(reconnectTimeout);
            socket?.close();
        };
    }, [BASE_URL, token, user, fetchInbox]);

    const renderItem = useCallback(({ item }: { item: ChatThread }) => (
        <ThreadItem item={item} onPress={() => router.push(`/chat/${item.id}`)} />
    ), [router]);

    const renderChatSkeleton = () => (
        <View className="px-4 pt-8">
            {[1, 2, 3, 4].map((item) => (
                <View key={item} className="bg-white rounded-[2rem] mb-4 border border-slate-200/50 shadow-xl shadow-slate-200/40 p-5 flex-row items-center">
                    <View className="w-14 h-14 rounded-2xl bg-emerald-50 border border-emerald-100" />
                    <View className="ml-4 flex-1">
                        <View className="h-5 w-40 bg-slate-200 rounded-full mb-3" />
                        <View className="h-3 w-full bg-slate-100 rounded-full" />
                    </View>
                    <View className="w-8 h-8 rounded-full bg-slate-50 border border-slate-100" />
                </View>
            ))}
        </View>
    );

    return (
        <View className="flex-1 bg-slate-100">
            {/* ===== Premium Header ===== */}
            {/* <View className="relative overflow-hidden z-50">
                <LinearGradient
                    colors={['#0f172a', '#1e293b', '#064e3b']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    className="absolute inset-0 rounded-bl-[5rem] rounded-br-[8rem]"
                />
                <View className="pt-16 pb-8 px-8 relative z-10">
                    <View className="flex-row items-center justify-between">
                        <View className="flex-1 mr-4">
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <Text style={{ fontSize: 30, fontWeight: '900', color: '#ffffff', letterSpacing: 3, lineHeight: 34 }}>
                                    CHAT
                                </Text>
                                <View style={{ width: 1.5, height: 34, backgroundColor: '#34d399', marginHorizontal: 10, borderRadius: 2, opacity: 0.8 }} />
                                <View style={{ justifyContent: 'center' }}>
                                    <Text style={{ fontSize: 9, fontWeight: '800', color: '#34d399', letterSpacing: 2, textTransform: 'uppercase', lineHeight: 13 }}>Secure</Text>
                                    <Text style={{ fontSize: 9, fontWeight: '800', color: '#ffffff', letterSpacing: 1.5, textTransform: 'uppercase', lineHeight: 13 }}>Messages</Text>
                                </View>
                            </View>
                            <Text style={{ fontSize: 6.5, fontWeight: '500', color: 'rgba(255,255,255,0.45)', letterSpacing: 2, textTransform: 'uppercase', marginTop: 4 }}>
                                Pharmacy Conversations
                            </Text>
                        </View>
                        <TouchableOpacity
                            onPress={() => fetchInbox()}
                            className="w-16 h-16 rounded-[1.75rem] bg-white/10 items-center justify-center border border-white/10 shadow-2xl"
                        >
                            <MaterialCommunityIcons name="sync" size={24} color="#ffffff" />
                        </TouchableOpacity>
                    </View>
                </View>
            </View> */}
            <View className="overflow-hidden px-1 rounded-[24px]">
                <ImageBackground
                    source={require('../../assets/images/userchat.png')}
                    resizeMode="cover"
                    style={{
                        width: '100%',
                        height: 170,
                    }}
                />
            </View>

            {loading && threads.length === 0 ? (
                renderChatSkeleton()
            ) : (
                <FlatList
                    data={threads}
                    keyExtractor={(item) => item.id.toString()}
                    contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 30, paddingBottom: 150 }}
                    showsVerticalScrollIndicator={false}
                    initialNumToRender={10}
                    maxToRenderPerBatch={10}
                    windowSize={10}
                    removeClippedSubviews={true}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#059669" />
                    }
                    ListEmptyComponent={() => (
                        <View className="mt-40 items-center px-10">
                            <View className="w-24 h-24 bg-slate-100 rounded-[3rem] items-center justify-center mb-6 border border-slate-200">
                                <MaterialCommunityIcons name="chat-outline" size={40} color="#cbd5e1" />
                            </View>
                            <Text className="text-slate-900 font-black text-xl tracking-tighter mb-2">No Active Conversations</Text>
                            <Text className="text-slate-400 font-bold text-xs text-center leading-5 px-6">Your inbox is completely clear. Messages with pharmacies will appear here.</Text>
                        </View>
                    )}
                    renderItem={renderItem}
                />
            )}
            <Toast />
        </View>
    );
}
