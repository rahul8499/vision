import { LocalizedText as Text, LocalizedTextInput as TextInput } from '@/components/Language/LocalizedPrimitives';
import React, { useEffect, useRef, useState, useCallback, memo } from 'react';
import {
  View,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
  Modal,
  Pressable,
  Alert,
  AppState,
  AppStateStatus,
  DeviceEventEmitter
} from 'react-native';

import { useLocalSearchParams, useRouter } from 'expo-router';
import { useIsFocused } from '@react-navigation/native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import axios from 'axios';
import Constants from 'expo-constants';
import { LinearGradient } from 'expo-linear-gradient';
import * as SecureStore from 'expo-secure-store';
import { Audio } from 'expo-av';
import * as ImagePicker from 'expo-image-picker';
import { AudioMessage } from '../../components/AudioMessage';
import { Image } from 'expo-image'; // Better image performance
import { BlurView } from 'expo-blur';
import { uploadFileToS3 } from '../../utils/s3Upload';

type Message = {
    id: number;
    text: string;
    audio?: string | null;
    image?: string | null;
    video?: string | null;
    sender_type: 'user' | 'store';
    created_at: string;
    is_read: boolean;
    is_edited?: boolean;
    is_deleted_for_everyone?: boolean;
    deleted_by_user?: boolean;
    deleted_by_store?: boolean;
    reply_to?: number | null;
    reply_to_text?: string | null;
};

