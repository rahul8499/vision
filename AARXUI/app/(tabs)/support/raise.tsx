import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { RaiseComplaintForm } from '@/components/Complaints/RaiseComplaintForm';
import { SupportHeader } from '@/components/Complaints/SupportHeader';
import type { ComplaintDetail, ComplaintParty } from '@/utils/complaintsApi';

export default function RaiseScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [userType, setUserType] = useState<'user' | 'store'>('user');

  useEffect(() => {
    (async () => {
      const t = await SecureStore.getItemAsync('userType');
      setUserType(t === 'store' ? 'store' : 'user');
    })();
  }, []);

  const ridRaw = params.respondent_id ? String(params.respondent_id) : '';
  const prefill = ridRaw
    ? {
        respondent_type: (String(params.respondent_type || (userType === 'user' ? 'store' : 'user')) as ComplaintParty),
        respondent_id: Number(ridRaw),
        respondent_name: params.respondent_name ? String(params.respondent_name) : '',
        order_id: params.order_id ? Number(String(params.order_id)) : undefined,
        order_label: params.order_label ? String(params.order_label) : undefined,
      }
    : undefined;

  const onSubmitted = (d: ComplaintDetail) => {
    router.replace({ pathname: '/support/[id]', params: { id: String(d.id) } } as any);
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#f8fafc' }}>
      <SupportHeader title="Raise a Complaint" onBack={() => router.back()} />
      <RaiseComplaintForm userType={userType} prefill={prefill} onSubmitted={onSubmitted} onCancel={() => router.back()} />
    </View>
  );
}
