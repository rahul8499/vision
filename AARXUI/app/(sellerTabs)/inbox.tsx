import { LocalizedText as Text } from '@/components/Language/LocalizedPrimitives';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useIsFocused } from '@react-navigation/native';
import axios from 'axios';
import Constants from 'expo-constants';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  FlatList,
  Platform,
  TouchableOpacity,
  View
} from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { useDispatch, useSelector } from 'react-redux';
import { RootState, AppDispatch } from '../../redux/store';
import { fetchUserProfile } from '../../redux/userSlice';
import Toast from 'react-native-toast-message';
import {
  ActivityIndicator,
  Image,
  RefreshControl,
  ScrollView
} from 'react-native';
// ✅ TYPES
type LatestMessage = {
    text: string;
};

type ChatThread = {
    id: number;
    user_name: string;
    latest_message?: LatestMessage | null;
    updated_at: string;
    prescription_image?: string | null;
    prescription_id?: number | null;
    unread_count?: number;
    order_status?: string;
    is_chat_locked?: boolean;
};

const getImageUri = (BASE_URL: string, image?: string | null) => {
    if (!image) return null;
    return image.startsWith('http') ? image : `${BASE_URL}${image}`;
};

// 🎨 DESIGN SYSTEM COLOR PALETTE
const CHAT_THEME = {
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

const ChatThreadCard = React.memo(({ item, BASE_URL, onPress }: { item: ChatThread; BASE_URL: string; onPress: () => void }) => {
    const imageUri = getImageUri(BASE_URL, item.prescription_image);
    const unreadCount = item.unread_count || 0;
    const hasUnread = unreadCount > 0;
    const unreadLabel = unreadCount > 99 ? '99+' : String(unreadCount);
    const updatedAt = new Date(item.updated_at);
    const formattedTime = updatedAt.toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
    });

    const isLocked = item.is_chat_locked;

    return (
        <TouchableOpacity
            onPress={onPress}
            style={{
                backgroundColor: CHAT_THEME.whiteCard,
                borderColor: CHAT_THEME.borderTeal,
                borderWidth: 1,
            }}
            className={`rounded-[1.5rem] mb-4 shadow-xl shadow-slate-200/40 overflow-hidden active:opacity-90 ${isLocked ? 'opacity-80' : ''}`}
        >
            <View className="px-4 py-3 flex-row items-center">
                <View
                    style={{
                        backgroundColor: CHAT_THEME.lightTealCard,
                        borderColor: CHAT_THEME.borderTeal,
                        borderWidth: 1,
                    }}
                    className="w-14 h-14 rounded-[1.15rem] items-center justify-center relative shadow-sm overflow-hidden"
                >
                    {imageUri ? (
                        <ExpoImage
                            source={{ uri: imageUri }}
                            style={{ width: '100%', height: '100%' }}
                            contentFit="cover"
                        />
                    ) : (
                        <MaterialCommunityIcons name="account-outline" size={24} color={isLocked ? CHAT_THEME.secondaryText : CHAT_THEME.secondaryTeal} />
                    )}
                </View>

                <View className="ml-4 flex-1">
                    <View className="flex-row justify-between items-center mb-1">
                        <Text style={{ color: CHAT_THEME.mainText }} className="text-lg font-black tracking-tight uppercase flex-1 pr-3" numberOfLines={1}>
                            {item.user_name || 'Patient'}
                        </Text>
                        {isLocked ? (
                            <View style={{ backgroundColor: CHAT_THEME.background, borderColor: CHAT_THEME.borderTeal, borderWidth: 1 }} className="px-2 py-0.5 rounded-full flex-row items-center">
                                <MaterialCommunityIcons name="lock" size={10} color={CHAT_THEME.secondaryText} style={{ marginRight: 2 }} />
                                <Text style={{ color: CHAT_THEME.secondaryText }} className="text-[9px] font-black uppercase tracking-wider">
                                    {item.order_status === 'completed' ? 'Done' : 'Closed'}
                                </Text>
                            </View>
                        ) : hasUnread ? (
                            <View style={{ backgroundColor: CHAT_THEME.secondaryTeal }} className="min-w-[22px] h-[22px] px-1.5 rounded-full items-center justify-center">
                                <Text className="text-white text-[10px] font-black">
                                    {unreadLabel}
                                </Text>
                            </View>
                        ) : (
                            <MaterialCommunityIcons name="chevron-right" size={18} color={CHAT_THEME.borderTeal} />
                        )}
                    </View>

                    <Text style={{ color: hasUnread ? CHAT_THEME.mainText : CHAT_THEME.secondaryText, fontWeight: hasUnread ? '900' : '600' }} className="text-[11px] leading-4" numberOfLines={1}>
                        {item.latest_message?.text ?? 'Patient connection established.'}
                    </Text>

                    <View className="flex-row items-center mt-2">
                        <View style={{ backgroundColor: CHAT_THEME.lightTealCard, borderColor: CHAT_THEME.borderTeal, borderWidth: 1 }} className="px-2.5 py-0.5 rounded-full flex-row items-center">
                            <MaterialCommunityIcons name="message-text-outline" size={9} color={CHAT_THEME.secondaryTeal} />
                            <Text style={{ color: CHAT_THEME.secondaryTeal }} className="text-[7.5px] font-black uppercase tracking-wider ml-1">Chat</Text>
                        </View>
                        <Text style={{ color: CHAT_THEME.secondaryText }} className="text-[7.5px] font-black uppercase tracking-widest ml-2" numberOfLines={1}>
                            {formattedTime}
                        </Text>
                    </View>
                </View>
            </View>
        </TouchableOpacity>
    );
});
ChatThreadCard.displayName = 'ChatThreadCard';

