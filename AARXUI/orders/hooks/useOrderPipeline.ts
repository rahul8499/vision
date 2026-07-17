import { useMemo, useState } from 'react';
import { calculateOrderPriority } from '../helpers/orderPriority';
import { sortOrders } from '../helpers/orderSort';
import { getSlaState } from '../helpers/orderSla';
import { isActiveOrder, isCancelledOrder, isCompletedOrder, isOtpPendingOrder, PIPELINE_STAGES, resolveOrderStage } from '../helpers/orderWorkflow';
import type { OrderFilterMode, OrderStage, PriorityInfo, SellerOrder, SlaInfo, StageResolution } from '../types';

export type PipelineOrder = {
  order: SellerOrder;
  stageInfo: StageResolution;
  sla: SlaInfo;
  priority: PriorityInfo;
};

const matchesSearch = (order: SellerOrder, query: string) => {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [order.user_name, order.user_mobile, order.id, order.response_id, order.prescription]
    .some(value => String(value || '').toLowerCase().includes(q));
};

const applyFilter = (order: SellerOrder, mode: OrderFilterMode) => {
  if (mode === 'emergency') return order.prescription_is_emergency === true;
  if (mode === 'pickup') return order.delivery_option === 'walk_in';
  if (mode === 'delivery') return order.delivery_option === 'online';
  if (mode === 'repeat') return !!order.repeat_customer;
  if (mode === 'otp') return isOtpPendingOrder(order);
  return true;
};

export const useOrderPipeline = (orders: SellerOrder[]) => {
  const [activeStage, setActiveStage] = useState<OrderStage>('ACTIVE');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<OrderFilterMode>('all');

  const enrichedOrders = useMemo<PipelineOrder[]>(() => (
    orders.map((order) => {
      const stageInfo = resolveOrderStage(order);
      const sla = getSlaState(order, stageInfo.config);
      const priority = calculateOrderPriority(order, stageInfo, sla);
      return { order, stageInfo, sla, priority };
    })
  ), [orders]);

  const counts = useMemo(() => {
    const initial = PIPELINE_STAGES.reduce<Record<OrderStage, number>>((acc, stage) => ({ ...acc, [stage]: 0 }), {} as Record<OrderStage, number>);
    enrichedOrders.forEach(({ order, stageInfo }) => {
      if (isActiveOrder(order)) {
        initial.ACTIVE += 1;
        initial[stageInfo.stage] += 1;
      }
    });
    initial.COMPLETED = enrichedOrders.filter(({ order }) => isCompletedOrder(order)).length;
    initial.CANCELLED = enrichedOrders.filter(({ order }) => isCancelledOrder(order)).length;
    return initial;
  }, [enrichedOrders]);

  const visibleOrders = useMemo(() => {
    const filtered = enrichedOrders.filter(({ order, stageInfo }) => {
      const stageMatches = activeStage === 'COMPLETED'
        ? isCompletedOrder(order)
        : activeStage === 'CANCELLED'
          ? isCancelledOrder(order)
          : isActiveOrder(order) && (activeStage === 'ACTIVE' || stageInfo.stage === activeStage);
      return stageMatches && applyFilter(order, filterMode) && matchesSearch(order, searchQuery);
    });

    return sortOrders(filtered, item => ({ priority: item.priority, sla: item.sla }), item => item.order);
  }, [activeStage, enrichedOrders, filterMode, searchQuery]);

  const stats = useMemo(() => ({
    counts,
    billing: counts.BILLING || 0,
    ready: counts.READY || 0,
    revenue: orders.filter(isCompletedOrder).reduce((sum, order) => sum + Number(order.total_amount || 0), 0),
  }), [counts, orders]);

  return {
    activeStage,
    setActiveStage,
    searchQuery,
    setSearchQuery,
    filterMode,
    setFilterMode,
    visibleOrders,
    stats,
  };
};
