import axios from 'axios';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import Toast from 'react-native-toast-message';
import { FulfillmentUpdate, PaginatedOrders, SellerOrder } from '../types';
import { getOrderId } from '../helpers/orderWorkflow';

type UseSellerOrdersParams = {
  baseUrl: string;
  token?: string | null;
  onOtpRequired?: (responseId: number) => void;
};

type ProgressResult = {
  otpRequired?: boolean;
  responseId?: number;
};

const mergeOrderUpdate = (order: SellerOrder, update: FulfillmentUpdate): SellerOrder => {
  const { id: updateId, ...safeUpdate } = update;
  return {
    ...order,
    ...safeUpdate,
    response_id: update.response_id ?? updateId ?? order.response_id ?? order.id,
  };
};

export const useSellerOrders = ({ baseUrl, token, onOtpRequired }: UseSellerOrdersParams) => {
  const [orders, setOrders] = useState<SellerOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [progressLoadingId, setProgressLoadingId] = useState<number | null>(null);
  const seenEventIds = useRef<Set<string>>(new Set());
  const lastSeqMap = useRef<Map<number, number>>(new Map());

  const fetchOrders = useCallback(async (showLoading = true) => {
    if (!token || !baseUrl) {
      setLoading(false);
      return;
    }

    try {
      if (showLoading) setLoading(true);
      const res = await axios.get<PaginatedOrders | SellerOrder[]>(`${baseUrl}/api/store/my-responses/`, {
        params: { page: 1, page_size: 100 },
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      });
      const raw = Array.isArray(res.data) ? res.data : res.data.results || [];
      setOrders(raw);
    } catch (error: any) {
      Toast.show({ type: 'error', text1: 'Orders sync failed', text2: error.response?.data?.error || 'Could not load active orders.', position: 'bottom' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [baseUrl, token]);

  const refresh = useCallback(() => {
    setRefreshing(true);
    fetchOrders(false);
  }, [fetchOrders]);

  useFocusEffect(
    useCallback(() => {
      fetchOrders(false);
    }, [fetchOrders])
  );

  useEffect(() => {
    if (!token || !baseUrl) return;

    let socket: WebSocket | null = null;
    let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
    let mounted = true;

    const connect = () => {
      socket = new WebSocket(`${baseUrl.replace(/^http/, 'ws')}/ws/store-orders/?token=${token}`);

      socket.onopen = () => fetchOrders(false);
      socket.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type !== 'fulfillment_update') return;
          const update = msg.data as FulfillmentUpdate | undefined;
          if (!update) return;

          const eventId = msg.event_id as string | undefined;
          if (eventId) {
            if (seenEventIds.current.has(eventId)) return;
            seenEventIds.current.add(eventId);
            if (seenEventIds.current.size > 300) {
              const first = seenEventIds.current.values().next().value;
              if (first) seenEventIds.current.delete(first);
            }
          }

          const updateId = update.response_id ?? update.id;
          const seq = msg.seq as number | undefined;
          if (!['new_prescription', 'completion_otp_requested'].includes(msg.action) && updateId != null && seq != null) {
            const lastSeq = lastSeqMap.current.get(updateId) ?? -1;
            if (seq <= lastSeq) return;
            lastSeqMap.current.set(updateId, seq);
          }

          if (msg.action === 'new_chat_message') return;

          setOrders((current) => {
            let matched = false;
            const next = current.map((order) => {
              const orderId = getOrderId(order);
              const prescriptionId = update.prescription_id;
              if ((orderId != null && updateId != null && Number(orderId) === Number(updateId)) || (prescriptionId && order.id === prescriptionId)) {
                matched = true;
                return mergeOrderUpdate(order, update);
              }
              return order;
            });
            return matched ? next : current;
          });

          if (['status_change', 'refresh_request', 'completion_otp_requested'].includes(msg.action)) {
            fetchOrders(false);
          }

          if (msg.action === 'completion_otp_requested') {
            Toast.show({ type: 'info', text1: 'OTP Requested', text2: 'Ask customer for the completion OTP.', position: 'bottom' });
          }
        } catch (error) {
          console.log('Active orders WS parse error:', error);
        }
      };
      socket.onclose = () => {
        if (!mounted) return;
        reconnectTimeout = setTimeout(connect, 3000);
      };
      socket.onerror = () => socket?.close();
    };

    connect();

    return () => {
      mounted = false;
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      socket?.close();
    };
  }, [baseUrl, fetchOrders, token]);

  const updateProgress = useCallback(async (order: SellerOrder, progressAction: string): Promise<ProgressResult> => {
    if (!token) return {};
    const id = order.response_id || order.id;
    try {
      setProgressLoadingId(id);
      const res = await axios.post(`${baseUrl}/api/responses/${id}/progress/`, { action: progressAction }, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (progressAction === 'mark_completed' && res.data?.otp_required) {
        const responseId = res.data.response_id || id;
        onOtpRequired?.(responseId);
        Toast.show({ type: 'success', text1: 'OTP Sent', text2: 'Ask the customer for the completion OTP.', position: 'bottom' });
        await fetchOrders(false);
        return { otpRequired: true, responseId };
      }
      Toast.show({ type: 'success', text1: 'Progress Updated', position: 'bottom' });
      await fetchOrders(false);
      return {};
    } catch (error: any) {
      Toast.show({ type: 'error', text1: 'Update Failed', text2: error.response?.data?.message || 'Could not update order.', position: 'bottom' });
      return {};
    } finally {
      setProgressLoadingId(null);
    }
  }, [baseUrl, fetchOrders, onOtpRequired, token]);

  const verifyCompletionOtp = useCallback(async (responseId: number, otp: string) => {
    if (!token) return false;
    try {
      await axios.post(`${baseUrl}/api/responses/${responseId}/completion-otp/verify/`, { otp: otp.trim() }, {
        headers: { Authorization: `Bearer ${token}` },
      });
      Toast.show({ type: 'success', text1: 'Order Completed', text2: 'OTP verified successfully.', position: 'bottom' });
      await fetchOrders(false);
      return true;
    } catch (error: any) {
      Toast.show({ type: 'error', text1: 'Invalid OTP', text2: error.response?.data?.error || 'OTP verification failed.', position: 'bottom' });
      return false;
    }
  }, [baseUrl, fetchOrders, token]);

  const cancelOrder = useCallback(async (responseId: number, reason: string) => {
    if (!token) return false;
    try {
      await axios.post(`${baseUrl}/api/responses/${responseId}/store-cancel/`, { reason: reason.trim() }, {
        headers: { Authorization: `Bearer ${token}` },
      });
      Toast.show({ type: 'success', text1: 'Order Cancelled', text2: 'You have cancelled the order.', position: 'bottom' });
      await fetchOrders(false);
      return true;
    } catch (error: any) {
      Toast.show({ type: 'error', text1: 'Cannot Cancel', text2: error.response?.data?.error || 'Could not cancel order.', position: 'bottom' });
      return false;
    }
  }, [baseUrl, fetchOrders, token]);

  return {
    orders,
    loading,
    refreshing,
    progressLoadingId,
    fetchOrders,
    refresh,
    updateProgress,
    verifyCompletionOtp,
    cancelOrder,
  };
};