export default function SellerInboxScreen() {
    const router = useRouter();
    const isFocused = useIsFocused();

    const { user, token } = useSelector((state: RootState) => state.user);
    const dispatch = useDispatch<AppDispatch>();
    const [threads, setThreads] = useState<ChatThread[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    const BASE_URL = Constants.expoConfig?.extra?.BASE_URL;

    // ✅ FETCH FUNCTION (Typed)
    const fetchInbox = useCallback(async (showLoading = true): Promise<void> => {
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
            setError(null);
        } catch (err: any) {
            console.error("Inbox error:", err?.response?.data || err.message);
            setError("Could not reconnect to the communication relay.");
        } finally {
            setLoading(false);
        }
    }, [BASE_URL, token, user]);

    // ✅ GET TOKEN
    useEffect(() => {
        if (!token || !user) {
            dispatch(fetchUserProfile());
        }
    }, [dispatch, token, user]);

    useEffect(() => {
        if (token && user) fetchInbox();
    }, [token, user, fetchInbox]);

    useEffect(() => {
        if (!isFocused || !token || !user) return;

        fetchInbox(false);
        const liveSync = setInterval(() => {
            fetchInbox(false);
        }, 1500);

        return () => clearInterval(liveSync);
    }, [isFocused, token, user, fetchInbox]);

    useEffect(() => {
        if (!token || !user || !BASE_URL) return;

        let socket: WebSocket | null = null;
        let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
        let isMounted = true;

        const connectInboxSocket = () => {
            const socketUrl = `${BASE_URL.replace(/^http/, 'ws')}/ws/store-orders/?token=${token}`;
            socket = new WebSocket(socketUrl);

            socket.onmessage = (event) => {
                try {
                    const message = JSON.parse(event.data);
                    if (message.type !== 'fulfillment_update' || message.action !== 'new_chat_message') return;

                    const update = message.data;
                    fetchInbox(false);
                    Toast.show({
                        type: 'info',
                        text1: `New chat from ${update.sender_name || 'Customer'}`,
                        text2: update.text || 'New message received',
                        position: 'bottom',
                        visibilityTime: 3500,
                    });
                } catch (err) {
                    console.error('Store chat inbox WS parse error:', err);
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

    const renderItem = React.useCallback(({ item }: { item: ChatThread }) => {
        return <ChatThreadCard item={item} BASE_URL={BASE_URL} onPress={() => router.push({ pathname: "/chat/[id]", params: { id: String(item.id), sellerUnreadCount: String(item.unread_count || 0), userName: item.user_name } })} />;
    }, [BASE_URL, router]);

    const renderChatSkeleton = () => (
        <View className="px-4 pt-8">
            {[1, 2, 3, 4].map((item) => (
                <View key={item} style={{ backgroundColor: CHAT_THEME.whiteCard, borderColor: CHAT_THEME.borderTeal, borderWidth: 1 }} className="rounded-[1.5rem] mb-4 shadow-xl shadow-slate-200/40 p-4 flex-row items-center">
                    <View style={{ backgroundColor: CHAT_THEME.lightTealCard, borderColor: CHAT_THEME.borderTeal, borderWidth: 1 }} className="w-14 h-14 rounded-[1.15rem]" />
                    <View className="ml-4 flex-1">
                        <View style={{ backgroundColor: CHAT_THEME.borderTeal }} className="h-5 w-40 rounded-full mb-2.5 opacity-60" />
                        <View style={{ backgroundColor: CHAT_THEME.lightTealCard }} className="h-3 w-full rounded-full mb-3" />
                        <View style={{ backgroundColor: CHAT_THEME.lightTealCard }} className="h-3 w-24 rounded-full" />
                    </View>
                    <View style={{ backgroundColor: CHAT_THEME.background, borderColor: CHAT_THEME.borderTeal, borderWidth: 1 }} className="w-7 h-7 rounded-full" />
                </View>
            ))}
        </View>
    );

    return (
        <View style={{ flex: 1, backgroundColor: CHAT_THEME.background }}>
            <View className="overflow-hidden rounded-[1.45rem] shadow-sm shadow-slate-300">
                <View className="px-4 pt-2">

                    <LinearGradient
                        colors={[CHAT_THEME.primaryNavy, CHAT_THEME.secondaryTeal]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        className="relative min-h-[150px] overflow-hidden rounded-[1.45rem] px-4 py-4"
                    >
                        {/* Background Image */}
                        <View className="absolute -right-5 -bottom-6 h-[190px] w-[250px] items-center justify-center">
                            <Image
                                source={require('../../assets/images/chat.png')}
                                className="h-full w-full"
                                resizeMode="contain"
                            />
                        </View>

                        {/* Refresh Button */}
                        <TouchableOpacity
                            onPress={() => fetchInbox()}
                            className="absolute right-4 top-4 h-12 w-12 items-center justify-center rounded-full bg-white/12"
                        >
                            <MaterialCommunityIcons
                                name="refresh"
                                size={27}
                                color="#ffffff"
                            />
                        </TouchableOpacity>

                        <View className="w-[66%]">
                            {/* Heading */}
                            <View className="flex-row items-center">
                                <Text className="text-[31px] font-black tracking-[1.2px] text-white">
                                    CHAT
                                </Text>

                                <View style={{ backgroundColor: CHAT_THEME.borderTeal }} className="mx-2.5 h-9 w-[1.5px] opacity-70" />

                                <View>
                                    <Text style={{ color: CHAT_THEME.lightTealCard }} className="text-[11px] font-black uppercase tracking-[1.5px]">
                                        Patient
                                    </Text>
                                    <Text className="text-[15px] font-black uppercase tracking-[1px] text-white">
                                        Messages
                                    </Text>
                                </View>
                            </View>

                            {/* Subtitle */}
                            <Text className="mt-2 text-[13px] font-bold text-white/85">
                                {threads.length} Active communication threads
                            </Text>

                            {/* Buttons */}
                            <View className="mt-6 flex-row gap-2">
                                <View style={{ backgroundColor: CHAT_THEME.whiteCard }} className="flex-row items-center rounded-2xl px-3 py-2.5 shadow-sm shadow-black/10">
                                    <MaterialCommunityIcons
                                        name="chat-processing-outline"
                                        size={17}
                                        color={CHAT_THEME.secondaryTeal}
                                    />
                                    <Text style={{ color: CHAT_THEME.secondaryTeal }} className="ml-1.5 text-[10px] font-black">
                                        {threads.length} Chats
                                    </Text>
                                </View>
                            </View>
                        </View>
                    </LinearGradient>
                </View>
            </View>

            {loading && threads.length === 0 ? (
                renderChatSkeleton()
            ) : (
                <FlatList
                    data={threads}
                    keyExtractor={(item) => item.id.toString()}
                    contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 32, paddingBottom: 150 }}
                    showsVerticalScrollIndicator={false}
                    // 📊 Production Tuning
                    initialNumToRender={10}
                    maxToRenderPerBatch={10}
                    windowSize={21}
                    removeClippedSubviews={false}
                    ListEmptyComponent={() => (
                        <View className="mt-40 items-center px-10">
                            {error ? (
                                <>
                                    <View style={{ backgroundColor: '#FEF2F2', borderColor: '#FCA5A5' }} className="w-24 h-24 rounded-[3rem] items-center justify-center mb-6 border">
                                        <MaterialCommunityIcons name="alert-circle-outline" size={40} color={CHAT_THEME.errorRed} />
                                    </View>
                                    <Text style={{ color: CHAT_THEME.mainText }} className="font-black text-xl tracking-tighter mb-2 uppercase">Sync Failed</Text>
                                    <Text style={{ color: CHAT_THEME.errorRed }} className="font-bold text-xs text-center leading-5 px-6 mb-4">{error}</Text>
                                    <TouchableOpacity onPress={() => fetchInbox()} style={{ backgroundColor: CHAT_THEME.primaryNavy }} className="px-6 py-3 rounded-2xl shadow-lg active:opacity-90">
                                        <Text style={{ color: CHAT_THEME.lightTealCard }} className="font-black text-xs uppercase tracking-widest">Retry Connection</Text>
                                    </TouchableOpacity>
                                </>
                            ) : (
                                <>
                                    <View style={{ backgroundColor: CHAT_THEME.lightTealCard, borderColor: CHAT_THEME.borderTeal }} className="w-24 h-24 rounded-[3rem] items-center justify-center mb-6 border">
                                        <MaterialCommunityIcons name="forum-outline" size={40} color={CHAT_THEME.secondaryTeal} />
                                    </View>
                                    <Text style={{ color: CHAT_THEME.mainText }} className="font-black text-xl tracking-tight mb-2 uppercase">No Chats</Text>
                                    <Text style={{ color: CHAT_THEME.secondaryText }} className="font-bold text-xs text-center leading-5 px-6">Patient conversations will appear here after a chat starts.</Text>
                                </>
                            )}
                        </View>
                    )}
                    renderItem={renderItem}
                />
            )}
            <Toast />
        </View>
    );
}
