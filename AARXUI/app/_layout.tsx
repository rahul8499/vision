// import "@/global.css";
// import { useColorScheme } from '@/hooks/useColorScheme';
// import {
//   Roboto_400Regular,
//   Roboto_500Medium
// } from '@expo-google-fonts/roboto';
// import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
// import { useFonts } from 'expo-font';
// import { Stack } from 'expo-router';
// // import { ActivityIndicator, View } from "react-native";
// import 'react-native-reanimated';
// import Toast from 'react-native-toast-message';

// export default function RootLayout() {
//   const colorScheme = useColorScheme();
//   // const [loaded] = useFonts({
//   //   SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
//   // });
//   const [fontsLoaded] = useFonts({
//     Roboto_400Regular,
//     Roboto_500Medium,
//   });

//   if (!fontsLoaded) {
//     return (
//       <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
//         <ActivityIndicator size="large" color="#008080" />
//       </View>
//     );
//   }  // if (!loaded) {
//   //   // Async font loading only occurs in development.
//   //   return null;
//   // }

//   return (
// //     <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
// //       <Stack>
// //         <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
// //         <Stack.Screen name="onboarding/index"  options={{
// //     headerShown: false,
// //     title: "Select User Type", // or "Login", or anything you want
// //   }} />
// //   <Stack.Screen
// //   name="onboarding/login"
// //   options={{ title: "Login", headerShown: true }}
// // />
// //         <Stack.Screen name="+not-found" />
// //       </Stack>
// //       <StatusBar style="auto" />
// //     </ThemeProvider>
//   <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
//       <View style={{ flex: 1 }} className="bg-slate-50">
//         {/* <Header />  */}
//         <Stack screenOptions={{ headerShown: false }}> {/* React Navigation के अपने Headers बंद */}
//             <Stack.Screen
//             name="onboarding"
//             options={{
//               headerShown: false,
//             }}
//           />
//           {/* <Stack.Screen
//             name="onboarding/login"
//             options={{ headerShown: false }}
//           /> */}
//           <Stack.Screen name="(tabs)" options={{ headerShown: false }} />

//           <Stack.Screen name="+not-found" />
//         </Stack>
//          <Toast /> {/* ✅ Add Toast here at root level */}

//         <StatusBar style="auto" />
//       </View>
//     </ThemeProvider>
//   );
// }
import "@/global.css";
import { useColorScheme } from '@/hooks/useColorScheme';
import {
  Roboto_400Regular,
  Roboto_500Medium
} from '@expo-google-fonts/roboto';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import 'react-native-reanimated';
import { Provider as PaperProvider } from 'react-native-paper';
import Toast from 'react-native-toast-message';
import { Provider } from 'react-redux';
import { store } from '../redux/store';
import { LanguageProvider } from '@/context/LanguageContext';

import { SecurityGuard } from '@/components/SecurityGuard';

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Roboto_400Regular,
    Roboto_500Medium,
  });
  const colorScheme = useColorScheme();

  if (!fontsLoaded) {
    return (
      <View style={loaderStyles.screen}>
        <LinearGradient
          colors={['#ecfdf5', '#f8fafc', '#eff6ff']}
          style={StyleSheet.absoluteFillObject}
        />
        <View style={loaderStyles.glow} />
        <View style={loaderStyles.logoShell}>
          <View style={loaderStyles.logo}>
            <MaterialCommunityIcons name="medical-bag" size={45} color="#059669" />
          </View>
          <View style={loaderStyles.spinner}>
            <ActivityIndicator size="large" color="#10b981" />
          </View>
        </View>
        <Text style={loaderStyles.brand}>AARX</Text>
        <Text style={loaderStyles.caption}>Healthcare, delivered with care</Text>
      </View>
    );
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <PaperProvider>
        <Provider store={store}>
          <LanguageProvider>
            <SecurityGuard>
              <Stack screenOptions={{ headerShown: false }}>
                <Stack.Screen name="index" options={{ headerShown: false }} />
                <Stack.Screen name="onboarding" options={{ headerShown: false }} />
                <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                <Stack.Screen name="(sellerTabs)" options={{ headerShown: false }} />
                <Stack.Screen name="delivery" options={{ headerShown: false }} />
                <Stack.Screen name="+not-found" />
              </Stack>
            </SecurityGuard>
          </LanguageProvider>
        </Provider>

        {/* ✅ Toast at absolute root level, inside PaperProvider context */}
        <Toast />

      </PaperProvider>
    </ThemeProvider>
  );
}

const loaderStyles = StyleSheet.create({
  screen: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8fafc' },
  glow: { position: 'absolute', width: 260, height: 260, borderRadius: 130, backgroundColor: 'rgba(16,185,129,0.08)' },
  logoShell: { width: 106, height: 106, alignItems: 'center', justifyContent: 'center' },
  logo: {
    width: 78, height: 78, borderRadius: 26, alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#ffffff', elevation: 10, shadowColor: '#059669',
    shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.18, shadowRadius: 18,
  },
  spinner: { position: 'absolute', width: 106, height: 106, alignItems: 'center', justifyContent: 'center', transform: [{ scale: 1.35 }] },
  brand: { marginTop: 20, color: '#0f172a', fontSize: 25, fontWeight: '900', letterSpacing: 5 },
  caption: { marginTop: 7, color: '#64748b', fontSize: 12, fontWeight: '600', letterSpacing: 0.3 },
});
