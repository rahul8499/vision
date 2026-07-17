import { LocalizedText as Text } from '@/components/Language/LocalizedPrimitives';
/**
 * UnavailableOverlay
 *
 * Reusable overlay that covers the action area of a card when a store or user
 * is unavailable. The card content (history, prescriptions, quotes) remains
 * visible behind; only actions are blocked.
 *
 * Usage:
 *   <UnavailableOverlay
 *     capabilities={item.capabilities}
 *     onPress={() => router.push('/(sellerTabs)/settings')}
 *   />
 */
import React from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

// Mirrors backend Status constants
export const CapabilityStatus = {
  ACTIVE: 'active',
  STORE_UNVERIFIED: 'store_unverified',
  STORE_INACTIVE: 'store_inactive',
  STORE_SUSPENDED: 'store_suspended',
  STORE_DELETED: 'store_deleted',
  USER_VERIFIED: 'user_verified',
  USER_INACTIVE: 'user_inactive',
  USER_DELETED: 'user_deleted',
} as const;

export type CapabilityStatusCode = typeof CapabilityStatus[keyof typeof CapabilityStatus];

export interface CapabilityFlags {
  availability: {
    user: boolean;
    store: boolean;
    store_verified: boolean;
  };
  permissions: {
    chat: boolean;
    offer: boolean;
    enquiry: boolean;
    call: boolean;
    view_address: boolean;
    accept_quote: boolean;
    reject_quote: boolean;
    place_order: boolean;
    rate: boolean;
  };
  status: {
    code: CapabilityStatusCode | string;
    message: string;
  };
}

interface UnavailableOverlayProps {
  capabilities?: CapabilityFlags;
  /** Called when the user taps the CTA button (e.g., "Verify Now") */
  onPress?: () => void;
  /** Override the rounded corners applied to the overlay */
  borderRadius?: number;
  /** Use a compact in-flow alert instead of covering the parent. */
  variant?: 'overlay' | 'compact';
}

function resolveConfig(code: string): {
  icon: string;
  title: string;
  ctaLabel?: string;
  showCta: boolean;
} {
  switch (code) {
    case CapabilityStatus.STORE_UNVERIFIED:
      return {
        icon: 'shield-alert-outline',
        title: 'Store Not Verified',
        ctaLabel: 'Verify Now',
        showCta: true,
      };
    case CapabilityStatus.STORE_INACTIVE:
      return {
        icon: 'store-off-outline',
        title: 'Store Inactive',
        showCta: false,
      };
    case CapabilityStatus.STORE_SUSPENDED:
      return {
        icon: 'alert-octagon-outline',
        title: 'Store Suspended',
        showCta: false,
      };
    case CapabilityStatus.STORE_DELETED:
      return {
        icon: 'delete-off-outline',
        title: 'Store No Longer Available',
        showCta: false,
      };
    case CapabilityStatus.USER_INACTIVE:
    case CapabilityStatus.USER_DELETED:
      return {
        icon: 'account-off-outline',
        title: 'User Unavailable',
        showCta: false,
      };
    default:
      return {
        icon: 'lock',
        title: 'Unavailable',
        showCta: false,
      };
  }
}

/**
 * Returns `true` if the capabilities object indicates that the interaction
 * layer should be shown (i.e., at least one action permission is denied and
 * the overall status is not "active").
 */
export function shouldShowOverlay(capabilities?: CapabilityFlags): boolean {
  if (!capabilities) return false;
  if (capabilities.status.code === CapabilityStatus.ACTIVE) return false;
  console.warn('[UnavailableOverlay] SHOWING overlay. status.code=', capabilities.status.code, '| full capabilities=', JSON.stringify(capabilities));
  return true;
}

export default function UnavailableOverlay({
  capabilities,
  onPress,
  borderRadius = 24,
  variant = 'overlay',
}: UnavailableOverlayProps) {
  if (!shouldShowOverlay(capabilities)) return null;

  const code = capabilities!.status.code;
  const message = capabilities!.status.message;
  const config = resolveConfig(code);

  if (variant === 'compact') {
    return (
      <View style={[styles.compact, { borderRadius }]}>
        <View style={styles.compactIcon}>
          <MaterialCommunityIcons name={config.icon as any} size={18} color="#ffffff" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.compactTitle}>{config.title}</Text>
          {!!message && <Text style={styles.compactSubtitle}>{message}</Text>}
        </View>
        {config.showCta && !!onPress && (
          <TouchableOpacity onPress={onPress} activeOpacity={0.8} style={styles.compactCta}>
            <Text style={styles.compactCtaText}>{config.ctaLabel}</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  return (
    <View
      style={[
        styles.overlay,
        {
          borderBottomLeftRadius: borderRadius,
          borderBottomRightRadius: borderRadius,
        },
      ]}
    >
      {/* Icon badge */}
      <View style={styles.iconBadge}>
        <MaterialCommunityIcons
          name={config.icon as any}
          size={28}
          color="#ffffff"
        />
      </View>

      {/* Title */}
      <Text style={styles.title}>{config.title}</Text>

      {/* Subtitle message */}
      {!!message && <Text style={styles.subtitle}>{message}</Text>}

      {/* CTA button (e.g. Verify Now) */}
      {config.showCta && !!onPress && (
        <TouchableOpacity
          onPress={onPress}
          activeOpacity={0.8}
          style={styles.cta}
        >
          <MaterialCommunityIcons name="check-decagram" size={16} color="#ffffff" />
          <Text style={styles.ctaText}>{config.ctaLabel}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({

  compact: {
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.28)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  compactIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(239, 68, 68, 0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  compactTitle: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  compactSubtitle: {
    color: '#cbd5e1',
    fontSize: 10,
    fontWeight: '700',
    lineHeight: 14,
    marginTop: 2,
  },
  compactCta: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: '#059669',
  },
  compactCtaText: {
    color: '#ffffff',
    fontSize: 8,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10, 18, 32, 0.96)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
    paddingHorizontal: 24,
  },
  iconBadge: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  title: {
    color: '#ffffff',
    fontWeight: '900',
    fontSize: 14,
    letterSpacing: 2,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  subtitle: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 16,
    lineHeight: 16,
  },
  cta: {
    backgroundColor: '#10b981',
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderRadius: 50,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
    marginTop: 4,
  },
  ctaText: {
    color: '#ffffff',
    fontWeight: '900',
    fontSize: 11,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginLeft: 8,
  },
});
