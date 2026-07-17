import { LocalizedText as Text } from '@/components/Language/LocalizedPrimitives';

import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View
} from 'react-native';

type RoleId = 'buyer' | 'seller';

const roles = [
  {
    id: 'buyer' as RoleId,
    title: 'Buyer',
    subtitle: 'Order medicines at your doorstep',
    icon: 'pill' as const,
    accent: '#059669',
    gradient: ['#10b981', '#059669'] as const,
    softGradient: ['#f0fdf4', '#dcfce7'] as const,
    tint: '#ecfdf5',
    tag: 'FAST DELIVERY',
    tagIcon: 'flash' as const,
    tagBg: 'bg-emerald-50 border-emerald-100',
    tagSelectedBg: 'bg-emerald-600 border-emerald-600',
    tagTextColor: 'text-emerald-700',
    benefits: [
      { icon: 'flash' as const, text: 'Instant Delivery', subtext: 'Get medicines in under 30 minutes' },
      { icon: 'shield-check-outline' as const, text: '100% Genuine', subtext: 'Directly sourced from verified pharmacies' },
      // { icon: 'ticket-percent-outline' as const, text: 'Flat 20% Off', subtext: 'Save big on your first prescription' },
    ],
  },
  {
    id: 'seller' as RoleId,
    title: 'Seller',
    subtitle: 'Sell and manage pharmacy orders',
    icon: 'storefront-outline' as const,
    accent: '#2563eb',
    gradient: ['#3b82f6', '#2563eb'] as const,
    softGradient: ['#eff6ff', '#dbeafe'] as const,
    tint: '#eff6ff',
    tag: 'ZERO COMMISSION',
    tagIcon: 'percent' as const,
    tagBg: 'bg-blue-50 border-blue-100',
    tagSelectedBg: 'bg-blue-600 border-blue-600',
    tagTextColor: 'text-blue-700',
    benefits: [
      { icon: 'trending-up' as const, text: 'Grow 2x Sales', subtext: 'Reach thousands of local customers' },
      { icon: 'laptop' as const, text: 'Prescription Suite', subtext: 'Manage orders and quotes digitally' },
      // { icon: 'hand-coin-outline' as const, text: '0% Commission', subtext: 'Zero commission fees for the first 3 months' },
    ],
  },
];

