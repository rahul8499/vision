import { CapabilityFlags, CapabilityStatus } from '../components/UnavailableOverlay';

export const activeCapabilities: CapabilityFlags = {
  availability: { user: true, store: true, store_verified: true },
  permissions: {
    chat: true,
    offer: true,
    enquiry: true,
    call: true,
    view_address: true,
    accept_quote: true,
    reject_quote: true,
    place_order: true,
    rate: true,
  },
  status: { code: CapabilityStatus.ACTIVE, message: '' },
};

export function buildStoreCapabilities(store?: { is_active?: boolean; is_verified?: boolean } | null): CapabilityFlags {
  if (!store) return activeCapabilities;

  const isActive = store.is_active ?? true;
  const isVerified = store.is_verified ?? true;

  if (!isActive) {
    return {
      availability: { user: true, store: false, store_verified: isVerified },
      permissions: Object.fromEntries(Object.keys(activeCapabilities.permissions).map((key) => [key, false])) as CapabilityFlags['permissions'],
      status: { code: CapabilityStatus.STORE_INACTIVE, message: 'Store is currently inactive and cannot receive orders.' },
    };
  }

  if (!isVerified) {
    return {
      ...activeCapabilities,
      availability: { user: true, store: true, store_verified: false },
      permissions: {
        ...activeCapabilities.permissions,
        chat: false,
        offer: false,
        accept_quote: false,
        reject_quote: false,
        place_order: false,
        view_address: false,
      },
      status: { code: CapabilityStatus.STORE_UNVERIFIED, message: 'Verify your store to continue.' },
    };
  }

  return activeCapabilities;
}

export function can(capabilities: CapabilityFlags | undefined, permission: keyof CapabilityFlags['permissions']) {
  return capabilities?.permissions?.[permission] ?? true;
}


export function buildUserCapabilities(user?: { is_active?: boolean; is_deleted?: boolean } | null): CapabilityFlags {
  if (!user) return activeCapabilities;

  if (user.is_deleted) {
    return {
      availability: { user: false, store: true, store_verified: true },
      permissions: Object.fromEntries(Object.keys(activeCapabilities.permissions).map((key) => [key, false])) as CapabilityFlags['permissions'],
      status: { code: CapabilityStatus.USER_DELETED, message: 'User account has been deleted.' },
    };
  }

  if (user.is_active === false) {
    return {
      availability: { user: false, store: true, store_verified: true },
      permissions: Object.fromEntries(Object.keys(activeCapabilities.permissions).map((key) => [key, false])) as CapabilityFlags['permissions'],
      status: { code: CapabilityStatus.USER_INACTIVE, message: 'User account is inactive.' },
    };
  }

  return activeCapabilities;
}
