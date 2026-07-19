import axios from 'axios';
import { useCallback, useEffect, useRef, useState } from 'react';

type AnyRecord = Record<string, unknown>;

export type AppNotification = {
  id: number | string;
  title?: string;
  body?: string;
  notification_type?: string;
  data?: AnyRecord;
  is_read?: boolean;
  created_at?: string | null;
};

type UseAppNotificationsArgs = {
  baseUrl?: string;
  token?: string | null;
  enabled?: boolean;
};

type NotificationsResponse = {
  results?: AppNotification[];
  unread_count?: number;
};

type RealtimeNotificationMessage = {
  type?: string;
  action?: string;
  data?: {
    unread_count?: number;
    notification?: AppNotification;
  };
};

const MAX_NOTIFICATIONS = 50;

function normalizeUnreadCount(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function normalizeNotification(value: unknown): AppNotification | null {
  if (!value || typeof value !== 'object') return null;

  const notification = value as AppNotification;
  if (notification.id === undefined || notification.id === null) return null;

  return {
    ...notification,
    data: notification.data && typeof notification.data === 'object' ? notification.data : {},
  };
}

export function useAppNotifications({ baseUrl, token, enabled = true }: UseAppNotificationsArgs) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const resetNotifications = useCallback(() => {
    setNotifications([]);
    setUnreadCount(0);
    setLoading(false);
  }, []);

  const fetchNotifications = useCallback(async () => {
    if (!enabled || !baseUrl || !token) {
      resetNotifications();
      return;
    }

    setLoading(true);
    try {
      const res = await axios.get<NotificationsResponse>(`${baseUrl}/api/notifications/?limit=${MAX_NOTIFICATIONS}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
      });

      if (!mountedRef.current) return;

      setNotifications(Array.isArray(res.data.results) ? res.data.results : []);
      setUnreadCount(normalizeUnreadCount(res.data.unread_count));
    } catch (error) {
      console.log('Error fetching app notifications:', error);
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [baseUrl, enabled, resetNotifications, token]);

  const markAllRead = useCallback(async () => {
    if (!enabled || !baseUrl || !token) return;

    setUnreadCount(0);
    setNotifications((prev) => prev.map((notification) => ({ ...notification, is_read: true })));

    try {
      const res = await axios.post<{ unread_count?: number }>(
        `${baseUrl}/api/notifications/mark-read/`,
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/json',
          },
        }
      );
      setUnreadCount(normalizeUnreadCount(res.data?.unread_count));
    } catch (error) {
      console.log('Error marking app notifications read:', error);
      fetchNotifications();
    }
  }, [baseUrl, enabled, fetchNotifications, token]);

  const markRead = useCallback(async (notificationId: number | string) => {
    if (!enabled || !baseUrl || !token) return;
    const selected = notifications.find((item) => String(item.id) === String(notificationId));
    if (selected?.is_read) return;
    setNotifications((prev) => prev.map((item) => String(item.id) === String(notificationId) ? { ...item, is_read: true } : item));
    setUnreadCount((count) => Math.max(0, count - 1));
    try {
      const res = await axios.post<{ unread_count?: number }>(
        `${baseUrl}/api/notifications/mark-read/`,
        { id: notificationId },
        { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } }
      );
      setUnreadCount(normalizeUnreadCount(res.data?.unread_count));
    } catch (error) {
      console.log('Error marking notification read:', error);
      fetchNotifications();
    }
  }, [baseUrl, enabled, fetchNotifications, notifications, token]);

  const handleRealtimeMessage = useCallback((message: RealtimeNotificationMessage) => {
    if (message?.type !== 'fulfillment_update' || message?.action !== 'app_notification') {
      return false;
    }

    const payload = message.data || {};
    setUnreadCount(normalizeUnreadCount(payload.unread_count));

    const incoming = normalizeNotification(payload.notification);
    if (incoming) {
      setNotifications((prev) => {
        const withoutDuplicate = prev.filter((item) => String(item.id) !== String(incoming.id));
        return [incoming, ...withoutDuplicate].slice(0, MAX_NOTIFICATIONS);
      });
    } else {
      fetchNotifications();
    }

    return true;
  }, [fetchNotifications]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  return {
    notifications,
    unreadCount,
    loading,
    fetchNotifications,
    markAllRead,
    markRead,
    handleRealtimeMessage,
  };
}
