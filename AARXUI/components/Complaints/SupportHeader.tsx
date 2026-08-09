import { LocalizedText as Text } from '@/components/Language/LocalizedPrimitives';
import React from 'react';
import { View, TouchableOpacity } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const PALETTE = {
  primaryNavy: '#123B5D',
  secondaryTeal: '#0F8B8D',
  borderTeal: '#B9DDE0',
};

export function SupportHeader({
  title,
  subtitle,
  onBack,
  right,
}: {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  right?: React.ReactNode;
}) {
  return (
    <View style={{ backgroundColor: '#F4F8FA', paddingTop: 10, paddingBottom: 6 }}>
      <View
        style={{
          marginHorizontal: 16,
          borderRadius: 22,
          overflow: 'hidden',
          elevation: 6,
          shadowColor: '#123B5D',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.25,
          shadowRadius: 8,
        }}
      >
        <LinearGradient
          colors={[PALETTE.primaryNavy, '#184C75', PALETTE.secondaryTeal]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ paddingHorizontal: 16, paddingVertical: 14 }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
              {onBack ? (
                <TouchableOpacity
                  onPress={onBack}
                  activeOpacity={0.8}
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 12,
                    backgroundColor: 'rgba(255, 255, 255, 0.18)',
                    borderWidth: 1,
                    borderColor: 'rgba(255, 255, 255, 0.3)',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: 12,
                  }}
                >
                  <Feather name="arrow-left" size={18} color="#FFFFFF" />
                </TouchableOpacity>
              ) : null}
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={{ fontSize: 18, fontWeight: '900', color: '#FFFFFF', letterSpacing: 0.3 }}>
                    {title}
                  </Text>
                  <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#4ADE80', marginLeft: 8 }} />
                </View>
                {subtitle ? (
                  <Text style={{ fontSize: 9.5, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1, color: 'rgba(255, 255, 255, 0.85)', marginTop: 2 }}>
                    {subtitle}
                  </Text>
                ) : null}
              </View>
            </View>
            {right ? <View style={{ flexDirection: 'row', alignItems: 'center' }}>{right}</View> : null}
          </View>
        </LinearGradient>
      </View>
    </View>
  );
}
