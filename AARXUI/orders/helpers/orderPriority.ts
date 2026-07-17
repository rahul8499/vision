import type { PriorityInfo, SellerOrder, SlaInfo, StageResolution } from '../types';
import { isOtpPendingOrder } from './orderWorkflow';

const getPriorityLabel = (score: number): PriorityInfo['label'] => {
  if (score >= 180) return 'High';
  if (score >= 80) return 'Medium';
  return 'Normal';
};

export const calculateOrderPriority = (order: SellerOrder, stageInfo: StageResolution, sla: SlaInfo): PriorityInfo => {
  let score = 0;
  const reasons: string[] = [];

  if (order.prescription_is_emergency) {
    score += 250;
    reasons.push('Emergency Order');
  }

  if (isOtpPendingOrder(order) || stageInfo.stage === 'OTP') {
    score += 80;
    reasons.push('OTP Pending');
  }

  if (sla.state === 'breached') {
    score += 70;
    reasons.push(`${stageInfo.config.label} SLA breached`);
  } else if (sla.state === 'warning') {
    score += 35;
    reasons.push(`${stageInfo.config.label} nearing SLA`);
  }

  if (stageInfo.stage === 'READY') {
    score += 70;
    reasons.push('Ready for Pickup');
  }

  if (stageInfo.stage === 'DELIVERY') {
    score += 60;
    reasons.push('Delivery in progress');
  }

  if (sla.elapsedMinutes >= 20) {
    score += 50;
    reasons.push(`Accepted ${sla.elapsedMinutes} min ago`);
  }

  if (order.repeat_customer) {
    score += 20;
    reasons.push('Repeat Customer');
  }

  if (order.unread_count && order.unread_count > 0) {
    score += 40;
    reasons.push('Unread customer message');
  }

  return {
    score,
    label: getPriorityLabel(score),
    reasons,
  };
};
