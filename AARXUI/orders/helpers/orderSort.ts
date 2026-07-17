import type { PriorityInfo, SellerOrder, SlaInfo } from '../types';

type SortContext = {
  priority: PriorityInfo;
  sla: SlaInfo;
};

const getTime = (value?: string | null) => {
  if (!value) return Number.MAX_SAFE_INTEGER;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? Number.MAX_SAFE_INTEGER : time;
};

export const sortOrders = <T>(
  items: T[],
  getContext: (item: T) => SortContext,
  getOrder: (item: T) => SellerOrder
) => {
  return [...items].sort((a, b) => {
    const aContext = getContext(a);
    const bContext = getContext(b);

    if (bContext.priority.score !== aContext.priority.score) {
      return bContext.priority.score - aContext.priority.score;
    }

    const slaRank = { breached: 3, warning: 2, ok: 1 };
    const slaDiff = slaRank[bContext.sla.state] - slaRank[aContext.sla.state];
    if (slaDiff !== 0) return slaDiff;

    const aOrder = getOrder(a);
    const bOrder = getOrder(b);
    const aAccepted = getTime(aOrder.accepted_at || aOrder.updated_at || aOrder.created_at);
    const bAccepted = getTime(bOrder.accepted_at || bOrder.updated_at || bOrder.created_at);
    if (aAccepted !== bAccepted) return aAccepted - bAccepted;

    return String(aOrder.user_name || '').localeCompare(String(bOrder.user_name || ''));
  });
};
