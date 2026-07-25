import {
  LocalizedText as Text,
  LocalizedTextInput as TextInput,
} from "@/components/Language/LocalizedPrimitives";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import Constants from "expo-constants";
import { LinearGradient } from "expo-linear-gradient";
import * as SecureStore from "expo-secure-store";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  View,
} from "react-native";
import Toast from "react-native-toast-message";

export default function DeliveryLoginScreen() {
  const baseUrl = Constants.expoConfig?.extra?.BASE_URL || "";
  const [loginId, setLoginId] = useState("");
  const [pin, setPin] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [busy, setBusy] = useState(false);

  const login = async () => {
    if (!loginId.trim() || !/^\d{4,6}$/.test(pin)) {
      Toast.show({
        type: "error",
        text1: "Partner ID और valid PIN डालें",
        text2: "PIN 4 से 6 digits का होना चाहिए।",
      });
      return;
    }
    setBusy(true);
    try {
      const response = await fetch(`${baseUrl}/api/delivery/login/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ login_id: loginId.trim(), pin }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Login failed");
      await SecureStore.setItemAsync("deliveryAuthToken", data.token);
      await SecureStore.setItemAsync(
        "deliveryPartner",
        JSON.stringify(data.partner)
      );
      router.replace("/delivery" as any);
    } catch (error: any) {
      Toast.show({
        type: "error",
        text1: "Login नहीं हुआ",
        text2: error.message,
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-[#f5f7f6]">
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        className="flex-1"
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ flexGrow: 1, paddingBottom: 30 }}
        >
          <LinearGradient
            colors={["#0f172a", "#172554", "#064e3b"]}
            className="overflow-hidden rounded-b-[2.6rem] px-6 pb-10 pt-5"
          >
            <View className="absolute -right-16 -top-14 h-52 w-52 rounded-full bg-emerald-400/10" />
            <View className="absolute -bottom-24 -left-16 h-56 w-56 rounded-full bg-orange-400/10" />
            <View className="flex-row items-center justify-between">
              <TouchableOpacity
                onPress={() => router.replace("/onboarding")}
                className="h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/10"
              >
                <MaterialCommunityIcons
                  name="arrow-left"
                  size={22}
                  color="white"
                />
              </TouchableOpacity>
              <View className="flex-row items-center rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-2">
                <View className="mr-2 h-2 w-2 rounded-full bg-emerald-400" />
                <Text className="text-[8px] font-black uppercase tracking-[1.5px] text-emerald-200">
                  Secure Partner Access
                </Text>
              </View>
            </View>
            <View className="mt-10 h-16 w-16 items-center justify-center rounded-[1.4rem] border border-orange-300/20 bg-orange-500">
              <MaterialCommunityIcons
                name="bike-fast"
                size={34}
                color="white"
              />
            </View>
            <Text className="mt-5 text-[11px] font-black uppercase tracking-[3px] text-orange-300">
              AARX Partner
            </Text>
            <Text className="mt-2 text-4xl font-black leading-[42px] text-white">
              Deliver safely.{"\n"}Stay in control.
            </Text>
            <Text className="mt-3 max-w-[310px] text-xs font-semibold leading-5 text-slate-300">
              Live assignments, customer navigation और secure OTP handover—एक ही
              जगह।
            </Text>
            <View className="mt-6 flex-row gap-2">
              {[
                ["bell-ring-outline", "Live Jobs"],
                ["map-marker-path", "Navigation"],
                ["shield-key-outline", "Secure OTP"],
              ].map(([icon, label]) => (
                <View
                  key={label}
                  className="flex-1 items-center rounded-2xl border border-white/10 bg-white/5 px-2 py-3"
                >
                  <MaterialCommunityIcons
                    name={icon as any}
                    size={18}
                    color="#6ee7b7"
                  />
                  <Text className="mt-2 text-[8px] font-black uppercase text-slate-200">
                    {label}
                  </Text>
                </View>
              ))}
            </View>
          </LinearGradient>

          <View className="-mt-3 px-5">
            <View className="rounded-[2rem] border border-slate-100 bg-white p-5 shadow-xl shadow-slate-300/40">
              <Text className="text-xl font-black text-slate-950">
                Start your shift
              </Text>
              <Text className="mt-1 text-[10px] font-semibold leading-4 text-slate-500">
                Pharmacy से मिला Partner ID और PIN इस्तेमाल करें।
              </Text>
              <Text className="mb-2 mt-5 text-[9px] font-black uppercase tracking-[1.5px] text-slate-400">
                Partner ID
              </Text>
              <View className="flex-row items-center rounded-2xl border border-slate-200 bg-slate-50 px-4">
                <MaterialCommunityIcons
                  name="identifier"
                  size={20}
                  color="#64748b"
                />
                <TextInput
                  value={loginId}
                  onChangeText={setLoginId}
                  autoCapitalize="none"
                  autoCorrect={false}
                  placeholder="Paste your Partner ID"
                  className="ml-3 h-14 flex-1 font-bold text-slate-900"
                />
              </View>
              <Text className="mb-2 mt-4 text-[9px] font-black uppercase tracking-[1.5px] text-slate-400">
                Secure PIN
              </Text>
              <View className="flex-row items-center rounded-2xl border border-slate-200 bg-slate-50 px-4">
                <MaterialCommunityIcons
                  name="lock-outline"
                  size={20}
                  color="#64748b"
                />
                <TextInput
                  value={pin}
                  onChangeText={setPin}
                  keyboardType="number-pad"
                  secureTextEntry={!showPin}
                  maxLength={6}
                  placeholder="4–6 digit PIN"
                  className="ml-3 h-14 flex-1 font-black tracking-[4px] text-slate-900"
                />
                <TouchableOpacity
                  onPress={() => setShowPin((current) => !current)}
                  className="h-10 w-10 items-center justify-center"
                >
                  <MaterialCommunityIcons
                    name={showPin ? "eye-off-outline" : "eye-outline"}
                    size={20}
                    color="#64748b"
                  />
                </TouchableOpacity>
              </View>
              <TouchableOpacity
                onPress={login}
                disabled={busy}
                activeOpacity={0.85}
                className={`mt-5 h-15 flex-row items-center justify-center rounded-2xl py-4 ${
                  busy ? "bg-slate-400" : "bg-orange-600"
                }`}
              >
                {busy ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <>
                    <Text className="font-black uppercase tracking-[1.4px] text-white">
                      Login & Start Shift
                    </Text>
                    <MaterialCommunityIcons
                      name="arrow-right"
                      size={20}
                      color="white"
                      style={{ marginLeft: 8 }}
                    />
                  </>
                )}
              </TouchableOpacity>
              <View className="mt-4 flex-row items-start rounded-2xl bg-emerald-50 p-3">
                <MaterialCommunityIcons
                  name="shield-check-outline"
                  size={18}
                  color="#059669"
                />
                <Text className="ml-2 flex-1 text-[9px] font-semibold leading-4 text-emerald-800">
                  Login token इस device के secure storage में सुरक्षित रहता है।
                  PIN app में save नहीं होता।
                </Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={() =>
                Toast.show({
                  type: "info",
                  text1: "Pharmacy से संपर्क करें",
                  text2:
                    "Owner Settings → Delivery Team से Partner ID देख और PIN reset कर सकता है।",
                })
              }
              className="mt-4 flex-row items-center justify-center py-3"
            >
              <MaterialCommunityIcons
                name="help-circle-outline"
                size={17}
                color="#64748b"
              />
              <Text className="ml-2 text-[10px] font-black text-slate-500">
                Partner ID या PIN नहीं मिल रहा?
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
