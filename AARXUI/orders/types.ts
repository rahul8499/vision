export type SellerOrderMedicine = {
  medicine_name?: string | null;
  price?: number | string | null;
  is_available?: boolean;
};

export type DeliveryPersonSummary = {
  id?: number;
  name?: string | null;
  mobile?: string | null;
  vehicle_type?: string | null;
  vehicle_number?: string | null;
  current_order_count?: number;
  max_concurrent_orders?: number;
};

export type DeliveryOfferSummary = {
  home_delivery_available?: boolean;
  pickup_available?: boolean;
  delivery_message?: string | null;
  assigned_delivery_person?: DeliveryPersonSummary | null;
  assignment_status?: string | null;
};

export type SellerOrder = {
  id: number;
  response_id?: number;
  prescription?: number;
  image?: string | null;
  user?: number;
  user_id?: number;
  user_name?: string | null;
  user_mobile?: string | null;
  user_address?: string | null;
  latitude?: number | string | null;
  longitude?: number | string | null;
  user_latitude?: number | string | null;
  user_longitude?: number | string | null;
  store?: number;
  response_text?: string | null;
  total_amount?: number | string | null;
  medicines?: SellerOrderMedicine[];
  delivery_option?: string | null;
  delivery_offer?: DeliveryOfferSummary | null;
  user_status?: string | null;
  is_processing_started?: boolean;
  is_packed?: boolean;
  is_locked?: boolean;
  completion_otp_requested?: boolean;
  completion_otp_expires_at?: string | null;
  accepted_at?: string | null;
  updated_at?: string | null;
  created_at?: string | null;
  completed_at?: string | null;
  delivery_picked_up_at?: string | null;
  delivery_reached_at?: string | null;
  delivery_assignment_status?: 'unassigned' | 'pending' | 'accepted' | 'rejected' | string;
  delivery_assignment_rejection_reason?: string | null;
  delivery_issue_code?: string | null;
  delivery_issue_note?: string | null;
  delivery_return?: {
    id: number; reason: string; reason_label: string; note?: string | null;
    package_condition: string; package_condition_label: string;
    status: 'returning' | 'received' | 'disputed'; status_label: string;
    store_note?: string | null; requested_at?: string | null;
    received_at?: string | null; disputed_at?: string | null;
  } | null;
  cancelled_by?: string | null;
  cancel_reason?: string | null;
  repeat_customer?: boolean;
  repeat_order_count?: number;
  last_order_at?: string | null;
  chat_thread_id?: number | null;
  prescription_is_emergency?: boolean;
  unread_count?: number;
};

export type PaginatedOrders = {
  results?: SellerOrder[];
};

export type FulfillmentUpdate = Partial<SellerOrder> & {
  id?: number;
  response_id?: number;
  prescription_id?: number;
};

export type OrderStage = 'ACTIVE' | 'NEW' | 'BILLING' | 'PACKED' | 'READY' | 'DELIVERY' | 'OTP' | 'COMPLETED' | 'CANCELLED';

export type OrderAction =
  | 'START_BILLING'
  | 'MARK_PACKED'
  | 'READY_PICKUP'
  | 'OUT_FOR_DELIVERY'
  | 'COMPLETE'
  | 'CALL'
  | 'CHAT'
  | 'VIEW_RX'
  | 'CANCEL';

export type OrderCapabilities = {
  canStartBilling: boolean;
  canPack: boolean;
  canMarkReady: boolean;
  canSendDelivery: boolean;
  canComplete: boolean;
  canCancel: boolean;
  canCall: boolean;
  canChat: boolean;
  canViewPrescription: boolean;
};

export type StageConfig = {
  key: OrderStage;
  label: string;
  shortLabel: string;
  color: string;
  backgroundColor: string;
  icon: string;
  slaMinutes: number;
  allowedActions: OrderAction[];
};

export type StageResolution = {
  stage: OrderStage;
  config: StageConfig;
  capabilities: OrderCapabilities;
};

export type SlaInfo = {
  elapsedMinutes: number;
  remainingMinutes: number;
  progress: number;
  state: 'ok' | 'warning' | 'breached';
  label: string;
};

export type PriorityInfo = {
  score: number;
  label: 'High' | 'Medium' | 'Normal';
  reasons: string[];
};

export type OrderTimelineEvent = {
  id: string | number;
  type:
    | 'QUOTE_ACCEPTED'
    | 'BILLING_STARTED'
    | 'PACKED'
    | 'READY'
    | 'OUT_FOR_DELIVERY'
    | 'OTP_REQUESTED'
    | 'COMPLETED'
    | 'CANCELLED';
  createdAt: string;
  actorType: 'store' | 'user' | 'system';
  actorName?: string;
  note?: string;
};

export type OrderFilterMode = 'all' | 'emergency' | 'pickup' | 'delivery' | 'repeat' | 'otp';


export type SellerDashboardSummary = {
  date: string;
  today: {
    orders: number;
    revenue: number;
    completed: number;
    cancelled: number;
  };
  workload: {
    active: number;
    new: number;
    billing: number;
    packed: number;
    ready: number;
    delivery: number;
    otp: number;
  };
  attention: Array<{
    id: number;
    response_id: number;
    patient: string;
    reason: string;
    stage: string;
    minutes: number;
    icon?: string;
    image?: string | null;
  }>;
  store?: {
    is_online?: boolean;
    is_active?: boolean;
    is_verified?: boolean;
  };
};
