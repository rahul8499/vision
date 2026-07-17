import{View}from'react-native';
import{ComplaintHub}from'@/components/Complaints/ComplaintHub';
import{SupportHeader}from'@/components/Complaints/SupportHeader';
export default function SupportIndex(){return <View style={{flex:1,backgroundColor:'#f8fafc'}}><SupportHeader title="Help & Complaints" subtitle="Support and formal case centre"/><ComplaintHub userType="user"/></View>}
