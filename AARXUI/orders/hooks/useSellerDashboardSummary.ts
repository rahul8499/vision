import axios from 'axios';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import Toast from 'react-native-toast-message';
import type { SellerDashboardSummary } from '../types';

type Params = {
  baseUrl: string;
  token?: string | null;
  startDate?: string;
  endDate?: string;
};

export const useSellerDashboardSummary = ({ baseUrl, token, startDate, endDate }: Params) => {
  const [summary, setSummary] = useState<SellerDashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const seenEventIds = useRef<Set<string>>(new Set());

  const fetchSummary = useCallback(async (showLoading = true, isManual = false, overrideStart?: string, overrideEnd?: string) => {
    if (!baseUrl || !token) {
      setLoading(false);
      return;
    }

    const s = overrideStart !== undefined ? overrideStart : startDate;
    const e = overrideEnd !== undefined ? overrideEnd : endDate;

    try {
      if (showLoading) setLoading(true);
      let url = `${baseUrl}/api/store/dashboard-summary/`;
      if (s && e) {
        url += `?start_date=${s}&end_date=${e}`;
      }
      const res = await axios.get<SellerDashboardSummary>(url, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      });
      setSummary(res.data);
    } catch (error: any) {
      console.warn('Dashboard sync error:', error?.response?.status, error?.message);
      if (isManual) {
        Toast.show({
          type: 'error',
          text1: 'Dashboard sync failed',
          text2: error.response?.data?.error || 'Could not load store summary.',
          position: 'bottom',
        });
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [baseUrl, token, startDate, endDate]);

  const refresh = useCallback(() => {
    setRefreshing(true);
    fetchSummary(false, true);
  }, [fetchSummary]);

  useFocusEffect(
    useCallback(() => {
      fetchSummary(false, false);
    }, [fetchSummary])
  );

  useEffect(() => {
    if (!baseUrl || !token) return;

    let socket: WebSocket | null = null;
    let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
    let mounted = true;

    const connect = () => {
      socket = new WebSocket(`${baseUrl.replace(/^http/, 'ws')}/ws/store-orders/?token=${token}`);
      socket.onopen = () => fetchSummary(false);
      socket.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type !== 'fulfillment_update') return;
          if (msg.action === 'new_chat_message') return;

          const eventId = msg.event_id as string | undefined;
          if (eventId) {
            if (seenEventIds.current.has(eventId)) return;
            seenEventIds.current.add(eventId);
            if (seenEventIds.current.size > 200) {
              const first = seenEventIds.current.values().next().value;
              if (first) seenEventIds.current.delete(first);
            }
          }

          fetchSummary(false);
        } catch (error) {
          console.log('Dashboard summary WS parse error:', error);
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
  }, [baseUrl, fetchSummary, token]);

  return { summary, loading, refreshing, refresh, fetchSummary };
};
