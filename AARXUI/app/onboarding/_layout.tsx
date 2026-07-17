// import { Stack } from 'expo-router';
// import { Image, StyleSheet, View } from 'react-native';

// export default function OnboardingLayout() {
//   return (
//     <View style={{ flex: 1 }}>
//       <View  className="bg-slate-50 justify-center  items-center">
//         <Image source={require('../../assets/images/logo1.png')}  className="  mt-20"/>
//       </View>

//       <Stack screenOptions={{ headerShown: false }}>
//         <Stack.Screen name="index" />
//         <Stack.Screen name="login" />
//       </Stack>
//     </View>
//   );
// }

// const styles = StyleSheet.create({
//   header: {
//     // height: 60,
//     // backgroundColor: 'white',
//     justifyContent: 'center',
//     alignItems: 'center',
//     // elevation: 4,
//   },

// });
import { Stack, useLocalSearchParams, usePathname } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Image, StyleSheet, View } from 'react-native';
import { SignupProvider } from '../context/SignupContext';

const buyerGradient = ['#f0fdf4', '#ecfeff', '#eff6ff'] as const;
const sellerGradient = ['#eff6ff', '#ecfeff', '#f8fafc'] as const;

export default function OnboardingLayout() {
  const pathname = usePathname();
  const params = useLocalSearchParams<{ userType?: string }>();
  const isSellerTheme =
    pathname.includes('seller-signup') || params.userType === 'seller';

  return (
    <SignupProvider>
      <View style={{ flex: 1 }}>
        <LinearGradient
          colors={isSellerTheme ? sellerGradient : buyerGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />

        <View className="items-center" style={{ height: 190 }}>
          <Image
            source={require('../../assets/images/aarxcolorthemelogo.png')}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>

        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="login" />
        </Stack>
      </View>
    </SignupProvider>
  );
}

const styles = StyleSheet.create({
  logo: {
    width: 400,    // apne hisab se adjust karo
    height: 220,   // apne hisab se adjust karo
    marginTop: 0,
  },
});