const defaultBenefits = [
  { icon: 'shield-check' as const, text: 'Safe & Secure', subtext: 'Your health records and transactions are encrypted' },
  { icon: 'star-circle-outline' as const, text: 'Top Rated App', subtext: 'Trusted by over 50,000+ happy users' },
  { icon: 'headset' as const, text: '24/7 Care Support', subtext: 'Get help from our support team anytime' },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const [selectedRole, setSelectedRole] = useState<RoleId | null>(null);
  const [isOpening, setIsOpening] = useState(false);
  const selectedRoleRef = useRef<RoleId | null>(null);

  const selectedRoleData = roles.find((role) => role.id === selectedRole);
  const activeBenefits = selectedRoleData?.benefits || defaultBenefits;

  const selectRole = (role: RoleId) => {
    selectedRoleRef.current = role;
    setSelectedRole(role);
  };

  const handleContinue = () => {
    const role = selectedRoleRef.current || selectedRole;
    if (!role || isOpening) return;

    setIsOpening(true);
    router.push({
      pathname: '/onboarding/login',
      params: { userType: role },
    });
  };

  return (
    <SafeAreaView className="flex-1 bg-slate-">
      <LinearGradient
        colors={['#f8fffe', '#f4faf8', '#eef5ff']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />

      {/* --- Modern App Style Floating Medicine Pattern (Like Swiggy/Zomato) --- */}
      <View
        style={StyleSheet.absoluteFillObject}
        pointerEvents="none"
        className="overflow-hidden"
      >
        {/* Top Left Soft Shape */}
        <View
          style={{
            position: 'absolute',
            top: -180,
            left: -120,
            width: 360,
            height: 360,
            borderRadius: 999,
            backgroundColor: 'rgba(156, 235, 209, 0.1)',
          }}
        />

        {/* Right Circle */}
        <View
          style={{
            position: 'absolute',
            top: 160,
            right: -170,
            width: 340,
            height: 340,
            borderRadius: 999,
            backgroundColor: 'rgba(59,130,246,0.10)',
          }}
        />

        {/* Bottom Right */}
        <View
          style={{
            position: 'absolute',
            bottom: -100,
            right: -80,
            width: 260,
            height: 260,
            borderRadius: 999,
            backgroundColor: 'rgba(96,165,250,0.08)',
          }}
        />

        {/* Bottom Left */}
        <View
          style={{
            position: 'absolute',
            bottom: -120,
            left: -80,
            width: 260,
            height: 260,
            borderRadius: 999,
            backgroundColor: 'rgba(16,185,129,0.08)',
          }}
        />

        {/* Top Right Dots */}
        {/* <View
          style={{
            position: 'absolute',
            top: 80,
            right: 28,
            width: 90,
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 10,
          }}
        >
          {Array.from({ length: 16 }).map((_, i) => (
            <View
              key={i}
              style={{
                width: 4,
                height: 4,
                borderRadius: 2,
                backgroundColor: '#60A5FA',
              }}
            />
          ))}
        </View> */}

        {/* Bottom Left Dots */}
        <View
          style={{
            position: 'absolute',
            bottom: 120,
            left: 24,
            width: 70,
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 8,
          }}
        >
          {Array.from({ length: 12 }).map((_, i) => (
            <View
              key={i}
              style={{
                width: 4,
                height: 4,
                borderRadius: 2,
                backgroundColor: '#86EFAC',
              }}
            />
          ))}
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 22 }}
      >
        <View className="flex-1 px-5 pt-0 android:pt-0">
          <View className="mb-6 items-center">
            <View
              className="mb-4 h-20 w-20 items-center justify-center rounded-[28px] "

            >
              <View
                className="items-center justify-center rounded-[22px] bg-white border border-emerald-500/10"
                style={{
                  width: 68,
                  height: 68,
                  shadowColor: '#059669',
                  shadowOffset: { width: 0, height: 6 },
                  shadowOpacity: 0.12,
                  shadowRadius: 12,
                  elevation: 6,
                }}
              >
                <MaterialCommunityIcons name="medical-bag" size={60} color="#059669" />
              </View>
            </View>

            <Text className="px-2 text-center text-[25px] font-black leading-8 text-slate-950">
              Choose Your Journey
            </Text>

            <Text className="mt-1.5 text-center text-[14px] font-bold text-slate-500">
              Choose your role to continue
            </Text>
          </View>

          <View className="gap-3.5">
            {roles.map((role) => {
              const isSelected = selectedRole === role.id;

              return (
                <TouchableOpacity
                  key={role.id}
                  activeOpacity={0.92}
                  onPressIn={() => selectRole(role.id)}
                  className="overflow-hidden rounded-[26px] border-[1.5px] bg-white"
                  style={[
                    styles.roleShadow,
                    {
                      borderColor: isSelected ? role.accent : '#e2e8f0',
                      backgroundColor: isSelected
                        ? (role.id === 'buyer' ? '#f0fdf4' : '#eff6ff')
                        : '#ffffff',
                    },
                    isSelected && {
                      shadowColor: role.accent,
                      shadowOpacity: 0.18,
                    },
                  ]}
                >
                  <View className="flex-row items-center p-4 min-h-[114px]">
                    {/* Left Side Content - Takes up 64% width to prevent collision with right side panel */}
                    <View style={{ width: '64%' }}>
                      {/* Dynamic Pill Tag */}


                      {/* Title & Subtitle Info Row */}
                      <View className="flex-row items-center mt-1">
                        <View
                          className="h-[48px] w-[48px] items-center justify-center "
                        // style={{
                        //   backgroundColor: isSelected ? 'rgba(255,255,255,0.9)' : role.tint,
                        //   borderColor: isSelected ? role.accent : 'rgba(0,0,0,0.02)',
                        // }}
                        >
                          <MaterialCommunityIcons
                            name={role.icon}
                            size={38}
                            color={role.accent}
                          />
                        </View>

                        <View className="ml-3 flex-1">
                          <Text className="text-[20px] font-black text-slate-950">
                            {role.title}
                          </Text>
                          <Text className="text-[11.5px] font-bold leading-[15px] text-slate-500 mt-0.5">
                            {role.subtitle}
                          </Text>
                        </View>
                      </View>
                    </View>

                    {/* Right Side Curved Gradient Panel */}
                    <View
                      style={{
                        position: 'absolute',
                        right: 0,
                        top: 0,
                        bottom: 0,
                        width: '38%',
                        overflow: 'hidden',
                      }}
                    >
                      <LinearGradient
                        colors={isSelected ? role.gradient : role.softGradient}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={{
                          flex: 1,
                          borderTopLeftRadius: 100,
                          borderBottomLeftRadius: 40,
                          justifyContent: 'center',
                          alignItems: 'center',
                        }}
                      >
                        {/* Overlapping Glassmorphic Circle */}
                        <View
                          style={{
                            position: 'absolute',
                            top: -20,
                            left: -20,
                            width: 80,
                            height: 80,
                            borderRadius: 40,
                            backgroundColor: isSelected
                              ? 'rgba(255, 255, 255, 0.08)'
                              : 'rgba(255, 255, 255, 0.35)',
                            borderColor: isSelected
                              ? 'rgba(255, 255, 255, 0.12)'
                              : 'rgba(0, 0, 0, 0.02)',
                            borderWidth: 1,
                          }}
                        />

                        {/* Large Watermark Icon */}
                        <MaterialCommunityIcons
                          name={role.icon}
                          size={74}
                          color={isSelected ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.03)'}
                          style={{
                            position: 'absolute',
                            right: -12,
                            bottom: -15,
                            transform: [{ rotate: '-15deg' }],
                          }}
                        />

                        {/* Circular Check/Arrow Badge */}
                        <View
                          className="h-10 w-10 items-center justify-center rounded-full bg-white shadow-lg"
                          style={{
                            elevation: 4,
                            shadowColor: isSelected ? role.accent : '#000000',
                            shadowOpacity: 0.15,
                            shadowOffset: { width: 0, height: 2 },
                            shadowRadius: 4,
                          }}
                        >
                          <MaterialCommunityIcons
                            name={isSelected ? 'check-bold' : 'chevron-right'}
                            size={18}
                            color={isSelected ? role.accent : '#64748b'}
                          />
                        </View>
                      </LinearGradient>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Dynamic Benefits & Trust Panel */}
          <View className="mt-5 rounded-[24px] border border-slate-100/80 bg-white/70 p-4">
            <Text className="text-[13px] font-black text-slate-900 mb-3 px-1 tracking-wide">
              {selectedRole ? `${selectedRoleData?.title} Benefits` : 'Platform Highlights'}
            </Text>
            <View className="gap-3.5">
              {activeBenefits.map((benefit, index) => (
                <View key={index} className="flex-row items-start">
                  <View
                    className="h-8 w-8 items-center justify-center rounded-xl bg-white border border-slate-100/50"
                    style={{
                      shadowColor: selectedRoleData?.accent || '#059669',
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: 0.05,
                      shadowRadius: 4,
                      elevation: 2,
                    }}
                  >
                    <MaterialCommunityIcons
                      name={benefit.icon}
                      size={16}
                      color={selectedRoleData?.accent || '#059669'}
                    />
                  </View>
                  <View className="ml-3 flex-1 justify-center">
                    <Text className="text-[12.5px] font-black text-slate-900 leading-4">
                      {benefit.text}
                    </Text>
                    <Text className="text-[11px] font-bold text-slate-500 mt-0.5 leading-[14px]">
                      {benefit.subtext}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </View>

          <TouchableOpacity
            disabled={!selectedRole || isOpening}
            activeOpacity={0.9}
            onPress={handleContinue}
            className="mt-4 overflow-hidden rounded-[22px]"
            style={
              selectedRole && !isOpening
                ? [
                  styles.buttonShadow,
                  {
                    shadowColor: selectedRoleData?.accent || '#059669',
                  },
                ]
                : undefined
            }
          >
            <LinearGradient
              colors={
                selectedRole && !isOpening
                  ? selectedRoleData?.gradient || ['#10b981', '#059669']
                  : ['#cbd5e1', '#94a3b8']
              }
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              className="flex-row items-center justify-center px-5 py-4"
            >
              <Text className="text-[15px] font-black text-white">
                {isOpening ? 'Opening' : 'Continue'}
              </Text>
              <MaterialCommunityIcons
                name="arrow-right"
                size={20}
                color="#ffffff"
                style={{ marginLeft: 8 }}
              />
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  heroShadow: {
    elevation: 7,
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.14,
    shadowRadius: 16,
  },
  roleShadow: {
    elevation: 7,
    shadowColor: '#94a3b8',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.14,
    shadowRadius: 18,
  },
  buttonShadow: {
    elevation: 9,
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.24,
    shadowRadius: 18,
  },
});
