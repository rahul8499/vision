import { LocalizedText as Text } from '@/components/Language/LocalizedPrimitives';
import React from 'react';
import {
  TouchableOpacity,
  View,
  StyleSheet
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ComplaintSummary } from '@/utils/complaintsApi';
import { StatusBadge } from './StatusBadge';

export function ComplaintCard({
  item,
  onPress,
  roleLabel,
}: {
  item: ComplaintSummary;
  onPress: () => void;
  roleLabel: string;
}) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.92}>
      <View style={styles.topRow}>
        <StatusBadge status={item.status} display={item.status_display} />
        {item.unread_count > 0 && (
          <View style={styles.unreadDot}>
            <Text style={styles.unreadText}>{item.unread_count > 99 ? '99+' : item.unread_count}</Text>
          </View>
        )}
        <Text style={styles.category}>{item.category_display}</Text>
      </View>

      <Text style={styles.subject} numberOfLines={1}>
        {item.subject}
      </Text>

      <View style={styles.bottomRow}>
        <View style={styles.roleChip}>
          <Ionicons
            name={item.respondent_type === 'store' ? 'storefront-outline' : 'person-outline'}
            size={13}
            color="#475569"
          />
          <Text style={styles.roleText}>
            {roleLabel}: {item.respondent_name}
          </Text>
        </View>
        {item.order_id ? <Text style={styles.orderTag}>Order #{item.order_id}</Text> : null}
      </View>

      <Text style={styles.date}>
        {new Date(item.updated_at).toLocaleDateString()} · {new Date(item.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 14,
    marginHorizontal: 14,
    marginVertical: 7,
    borderWidth: 1,
    borderColor: '#eef2f7',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  topRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  unreadDot: {
    backgroundColor: '#ef4444',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  unreadText: { color: '#fff', fontSize: 11, fontWeight: '900' },
  category: { marginLeft: 'auto', fontSize: 12, color: '#64748b', fontWeight: '700' },
  subject: { fontSize: 16, fontWeight: '800', color: '#0f172a', marginBottom: 8 },
  bottomRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  roleChip: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f1f5f9', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10 },
  roleText: { fontSize: 12, color: '#475569', fontWeight: '700', marginLeft: 4 },
  orderTag: { fontSize: 12, color: '#0e7490', fontWeight: '800' },
  date: { fontSize: 11, color: '#94a3b8', fontWeight: '600' },
});