// 📦 MEMOIZED MESSAGE COMPONENT
const MessageBubble = memo(({
    item,
    isMyMessage,
    onLongPress,
    onImagePress,
    BASE_URL
}: {
    item: Message,
    isMyMessage: boolean,
    onLongPress: () => void,
    onImagePress: (uri: string) => void,
    BASE_URL: string
}) => {
    const isDeleted = item.is_deleted_for_everyone;

    return (
        <View style={{
            width: '100%',
            flexDirection: 'row',
            justifyContent: isMyMessage ? 'flex-end' : 'flex-start',
            marginBottom: 4,
            paddingHorizontal: 4
        }}>
            <TouchableOpacity
                activeOpacity={0.9}
                onLongPress={onLongPress}
                style={{
                    maxWidth: '85%',
                    backgroundColor: isMyMessage ? '#ecfdf5' : '#FFFFFF',
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                    borderRadius: 18,
                    borderTopRightRadius: isMyMessage ? 6 : 18,
                    borderTopLeftRadius: isMyMessage ? 18 : 6,
                    borderWidth: 1,
                    borderColor: isMyMessage ? '#bbf7d0' : '#e2e8f0',
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: 0.06,
                    shadowRadius: 6,
                    elevation: 2,
                }}
            >
                {/* REPLY CONTEXT */}
                {item.reply_to_text && !isDeleted && (
                    <View style={{
                        backgroundColor: isMyMessage ? '#d1fae5' : '#f8fafc',
                        borderLeftWidth: 4,
                        borderLeftColor: '#059669',
                        padding: 6,
                        borderRadius: 10,
                        marginBottom: 4,
                        marginTop: 2
                    }}>
                        <Text style={{ fontSize: 12, color: '#059669', fontWeight: 'bold' }}>
                            {item.reply_to === item.id ? 'Self' : 'Reply'}
                        </Text>
                        <Text style={{ fontSize: 13, color: '#667781' }} numberOfLines={1}>
                            {item.reply_to_text}
                        </Text>
                    </View>
                )}

                {item.image && !isDeleted && (
                    <TouchableOpacity
                        onPress={() => onImagePress(item.image!.startsWith('http') ? item.image! : `${BASE_URL}${item.image}`)}
                        style={{ borderRadius: 8, overflow: 'hidden', marginBottom: 4, marginTop: 2 }}
                    >
                        <Image
                            source={{ uri: item.image!.startsWith('http') ? item.image! : `${BASE_URL}${item.image}` }}
                            style={{ width: 240, height: 240 }}
                            contentFit="cover"
                        />
                    </TouchableOpacity>
                )}

                {item.audio && !isDeleted && (
                    <View style={{ paddingVertical: 4 }}>
                        <AudioMessage uri={item.audio!.startsWith('http') ? item.audio! : `${BASE_URL}${item.audio}`} />
                    </View>
                )}

                {isDeleted ? (
                    <Text style={{ color: '#667781', fontStyle: 'italic', fontSize: 14, paddingVertical: 4 }}>
                        <MaterialCommunityIcons name="cancel" size={14} /> This message was deleted
                    </Text>
                ) : (
                    item.text ? (
                        <Text style={{ color: '#0f172a', fontSize: 15, lineHeight: 20, marginBottom: 4, marginTop: 2, fontWeight: '500' }}>
                            {item.text}
                        </Text>
                    ) : null
                )}

                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end' }}>
                    <Text style={{ fontSize: 11, color: '#64748b', marginRight: 4, fontWeight: '600' }}>
                        {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                    {isMyMessage && (
                        <Ionicons
                            name={item.is_read ? "checkmark-done" : "checkmark"}
                            size={16}
                            color={item.is_read ? '#059669' : '#94A3B8'}
                            style={{ marginLeft: 2 }}
                        />
                    )}
                </View>
            </TouchableOpacity>
        </View>
    );
}, (prev, next) => {
    return prev.item.id === next.item.id &&
        prev.item.is_read === next.item.is_read &&
        prev.item.text === next.item.text &&
        prev.item.is_deleted_for_everyone === next.item.is_deleted_for_everyone &&
        prev.item.deleted_by_user === next.item.deleted_by_user &&
        prev.item.deleted_by_store === next.item.deleted_by_store;
});

type Params = {
    id?: string;
    storeName?: string;
};

export default function ChatRoomScreen() {
    const router = useRouter();
    const isFocused = useIsFocused();
    const params = useLocalSearchParams<any>();

    const [threadId, setThreadId] = useState<string>(params.id ?? '');
    const storeName = params.storeName ?? 'Pharmacy';

    const BASE_URL = Constants.expoConfig?.extra?.BASE_URL ?? '';
    const WS_URL = BASE_URL.replace(/^http/, 'ws');

    const [token, setToken] = useState<string | null>(null);
    const [userType, setUserType] = useState<'user' | 'store'>('user');
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(true);
    const [isChatLocked, setIsChatLocked] = useState(false);
    const [orderStatus, setOrderStatus] = useState<string | null>(null);

    // Advanced Features State
    const [otherStatus, setOtherStatus] = useState({ is_online: false, last_seen: null as string | null });
    const [editingMessage, setEditingMessage] = useState<Message | null>(null);
    const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
    const [isOtherTyping, setIsOtherTyping] = useState(false);
    const [replyingTo, setReplyingTo] = useState<Message | null>(null);
    const [mediaLoading, setMediaLoading] = useState(false);
    const [viewingImage, setViewingImage] = useState<string | null>(null);
    const [nextPageUrl, setNextPageUrl] = useState<string | null>(null);
    const [loadingMore, setLoadingMore] = useState(false);
    const [prescriptionContext, setPrescriptionContext] = useState<{ id: number; image: string } | null>(null);

    const [isRecording, setIsRecording] = useState(false);
    const [recordDuration, setRecordDuration] = useState(0);
    const [previewUri, setPreviewUri] = useState<string | null>(null);

    const recordingRef = useRef<Audio.Recording | null>(null);
    const isBusyRef = useRef(false);
    const recordTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const ws = useRef<WebSocket | null>(null);
    const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const intentionalSocketCloseRef = useRef(false);
    const flatListRef = useRef<FlatList>(null);
    const userTypeRef = useRef(userType);
    const isFocusedRef = useRef(isFocused);
    const appStateRef = useRef<AppStateStatus>(AppState.currentState);
    const lastReadByOtherRef = useRef<number>(0);
    const sellerInitialUnreadRef = useRef(Math.max(0, Number(params.sellerUnreadCount) || 0));
    const sellerInitialUnreadClearedRef = useRef(false);

    useEffect(() => {
        userTypeRef.current = userType;
    }, [userType]);

    useEffect(() => {
        isFocusedRef.current = isFocused;
    }, [isFocused]);

    // 🔐 LOAD TOKEN
    useEffect(() => {
        const loadToken = async () => {
            const t = await SecureStore.getItemAsync('authToken');
            const storedUserType = await SecureStore.getItemAsync('userType');
            setToken(t);
            if (storedUserType === 'store' || storedUserType === 'seller') {
                setUserType('store');
            } else {
                setUserType('user');
            }
        };
        loadToken();

        return () => {
            if (recordTimerRef.current) clearInterval(recordTimerRef.current);
        };
    }, []);

    // 📱 WebSocket Manager & Reconnection Logic
    const markRead = useCallback((newlyReceivedCount = 0) => {
        if (!isFocusedRef.current || appStateRef.current !== 'active') return;
        if (ws.current?.readyState === WebSocket.OPEN) {
            ws.current.send(JSON.stringify({ action: 'mark_read' }));
            if (userTypeRef.current === 'store') {
                const decrement = sellerInitialUnreadClearedRef.current
                    ? newlyReceivedCount
                    : sellerInitialUnreadRef.current;
                sellerInitialUnreadClearedRef.current = true;
                if (decrement > 0) {
                    DeviceEventEmitter.emit('seller-chat-read', decrement);
                }
            }
        }
    }, []);

    const onMessageReceived = useCallback((data: any) => {
        console.log("WebSocket Message Received:", data);

        if (data.action === 'user_status') {
            if (data.user_type !== userTypeRef.current) {
                setOtherStatus({
                    is_online: data.is_online,
                    last_seen: data.last_seen
                });
            }
            return;
        }

        if (data.action === 'typing') {
            if (data.user_type !== userTypeRef.current) {
                setIsOtherTyping(data.is_typing);
            }
            return;
        }

        if (data.action === 'message_update') {
            const updatedMsg: Message = data.message;
            setMessages((prev) =>
                prev.map(m => m.id === updatedMsg.id ? updatedMsg : m)
            );
            return;
        }

        if (data.action === 'messages_read') {
            if (data.reader_type !== userTypeRef.current) {
                lastReadByOtherRef.current = Date.now();
                setTimeout(() => {
                    setMessages((prev) =>
                        prev.map((msg) =>
                            msg.sender_type === userTypeRef.current ? { ...msg, is_read: true } : msg
                        )
                    );
                }, 500);
            }
            return;
        }

        // Standard message receiving
        setMessages((prev) => {
            if (data.id && prev.some(m => m.id === data.id)) return prev;
            return [data, ...prev];
        });

        if (data.sender_type !== userTypeRef.current) {
            markRead(1);
        }
    }, [markRead]);

    const connectWebSocket = useCallback(() => {
        if (!threadId || threadId === '0' || !token || !BASE_URL) return;
        if (!isFocusedRef.current || appStateRef.current !== 'active') return;
        if (ws.current && (ws.current.readyState === WebSocket.OPEN || ws.current.readyState === WebSocket.CONNECTING)) return;

        console.log("Connecting to WebSocket...");
        intentionalSocketCloseRef.current = false;
        const socket = new WebSocket(`${WS_URL}/ws/chat/${threadId}/?token=${token}`);

        socket.onopen = () => {
            console.log("WebSocket Connected");
            markRead();
        };

        socket.onmessage = (e) => {
            const data = JSON.parse(e.data);
            onMessageReceived(data);
        };

        socket.onerror = (e) => console.log("WebSocket Error:", e);
        socket.onclose = (event) => {
            console.log("WebSocket Disconnected", {
                code: event.code,
                reason: event.reason,
                clean: event.wasClean
            });
            if (ws.current !== socket) return;
            ws.current = null;
            if (
                !intentionalSocketCloseRef.current
                && isFocusedRef.current
                && appStateRef.current === 'active'
            ) {
                if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
                reconnectTimerRef.current = setTimeout(() => {
                    reconnectTimerRef.current = null;
                    connectWebSocket();
                }, 1500);
            }
        };

        ws.current = socket;
    }, [threadId, token, BASE_URL, WS_URL, markRead, onMessageReceived]);

    // Handle AppState changes (production robustness)
    useEffect(() => {
        const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
            appStateRef.current = nextAppState;
            if (nextAppState === 'active' && isFocusedRef.current) {
                connectWebSocket();
            } else if (nextAppState !== 'active') {
                intentionalSocketCloseRef.current = true;
                if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
                reconnectTimerRef.current = null;
                ws.current?.close();
                ws.current = null;
            }
        });
        return () => subscription.remove();
    }, [connectWebSocket]);

    useEffect(() => {
        isFocusedRef.current = isFocused;
        if (isFocused) {
            intentionalSocketCloseRef.current = false;
            connectWebSocket();
            markRead();
        } else {
            intentionalSocketCloseRef.current = true;
            if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
            reconnectTimerRef.current = null;
            ws.current?.close();
            ws.current = null;
        }
        return () => {
            intentionalSocketCloseRef.current = true;
            if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
            reconnectTimerRef.current = null;
            ws.current?.close();
            ws.current = null;
        };
    }, [isFocused, connectWebSocket, markRead]);

    // 📅 Resolution + Initial Load + WS Initialization
    useEffect(() => {
        if (!token || !BASE_URL) return;

        const handleInitialization = async () => {
            let currentId = threadId;

            // Phase 1: Silent Resolution for '0' ID
            if (currentId === '0') {
                // ⚡ OPTIMIST LOAD: If we have context in params, show it instantly
                if (params.prescription_id) {
                    setPrescriptionContext({
                        id: parseInt(params.prescription_id as string),
                        image: params.prescription_image
                            ? (params.prescription_image.startsWith('http') ? params.prescription_image : `${BASE_URL}${params.prescription_image}`)
                            : ''
                    });
                    setLoading(false);
                }

                const resolvedId = await initiateLazyThread();
                if (resolvedId) {
                    currentId = resolvedId;
                    // Note: setThreadId was called inside initiateLazyThread
                } else {
                    setLoading(false);
                    return;
                }
            }

            // Phase 2: Fetch History
            // Only show spinner if we don't have messages yet or it's an existing thread
            if (currentId !== '0' && messages.length === 0) setLoading(true);

            try {
                const res = await axios.get(`${BASE_URL}/api/chat/${currentId}/messages/`, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                setMessages(res.data.results);
                setNextPageUrl(res.data.next);
                if (res.data.other_online !== undefined) {
                    setOtherStatus({
                        is_online: res.data.other_online,
                        last_seen: res.data.other_last_seen
                    });
                }
                if (res.data.is_chat_locked !== undefined) {
                    setIsChatLocked(res.data.is_chat_locked);
                    setOrderStatus(res.data.order_status);
                }
                if (res.data.prescription_id) {
                    setPrescriptionContext({
                        id: res.data.prescription_id,
                        image: res.data.prescription_image.startsWith('http')
                            ? res.data.prescription_image
                            : `${BASE_URL}${res.data.prescription_image}`
                    });
                }
            } catch (err) {
                console.log("History load error:", err);
            } finally {
                setLoading(false);
            }

            // Phase 3: Connect WebSocket
            connectWebSocket();
        };

        handleInitialization();

        // Socket ownership belongs to the focus/AppState lifecycle above.
        // Closing it here races with the parallel connection effect.
    }, [token, threadId, BASE_URL, connectWebSocket]);

    // 🚀 LAZY THREAD INITIATOR
    const initiateLazyThread = async (messageText?: string) => {
        if (!token || !BASE_URL) return null;
        try {
            const payload = {
                store_id: params.store_id,
                user_id: params.user_id,
                prescription_id: params.prescription_id,
                text: messageText
            };
            const res = await axios.post(`${BASE_URL}/api/chat/init/`, payload, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (!res.data.id) return null;

            const newId = res.data.id.toString();
            setThreadId(newId);

            // Critical: Update the URL so 'Back' works correctly
            router.replace({
                pathname: '/chat/[id]',
                params: { id: newId, storeName }
            } as any);

            return newId;
        } catch (err) {
            console.error("Lazy Init Error:", err);
            Alert.alert("Error", "Could not start chat session.");
            return null;
        }
    };

    // 📩 SEND MESSAGE
    const sendMessage = async () => {
        if (!input.trim()) return;

        if (threadId === '0') {
            const newId = await initiateLazyThread(input);
            if (!newId) return;
            // Success! Thread created. WS will connect in useEffect.
            setInput('');
            return;
        }

        if (editingMessage) {
            ws.current?.send(JSON.stringify({
                action: 'edit_message',
                message_id: editingMessage.id,
                text: input
            }));
            setEditingMessage(null);
        } else {
            ws.current?.send(JSON.stringify({
                message: input,
                reply_to_id: replyingTo?.id
            }));
            setReplyingTo(null);
        }
        setInput('');
        handleTyping(false);
    };

    const isTypingSentRef = useRef(false);

    const handleTyping = (isTyping: boolean) => {
        if (isTyping) {
            if (!isTypingSentRef.current) {
                ws.current?.send(JSON.stringify({ action: 'typing', is_typing: true }));
                isTypingSentRef.current = true;
            }
            if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
            typingTimeoutRef.current = setTimeout(() => {
                ws.current?.send(JSON.stringify({ action: 'typing', is_typing: false }));
                isTypingSentRef.current = false;
            }, 3000);
        } else {
            if (isTypingSentRef.current) {
                ws.current?.send(JSON.stringify({ action: 'typing', is_typing: false }));
                isTypingSentRef.current = false;
            }
            if (typingTimeoutRef.current) {
                clearTimeout(typingTimeoutRef.current);
                typingTimeoutRef.current = null;
            }
        }
    };

    const pickMedia = async (type: 'image' | 'video') => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: type === 'image' ? ['images'] : ['videos'],
            allowsEditing: true,
            quality: 0.7,
        });

        if (!result.canceled) {
            const asset = result.assets[0];
            uploadMedia(
                asset.uri,
                type,
                asset.mimeType || (type === 'image' ? 'image/jpeg' : 'video/mp4'),
                asset.fileName || `media_${Date.now()}.${type === 'image' ? 'jpg' : 'mp4'}`
            );
        }
    };

    const takePhoto = async () => {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
            alert("Camera permission is required to take photos.");
            return;
        }

        const result = await ImagePicker.launchCameraAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            quality: 0.7,
        });

        if (!result.canceled) {
            const asset = result.assets[0];
            uploadMedia(
                asset.uri,
                'image',
                asset.mimeType || 'image/jpeg',
                asset.fileName || `photo_${Date.now()}.jpg`
            );
        }
    };

    // const uploadMedia = async (uri: string, type: 'image' | 'video') => {
    //     if (!token || !threadId) return;
    //     setMediaLoading(true);
    //     let formData = new FormData();
    //     const platformUri = Platform.OS === 'android' && !uri.startsWith('file://') ? `file://${uri}` : uri;

    //     formData.append(type, {
    //         uri: platformUri,
    //         name: `media_${Date.now()}.${type === 'image' ? 'jpg' : 'mp4'}`,
    //         type: type === 'image' ? 'image/jpeg' : 'video/mp4'
    //     } as any);

    //     if (replyingTo) {
    //         formData.append('reply_to_threadId', replyingTo.threadId.toString());
    //         setReplyingTo(null);
    //     }

    //     try {
    //         console.log("BASE_URL", BASE_URL);
    //         const response = await fetch(`${BASE_URL}/api/chat/${threadId}/upload-media/`, {
    //             method: 'POST',
    //             headers: { 'Authorization': `Bearer ${token}` },
    //             body: formData,
    //         });
    //         if (!response.ok) throw new Error('Upload failed');
    //     } catch (error) {
    //         console.error("Media upload error:", error);
    //     } finally {
    //         setMediaLoading(false);
    //     }
    const uploadMedia = async (uri: string, type: 'image' | 'video', mimeType: string, fileName: string) => {
        if (!token || !threadId) return;
        if (mediaLoading) return;

        try {
            setMediaLoading(true);

            // 💡 Robust URI handling for AndrothreadId
            const platformUri = Platform.OS === 'android'
                ? (uri.startsWith('file://') || uri.startsWith('content://') ? uri : `file://${uri}`)
                : uri;

            const formData = new FormData();
            const mediaKey = await uploadFileToS3(
                { uri: platformUri, name: fileName.replace(/\s/g, '_'), type: mimeType },
                type === 'image' ? 'chat_images' : 'chat_videos',
                token,
            );
            formData.append(type === 'image' ? 'image_key' : 'video_key', mediaKey);

            if (replyingTo) {
                formData.append('reply_to_id', replyingTo.id.toString());
                setReplyingTo(null);
            }

            console.log("DEBUG - Starting Fetch Upload");
            const response = await fetch(`${BASE_URL}/api/chat/${threadId}/upload-media/`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    // Browser/Fetch automatically sets Content-Type for FormData
                },
                body: formData,
            });

            console.log("DEBUG - Fetch Status:", response.status);

            if (response.ok) {
                const responseData: Message = await response.json();
                console.log("DEBUG - Upload Success");

                // Manually add to message list so uploader sees it immediately
                setMessages(prev => {
                    if (prev.some(m => m.id === responseData.id)) return prev;
                    return [responseData, ...prev];
                });

                // Scroll to bottom
                setTimeout(() => flatListRef.current?.scrollToOffset({ offset: 0, animated: true }), 100);
            } else {
                const errorText = await response.text();
                console.log("DEBUG - Upload Failed:", errorText);
                Alert.alert("Upload Failed", `Server error (${response.status}). Please try again.`);
            }

        } catch (err: any) {
            console.log("UPLOAD ERROR (fetch):", err.message || err);
            Alert.alert("Upload Error", "Network error or server unreachable. Please check your connection.");
        } finally {
            setMediaLoading(false);
        }
    };
    const deleteMessage = (msgId: number, type: 'everyone' | 'me') => {
        ws.current?.send(JSON.stringify({
            action: 'delete_message',
            message_id: msgId,
            delete_type: type
        }));
        if (type === 'me') {
            // Locally remove or hthreadIde if it's "delete for me" to avoid waiting for broadcast
            setMessages(prev => prev.map(m => m.id === msgId ?
                { ...m, [userType === 'user' ? 'deleted_by_user' : 'deleted_by_store']: true } : m
            ));
        }
        setSelectedMessage(null);
    };

    const isWithin30Mins = (createdAt: string) => {
        const created = new Date(createdAt).getTime();
        const now = new Date().getTime();
        return (now - created) < 30 * 60 * 1000;
    };

    const handleEdit = (msg: Message) => {
        setEditingMessage(msg);
        setInput(msg.text);
        setSelectedMessage(null);
    };

    const loadMoreMessages = async () => {
        if (!nextPageUrl || loadingMore) return;

        setLoadingMore(true);
        try {
            const response = await axios.get(nextPageUrl, {
                headers: { Authorization: `Bearer ${token}` },
            });

            setMessages(prev => [...prev, ...response.data.results]);
            setNextPageUrl(response.data.next);
        } catch (error) {
            console.error("Error loading more messages:", error);
        } finally {
            setLoadingMore(false);
        }
    };

    const uploadAudio = async (uri: string) => {
        if (!token || !threadId) return;
        let formData = new FormData();

        const platformUri = Platform.OS === 'android' && !uri.startsWith('file://') ? `file://${uri}` : uri;

        try {
            const audioKey = await uploadFileToS3(
                { uri: platformUri, name: 'voicenote.m4a', type: 'audio/mp4' },
                'chat_audio',
                token,
            );
            formData.append('audio_key', audioKey);
            const response = await fetch(`${BASE_URL}/api/chat/${threadId}/upload-audio/`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                    // DO NOT manually set Content-Type header on fetch with FormData!
                },
                body: formData,
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Upload Failed: ${response.status} ${errorText}`);
            }
        } catch (error) {
            console.error("Audio upload error:", error);
        }
    };

    // 🎤 START RECORDING
    const startRecording = async () => {
        if (isBusyRef.current || recordingRef.current) return;
        isBusyRef.current = true;

        try {
            const perm = await Audio.requestPermissionsAsync();
            if (perm.status !== 'granted') return;

            await Audio.setAudioModeAsync({
                allowsRecordingIOS: true,
                playsInSilentModeIOS: true,
            });

            const { recording } = await Audio.Recording.createAsync(
                Audio.RecordingOptionsPresets.HIGH_QUALITY
            );

            recordingRef.current = recording;
            setIsRecording(true);
            setRecordDuration(0);

            recordTimerRef.current = setInterval(() => {
                setRecordDuration(prev => prev + 1);
            }, 1000);

        } catch (err) {
            console.log('Start error:', err);
        } finally {
            isBusyRef.current = false;
        }
    };

    // 🛑 STOP RECORDING FOR PREVIEW
    const stopRecordingForPreview = async () => {
        if (isBusyRef.current || !recordingRef.current) return;
        isBusyRef.current = true;

        try {
            setIsRecording(false);
            if (recordTimerRef.current) {
                clearInterval(recordTimerRef.current);
                recordTimerRef.current = null;
            }

            const recording = recordingRef.current;
            recordingRef.current = null;

            await recording.stopAndUnloadAsync();

            const uri = recording.getURI();
            const status = await recording.getStatusAsync();

            if (!uri || !status.durationMillis || status.durationMillis < 400) {
                return;
            }
            // Transition to preview
            setPreviewUri(uri);
        } catch (err) {
            console.log('Stop error:', err);
        } finally {
            isBusyRef.current = false;
        }
    };

    // 🗑️ DISCARD RECORDING
    const discardRecording = async () => {
        if (isRecording) {
            setIsRecording(false);
            if (recordTimerRef.current) clearInterval(recordTimerRef.current);
            if (recordingRef.current) {
                try { await recordingRef.current.stopAndUnloadAsync(); } catch (e) { }
                recordingRef.current = null;
            }
        }
        setPreviewUri(null);
        setRecordDuration(0);
    };

    // 🚀 SEND PREVIEW AUDIO
    const sendPreviewAudio = async () => {
        if (previewUri) {
            await uploadAudio(previewUri);
            setPreviewUri(null);
            setRecordDuration(0);
        }
    };

    const formatRecordTime = (seconds: number) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}:${s < 10 ? '0' : ''}${s}`;
    };

    const formatTime = (isoString?: string) => {
        if (!isoString) return '';
        return new Date(isoString).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const renderMessage = useCallback(({ item }: { item: Message }) => {
        const isMyMessage = item.sender_type === userType;
        const isDeletedForMe = userType === 'user' ? item.deleted_by_user : item.deleted_by_store;

        if (isDeletedForMe) return null;

        return (
            <MessageBubble
                item={item}
                isMyMessage={isMyMessage}
                onLongPress={() => setSelectedMessage(item)}
                onImagePress={setViewingImage}
                BASE_URL={BASE_URL}
            />
        );
    }, [userType, BASE_URL]);

    if (!threadId) return null;

    return (
        <>
            <SafeAreaView style={{ flex: 1, backgroundColor: '#0f172a' }}>
                <StatusBar barStyle="light-content" backgroundColor="#0f172a" translucent={true} />

                {/* HEADER */}
                <View style={{ zIndex: 50, overflow: 'hidden' }}>
                    <LinearGradient
                        colors={['#0f172a', '#1e293b', '#064e3b']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            paddingHorizontal: 14,
                            paddingBottom: 14,
                            paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) + 12 : 10,
                            borderBottomLeftRadius: 26,
                            borderBottomRightRadius: 26,
                        }}
                    >
                        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                            <TouchableOpacity onPress={() => router.back()} style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.10)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)', alignItems: 'center', justifyContent: 'center' }}>
                                <Ionicons name="arrow-back" size={22} color="#ffffff" />
                            </TouchableOpacity>
                            <View style={{ width: 42, height: 42, borderRadius: 16, backgroundColor: 'rgba(16,185,129,0.14)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center', marginLeft: 10, overflow: 'hidden' }}>
                                <MaterialCommunityIcons name={userType === 'user' ? 'storefront-outline' : 'account-outline'} size={22} color="#34d399" />
                                <View style={{ position: 'absolute', right: -1, bottom: -1, width: 12, height: 12, borderRadius: 6, backgroundColor: otherStatus.is_online ? '#34d399' : '#94a3b8', borderWidth: 2, borderColor: '#0f172a' }} />
                            </View>

                            <View style={{ marginLeft: 12, flex: 1, justifyContent: 'center' }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                    <Text style={{ color: 'white', fontWeight: '900', fontSize: 16, letterSpacing: 0.2 }} numberOfLines={1}>
                                        {storeName}
                                    </Text>
                                    {isChatLocked && (
                                        <View style={{ backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10, marginLeft: 8 }}>
                                            <Text style={{ color: 'white', fontSize: 10, fontWeight: '800', textTransform: 'uppercase' }}>
                                                {orderStatus === 'completed' ? 'Completed' : 'Closed'}
                                            </Text>
                                        </View>
                                    )}
                                </View>
                                <Text style={{ color: isOtherTyping ? '#34d399' : 'rgba(255,255,255,0.62)', fontSize: 11, marginTop: 2, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1.2 }}>
                                    {isOtherTyping ? 'typing...' :
                                        isChatLocked ? 'Chat closed' :
                                            otherStatus.is_online ? 'online' :
                                                otherStatus.last_seen ? `Last seen ${formatTime(otherStatus.last_seen)}` : ''}
                                </Text>
                            </View>
                        </View>

                        <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 8 }}>
                            <TouchableOpacity style={{ marginLeft: 10, width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.10)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)', alignItems: 'center', justifyContent: 'center' }}>
                                <Ionicons name="call" size={18} color="#ffffff" />
                            </TouchableOpacity>
                            <TouchableOpacity style={{ marginLeft: 8, width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.10)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)', alignItems: 'center', justifyContent: 'center' }}>
                                <MaterialCommunityIcons name="dots-vertical" size={22} color="#ffffff" />
                            </TouchableOpacity>
                        </View>
                    </LinearGradient>
                </View>

                {/* CHAT AREA */}
                <KeyboardAvoidingView
                    style={{ flex: 1 }}
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
                >
                    <View style={{ flex: 1, backgroundColor: '#f1f5f9' }}>
                        {loading ? (
                            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                                <ActivityIndicator size="large" color="#059669" />
                                <Text style={{ color: '#059669', fontWeight: '900', fontSize: 10, marginTop: 16, textTransform: 'uppercase', letterSpacing: 3 }}>Loading messages...</Text>
                            </View>
                        ) : (
                            <View style={{ flex: 1 }}>
                                {/* 🏥 Prescription Context Bar */}
                                {prescriptionContext && (
                                    <View className="absolute top-0 left-0 right-0 z-40 px-4 pt-1">
                                        <BlurView intensity={80} tint={Platform.OS === 'ios' ? 'light' : 'default'} className="rounded-2xl border border-slate-200/50 shadow-lg overflow-hidden">
                                            <View className="flex-row items-center p-3">
                                                <TouchableOpacity
                                                    onPress={() => setViewingImage(prescriptionContext.image)}
                                                    className="w-12 h-12 rounded-xl bg-slate-100 border border-slate-200 overflow-hidden"
                                                >
                                                    <Image
                                                        source={{ uri: prescriptionContext.image }}
                                                        style={{ width: '100%', height: '100%' }}
                                                        contentFit="cover"
                                                    />
                                                </TouchableOpacity>
                                                <View className="ml-3 flex-1">
                                                    <Text className="text-slate-900 font-black text-xs uppercase tracking-widest">Enquiry #{prescriptionContext.id}</Text>
                                                    <Text className="text-slate-500 font-bold text-[10px] uppercase tracking-wider mt-0.5">Reference Prescription</Text>
                                                </View>
                                                <TouchableOpacity
                                                    onPress={() => setViewingImage(prescriptionContext.image)}
                                                    className="bg-slate-900 px-4 py-2 rounded-xl"
                                                >
                                                    <Text className="text-white font-bold text-[10px] uppercase tracking-widest">Preview</Text>
                                                </TouchableOpacity>
                                            </View>
                                        </BlurView>
                                    </View>
                                )}

                                <FlatList
                                    ref={flatListRef}
                                    data={messages}
                                    extraData={messages}
                                    inverted={true}
                                    keyExtractor={(item) => item.id.toString()}
                                    renderItem={renderMessage}
                                    contentContainerStyle={{
                                        paddingHorizontal: 8,
                                        paddingTop: prescriptionContext ? 100 : 16,
                                        paddingBottom: 16,
                                        flexGrow: 1,
                                        justifyContent: 'flex-end'
                                    }}
                                    showsVerticalScrollIndicator={false}
                                    onEndReached={loadMoreMessages}
                                    onEndReachedThreshold={0.5}
                                    removeClippedSubviews={Platform.OS === 'android'}
                                    initialNumToRender={15}
                                    maxToRenderPerBatch={10}
                                    windowSize={10}
                                    ListFooterComponent={loadingMore ? (
                                        <View style={{ paddingVertical: 20 }}>
                                            <ActivityIndicator size="small" color="#075E54" />
                                        </View>
                                    ) : null}
                                />
                            </View>
                        )}

                        {/* REPLY BAR */}
                        {replyingTo && (
                            <View style={{
                                backgroundColor: '#FFFFFF',
                                borderLeftWidth: 4,
                                borderLeftColor: '#059669',
                                padding: 10,
                                marginHorizontal: 12,
                                marginTop: 8,
                                borderRadius: 18,
                                flexDirection: 'row',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                borderWidth: 1,
                                borderColor: '#e2e8f0'
                            }}>
                                <View style={{ flex: 1 }}>
                                    <Text style={{ color: '#059669', fontWeight: '900', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1 }}>
                                        Replying to {replyingTo.sender_type === userType ? 'yourself' : storeName}
                                    </Text>
                                    <Text style={{ color: '#64748b', fontSize: 13, fontWeight: '600' }} numberOfLines={1}>
                                        {replyingTo.text || 'Media'}
                                    </Text>
                                </View>
                                <TouchableOpacity onPress={() => setReplyingTo(null)}>
                                    <Ionicons name="close-circle" size={24} color="#8696a0" />
                                </TouchableOpacity>
                            </View>
                        )}

                        {/* EDITING BAR */}
                        {editingMessage && (
                            <View style={{
                                backgroundColor: '#FFFFFF',
                                borderLeftWidth: 4,
                                borderLeftColor: '#059669',
                                padding: 10,
                                marginHorizontal: 12,
                                marginTop: 8,
                                borderRadius: 18,
                                flexDirection: 'row',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                borderWidth: 1,
                                borderColor: '#e2e8f0'
                            }}>
                                <View style={{ flex: 1 }}>
                                    <Text style={{ color: '#059669', fontWeight: '900', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1 }}>Edit message</Text>
                                    <Text style={{ color: '#64748b', fontSize: 13, fontWeight: '600' }} numberOfLines={1}>{editingMessage.text}</Text>
                                </View>
                                <TouchableOpacity onPress={() => { setEditingMessage(null); setInput(''); }}>
                                    <Ionicons name="close-circle" size={24} color="#8696a0" />
                                </TouchableOpacity>
                            </View>
                        )}

                        {/* INPUT AREA */}
                        {isChatLocked ? (
                            <View style={{
                                backgroundColor: '#f1f5f9',
                                paddingVertical: 16,
                                paddingHorizontal: 24,
                                alignItems: 'center',
                                borderTopWidth: 1,
                                borderColor: '#e2e8f0',
                                paddingBottom: Platform.OS === 'ios' ? 70 : 70,
                            }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                                    <Ionicons name="lock-closed" size={16} color="#64748b" style={{ marginRight: 6 }} />
                                    <Text style={{ fontSize: 13, fontWeight: '800', color: '#64748b', textTransform: 'uppercase', letterSpacing: 1 }}>
                                        {orderStatus === 'completed' ? 'COMPLETED' : 'CLOSED'}
                                    </Text>
                                </View>
                                <Text style={{ fontSize: 15, color: '#0f172a', fontWeight: '600', textAlign: 'center' }}>
                                    This chat is no longer active
                                </Text>
                                <Text style={{ fontSize: 13, color: '#64748b', marginTop: 4, textAlign: 'center' }}>
                                    {orderStatus === 'completed' ? 'Order has been successfully delivered' : 'This order was cancelled or rejected'}
                                </Text>
                            </View>
                        ) : (
                            <View style={{
                                flexDirection: 'row',
                                alignItems: 'flex-end',
                                paddingHorizontal: 8,
                                paddingVertical: 8,
                                paddingBottom: Platform.OS === 'ios' ? 20 : 35,
                                backgroundColor: '#f1f5f9'
                            }}>
                                {isRecording ? (
                                    <View style={{
                                        flex: 1,
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        backgroundColor: 'white',
                                        borderRadius: 24,
                                        paddingVertical: 6,
                                        paddingHorizontal: 16,
                                        marginRight: 8,
                                        minHeight: 44,
                                        justifyContent: 'space-between',
                                        borderWidth: 1,
                                        borderColor: '#e2e8f0'
                                    }}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#ef4444', marginRight: 8, opacity: recordDuration % 2 === 0 ? 1 : 0.5 }} />
                                            <Text style={{ fontSize: 16, color: '#ef4444', fontWeight: '500' }}>
                                                {formatRecordTime(recordDuration)}
                                            </Text>
                                        </View>
                                        <TouchableOpacity onPress={discardRecording}>
                                            <Text style={{ color: '#059669', fontSize: 15, fontWeight: '800' }}>Cancel</Text>
                                        </TouchableOpacity>
                                    </View>
                                ) : previewUri ? (
                                    <View style={{
                                        flex: 1,
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        backgroundColor: 'white',
                                        borderRadius: 24,
                                        paddingVertical: 6,
                                        paddingHorizontal: 8,
                                        marginRight: 8,
                                        minHeight: 44,
                                        borderWidth: 1,
                                        borderColor: '#e2e8f0'
                                    }}>
                                        <TouchableOpacity onPress={discardRecording} style={{ marginHorizontal: 8 }}>
                                            <Ionicons name="trash-outline" size={24} color="#ef4444" />
                                        </TouchableOpacity>
                                        <View style={{ flex: 1, alignItems: 'flex-start', paddingTop: 4 }}>
                                            <AudioMessage uri={previewUri} />
                                        </View>
                                    </View>
                                ) : (
                                    <View style={{
                                        flex: 1,
                                        flexDirection: 'row',
                                        alignItems: 'flex-end',
                                        backgroundColor: 'white',
                                        borderRadius: 24,
                                        paddingVertical: 6,
                                        paddingHorizontal: 8,
                                        marginRight: 8,
                                        minHeight: 44,
                                        borderWidth: 1,
                                        borderColor: '#e2e8f0',
                                        shadowColor: '#94a3b8',
                                        shadowOffset: { width: 0, height: 2 },
                                        shadowOpacity: 0.12,
                                        shadowRadius: 8,
                                        elevation: 3
                                    }}>
                                        <TouchableOpacity style={{ marginHorizontal: 8, marginBottom: 4, justifyContent: 'center' }}>
                                            <MaterialCommunityIcons name="emoticon-outline" size={24} color="#8696a0" />
                                        </TouchableOpacity>

                                        <TextInput
                                            style={{
                                                flex: 1,
                                                color: '#0f172a',
                                                fontSize: 16,
                                                fontWeight: '600',
                                                maxHeight: 100,
                                                paddingTop: 4,
                                                paddingBottom: 4
                                            }}
                                            value={input}
                                            onChangeText={(t) => {
                                                setInput(t);
                                                handleTyping(t.length > 0);
                                            }}
                                            placeholder="Message"
                                            placeholderTextColor="#94a3b8"
                                            multiline={true}
                                            onFocus={() => setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100)}
                                        />

                                        <TouchableOpacity
                                            onPress={() => pickMedia('image')}
                                            style={{ marginHorizontal: 8, marginBottom: 4, justifyContent: 'center' }}
                                        >
                                            <MaterialCommunityIcons name="paperclip" size={24} color="#8696a0" />
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            onPress={takePhoto}
                                            style={{ marginRight: 8, marginBottom: 4, justifyContent: 'center' }}
                                        >
                                            <Ionicons name="camera-outline" size={24} color="#8696a0" />
                                        </TouchableOpacity>
                                    </View>
                                )}

                                <TouchableOpacity
                                    activeOpacity={0.8}
                                    onPress={() => {
                                        if (previewUri) {
                                            sendPreviewAudio();
                                        } else if (isRecording) {
                                            stopRecordingForPreview();
                                        } else if (input.trim()) {
                                            sendMessage();
                                        } else {
                                            startRecording();
                                        }
                                    }}
                                    style={{
                                        width: 48,
                                        height: 48,
                                        borderRadius: 24,
                                        backgroundColor: isRecording ? '#ef4444' : '#0f172a',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        borderWidth: 1,
                                        borderColor: isRecording ? '#ef4444' : '#1e293b',
                                    }}
                                >
                                    <MaterialCommunityIcons
                                        name={previewUri || input.trim() ? "send" : (isRecording ? "stop" : "microphone")}
                                        size={previewUri || input.trim() ? 20 : 24}
                                        color="#ffffff"
                                        style={previewUri || input.trim() ? { marginLeft: 4 } : {}}
                                    />
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>
                </KeyboardAvoidingView>

                {/* ACTION MENU MODAL */}
                <Modal
                    transparent={true}
                    visible={!!selectedMessage}
                    animationType="fade"
                    onRequestClose={() => setSelectedMessage(null)}
                >
                    <Pressable
                        style={{ flex: 1, backgroundColor: 'rgba(15,23,42,0.62)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 }}
                        onPress={() => setSelectedMessage(null)}
                    >
                        <View style={{ backgroundColor: 'white', borderRadius: 28, width: '100%', maxWidth: 360, paddingVertical: 10, elevation: 12, overflow: 'hidden', borderWidth: 1, borderColor: '#e2e8f0' }}>
                            <LinearGradient
                                colors={['#0f172a', '#1e293b', '#064e3b']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={{ height: 6 }}
                            />
                            {!selectedMessage?.is_deleted_for_everyone && (
                                <TouchableOpacity
                                    style={{ paddingVertical: 14, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center' }}
                                    onPress={() => {
                                        setReplyingTo(selectedMessage);
                                        setSelectedMessage(null);
                                    }}
                                >
                                    <MaterialCommunityIcons name="reply" size={20} color="#059669" />
                                    <Text style={{ marginLeft: 16, fontSize: 15, color: '#0f172a', fontWeight: '800' }}>Reply</Text>
                                </TouchableOpacity>
                            )}

                            {selectedMessage?.sender_type === userType && !selectedMessage.audio && !selectedMessage.is_deleted_for_everyone && isWithin30Mins(selectedMessage.created_at) && (
                                <TouchableOpacity
                                    style={{ paddingVertical: 14, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center' }}
                                    onPress={() => handleEdit(selectedMessage)}
                                >
                                    <Ionicons name="pencil" size={20} color="#059669" />
                                    <Text style={{ marginLeft: 16, fontSize: 15, color: '#0f172a', fontWeight: '800' }}>Edit</Text>
                                </TouchableOpacity>
                            )}

                            {selectedMessage?.sender_type === userType && !selectedMessage.is_deleted_for_everyone && isWithin30Mins(selectedMessage.created_at) && (
                                <TouchableOpacity
                                    style={{ paddingVertical: 14, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center' }}
                                    onPress={() => deleteMessage(selectedMessage!.id, 'everyone')}
                                >
                                    <Ionicons name="trash" size={20} color="#ef4444" />
                                    <Text style={{ marginLeft: 16, fontSize: 15, color: '#ef4444', fontWeight: '800' }}>Delete for everyone</Text>
                                </TouchableOpacity>
                            )}

                            <TouchableOpacity
                                style={{ paddingVertical: 14, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center' }}
                                onPress={() => deleteMessage(selectedMessage!.id, 'me')}
                            >
                                <Ionicons name="trash-outline" size={20} color="#64748b" />
                                <Text style={{ marginLeft: 16, fontSize: 15, color: '#0f172a', fontWeight: '800' }}>Delete for me</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={{ paddingVertical: 14, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center' }}
                                onPress={() => setSelectedMessage(null)}
                            >
                                <Ionicons name="close" size={20} color="#64748b" />
                                <Text style={{ marginLeft: 16, fontSize: 15, color: '#64748b', fontWeight: '800' }}>Cancel</Text>
                            </TouchableOpacity>
                        </View>
                    </Pressable>
                </Modal>

                {/* FULL SCREEN IMAGE VIEWER */}
                <Modal
                    visible={!!viewingImage}
                    transparent={true}
                    animationType="fade"
                    onRequestClose={() => setViewingImage(null)}
                >
                    <View style={{ flex: 1, backgroundColor: 'black', justifyContent: 'center' }}>
                        <SafeAreaView style={{ flex: 1 }}>
                            <View style={{
                                flexDirection: 'row',
                                justifyContent: 'flex-start',
                                padding: 16,
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                right: 0,
                                zIndex: 100,
                                backgroundColor: 'rgba(0,0,0,0.3)'
                            }}>
                                <TouchableOpacity onPress={() => setViewingImage(null)}>
                                    <Ionicons name="close" size={30} color="white" />
                                </TouchableOpacity>
                            </View>
                            <Pressable style={{ flex: 1 }} onPress={() => setViewingImage(null)}>
                                <Image
                                    source={{ uri: viewingImage || '' }}
                                    style={{ flex: 1 }}
                                    contentFit="contain"
                                />
                            </Pressable>
                        </SafeAreaView>
                    </View>
                </Modal>
            </SafeAreaView>

            {/* 🔄 Media Upload Loading Overlay */}
            {mediaLoading && (
                <View style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.4)',
                    justifyContent: 'center',
                    alignItems: 'center',
                    zIndex: 1000
                }}>
                    <View style={{
                        backgroundColor: 'white',
                        padding: 30,
                        borderRadius: 20,
                        alignItems: 'center',
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: 0.25,
                        shadowRadius: 3.84,
                        elevation: 5
                    }}>
                        <ActivityIndicator size="large" color="#059669" />
                        <Text style={{ marginTop: 15, fontSize: 14, fontWeight: '900', color: '#0f172a', textTransform: 'uppercase', letterSpacing: 2 }}>Sending...</Text>
                    </View>
                </View>
            )}
        </>
    );
}
