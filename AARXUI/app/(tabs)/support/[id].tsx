import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { ComplaintDetailScreen } from '@/components/Complaints/ComplaintDetailScreen';

export default function DetailScreen() {
  const params = useLocalSearchParams();
  const id = String(params.id || '');
  const [userType, setUserType] = useState<'user' | 'store'>('user');

  useEffect(() => {
    (async () => {
      const t = await SecureStore.getItemAsync('userType');
      setUserType(t === 'store' ? 'store' : 'user');
    })();
  }, []);

  if (!id) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8fafc' }}>
        <ActivityIndicator color="#059669" />
      </View>
    );
  }

  return <ComplaintDetailScreen userType={userType} id={id} />;
}
