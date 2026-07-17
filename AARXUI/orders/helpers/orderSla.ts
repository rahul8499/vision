import type { SellerOrder, SlaInfo, StageConfig } from '../types';

const MS_PER_MINUTE = 60 * 1000;

const getStageStartedAt = (order: SellerOrder) => (
  order.updated_at || order.accepted_at || order.created_at || null
);

export const getSlaState = (order: SellerOrder, config: StageConfig, now = Date.now()): SlaInfo => {
  const startedAt = getStageStartedAt(order);
  const startedTime = startedAt ? new Date(startedAt).getTime() : now;
  const elapsedMinutes = Math.max(0, Math.floor((now - (Number.isNaN(startedTime) ? now : startedTime)) / MS_PER_MINUTE));
  const slaMinutes = config.slaMinutes || 0;
  const remainingMinutes = slaMinutes ? Math.max(0, slaMinutes - elapsedMinutes) : 0;
  const progress = slaMinutes ? Math.min(100, Math.round((elapsedMinutes / slaMinutes) * 100)) : 0;
  const state: SlaInfo['state'] = !slaMinutes || progress < 60 ? 'ok' : progress < 100 ? 'warning' : 'breached';

  return {
    elapsedMinutes,
    remainingMinutes,
    progress,
    state,
    label: `${elapsedMinutes} min`,
  };
};
