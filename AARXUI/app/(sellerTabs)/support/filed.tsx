import { DeviceEventEmitter, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ComplaintList } from '@/components/Complaints/ComplaintList';
import { SupportHeader } from '@/components/Complaints/SupportHeader';

export default function Filed() {
  const router = useRouter();
  const params = useLocalSearchParams<{ fromDrawer?: string; fromSettings?: string }>();

  const handleBack = () => {
    const isFromDrawer = params?.fromDrawer === 'true';
    const isFromSettings = params?.fromSettings === 'true';

    if (isFromSettings) {
      router.push('/(sellerTabs)/settings');
      return;
    }

    if (isFromDrawer) {
      if (router.canGoBack()) {
        router.back();
      } else {
        router.push('/(sellerTabs)/home');
      }
      setTimeout(() => {
        DeviceEventEmitter.emit('open-seller-drawer');
      }, 150);
      return;
    }

    if (router.canGoBack()) {
      router.back();
    } else {
      router.push('/(sellerTabs)/settings');
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#f8fafc' }}>
      <SupportHeader
        title="Store Complaints"
        subtitle="Cases raised by your pharmacy"
        onBack={handleBack}
      />
      <ComplaintList userType="store" mode="filed" />
    </View>
  );
}
