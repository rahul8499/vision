import { View } from 'react-native';
import { ComplaintHub } from '@/components/Complaints/ComplaintHub';
import { SupportHeader } from '@/components/Complaints/SupportHeader';

export default function SupportIndex() {
  return (
    <View style={{ flex: 1, backgroundColor: '#f8fafc' }}>
      <SupportHeader
        title="Seller Support"
        subtitle="Private Case Resolution Hub"
        description="Manage formal disputes, track case status updates, and communicate directly with platform staff."
      />
      <ComplaintHub userType="store" />
    </View>
  );
}
