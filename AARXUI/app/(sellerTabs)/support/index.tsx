import{View}from'react-native';
import{ComplaintHub}from'@/components/Complaints/ComplaintHub';
import{SupportHeader}from'@/components/Complaints/SupportHeader';
export default function SupportIndex(){return <View style={{flex:1,backgroundColor:'#f8fafc'}}><SupportHeader title="Seller Support" subtitle="Support and formal case centre"/><ComplaintHub userType="store"/></View>}
