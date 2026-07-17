import { LocalizedText as Text } from '@/components/Language/LocalizedPrimitives';
import React from 'react';
import {
  StyleSheet
} from 'react-native';
import type { ComplaintStatus } from '@/utils/complaintsApi';

const STATUS_COLORS: Record<string, { bg: string; fg: string }> = {
  open: { bg: '#fee2e2', fg: '#b91c1c' },
  under_review: { bg: '#fef3c7', fg: '#b45309' },
  awaiting_info: { bg: '#e0e7ff', fg: '#4338ca' },
  resolved: { bg: '#dcfce7', fg: '#15803d' },
  rejected: { bg: '#f3f4f6', fg: '#6b7280' },
  withdrawn: { bg: '#f3f4f6', fg: '#6b7280' },
  closed: { bg: '#e5e7eb', fg: '#374151' },
};

export function StatusBadge({ status, display }: { status: ComplaintStatus | string; display: string }) {
  const c = STATUS_COLORS[status] || { bg: '#e5e7eb', fg: '#374151' };
  return <Text style={[styles.badge, { backgroundColor: c.bg, color: c.fg }]}>{display}</Text>;
}

const styles = StyleSheet.create({
  badge: {
    fontSize: 11,
    fontWeight: '800',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    overflow: 'hidden',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
});
