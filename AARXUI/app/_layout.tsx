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
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { ActivityIndicator, View } from "react-native";
import 'react-native-reanimated';
import { Provider as PaperProvider } from 'react-native-paper';
import Toast from 'react-native-toast-message';
import { Provider } from 'react-redux';
import { store } from '../redux/store';
import { LanguageProvider } from '@/context/LanguageContext';

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Roboto_400Regular,
    Roboto_500Medium,
  });
  const colorScheme = useColorScheme();


  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#008080" />
      </View>
    );
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <PaperProvider>
        <Provider store={store}>
          <LanguageProvider>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" options={{ headerShown: false }} />
            <Stack.Screen name="onboarding" options={{ headerShown: false }} />
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="(sellerTabs)" options={{ headerShown: false }} />
            <Stack.Screen name="+not-found" />
          </Stack>
          </LanguageProvider>
        </Provider>

        {/* ✅ Toast at absolute root level, inside PaperProvider context */}
        <Toast />

      </PaperProvider>
    </ThemeProvider>
  );
}
