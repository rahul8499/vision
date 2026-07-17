import { LocalizedText as Text, LocalizedTextInput as TextInput } from '@/components/Language/LocalizedPrimitives';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState, type ComponentProps } from 'react';
import {
  Dimensions,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View
} from 'react-native';
import { useSignup } from '../context/SignupContext';

const gradient = ['#60a5fa', '#2563eb'] as const;
const accent = '#2563eb';
const { width, height } = Dimensions.get('window');
const isSmallPhone = width < 380 || height < 700;

const getParamValue = (value?: string | string[]) =>
  Array.isArray(value) ? value[0] : value || '';

export default function SignupStep1() {
  const params = useLocalSearchParams<{
    name?: string;
    mobile?: string;
    email?: string;
    owner_name?: string;
  }>();
  const router = useRouter();
  const { signupData, setSignupData } = useSignup();

  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [secureEntry, setSecureEntry] = useState(true);
  const [emailError, setEmailError] = useState('');
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [isOpening, setIsOpening] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const isEmailValid = (value: string) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

  const isValid =
    name.trim() !== '' &&
    mobile.trim() !== '' &&
    email.trim() !== '' &&
    password.trim() !== '' &&
    emailError === '';

  useEffect(() => {
    setName(signupData.name || getParamValue(params.name));
    setMobile(signupData.mobile || getParamValue(params.mobile));
    setEmail(signupData.email || getParamValue(params.email));
    setPassword(signupData.password || '');
  }, [
    params.email,
    params.mobile,
    params.name,
    signupData.email,
    signupData.mobile,
    signupData.name,
    signupData.password,
  ]);


  useEffect(() => {
    const showSubscription = Keyboard.addListener('keyboardDidShow', () => {
      setKeyboardVisible(true);
    });
    const hideSubscription = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardVisible(false);
    });

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  const scrollInputIntoView = () => {
    setTimeout(() => {
      scrollRef.current?.scrollTo({
        y: isSmallPhone ? 170 : 140,
        animated: true,
      });
    }, 120);
  };

  const handleEmailChange = (value: string) => {
    setEmail(value);
    if (value.trim() === '') {
      setEmailError('Email is required for seller login.');
      return;
    }
    setEmailError(isEmailValid(value) ? '' : 'Please enter a valid email.');
  };

  const handleNext = () => {
    if (!isValid || isOpening) return;

    setIsOpening(true);
    setSignupData((prev) => ({
      ...prev,
      name: name.trim(),
      ownerName: name.trim(), // Use store name as owner name
      mobile: mobile.trim(),
      email: email.trim(),
      password: password.trim(),
    }));

    router.push({
      pathname: '/onboarding/seller-signup-step2',
      params: {
        name,
        owner_name: name.trim(),
        mobile,
        email,
      },
    });
  };

  return (
    <View className="flex-1 bg-slate-50">
      <LinearGradient
        colors={['#eff6ff', '#ecfeff', '#f8fafc']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />

      <View className="absolute -right-20 -top-20 h-56 w-56 rounded-full bg-blue-200/45" />
      <View className="absolute -left-16 top-28 h-44 w-44 rounded-full bg-cyan-200/40" />

      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView
          ref={scrollRef}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          keyboardDismissMode="on-drag"
          bounces={false}
          overScrollMode="never"
          scrollEnabled={keyboardVisible || isSmallPhone}
          contentContainerStyle={[
            styles.scrollContent,
            keyboardVisible && styles.keyboardScrollContent,
          ]}
        >
          <View className="flex-1 px-5">
            <Header
              chip="Pharmacy Partner"
              title="Create Store"
              subtitle="Quick account setup"
              icon="storefront-outline"
              onBack={() =>
                router.push({
                  pathname: '/onboarding/login',
                  params: { userType: 'seller' },
                })
              }
            />

            <View
              className="mt-4 rounded-[26px] border border-white bg-white/90 p-4"
              style={styles.cardShadow}
            >
              <InputRow
                icon="home"
                placeholder="Store name"
                value={name}
                onChangeText={setName}
                returnKeyType="next"
                onFocus={scrollInputIntoView}
              />

              <InputRow
                icon="phone"
                placeholder="Mobile number"
                value={mobile}
                onChangeText={setMobile}
                keyboardType="phone-pad"
                returnKeyType="next"
                onFocus={scrollInputIntoView}
              />

              <PasswordRow
                value={password}
                onChangeText={setPassword}
                secureEntry={secureEntry}
                onToggleSecure={() => setSecureEntry(!secureEntry)}
                onFocus={scrollInputIntoView}
              />

              <InputRow
                icon="mail"
                placeholder="Email address"
                value={email}
                onChangeText={handleEmailChange}
                keyboardType="email-address"
                autoCapitalize="none"
                marginBottom={emailError ? 8 : 16}
                returnKeyType="done"
                onFocus={scrollInputIntoView}
              />

              {emailError !== '' && (
                <Text className="mb-4 ml-2 text-xs font-bold text-red-500">
                  {emailError}
                </Text>
              )}

              <PrimaryButton
                disabled={!isValid || isOpening}
                label={isOpening ? 'Opening' : 'Continue'}
                onPress={handleNext}
              />
            </View>

            <Progress current={1} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

type HeaderProps = {
  chip: string;
  title: string;
  subtitle: string;
  icon: ComponentProps<typeof MaterialCommunityIcons>['name'];
  onBack: () => void;
};

function Header({ chip, title, subtitle, icon, onBack }: HeaderProps) {
  return (
    <>
      <View className="flex-row items-center justify-between">
        <TouchableOpacity
          onPress={onBack}
          className="h-10 w-10 items-center justify-center rounded-full bg-white/90"
          style={styles.softShadow}
        >
          <Feather name="arrow-left" size={21} color="#334155" />
        </TouchableOpacity>

        <View className="rounded-[26px] bg-white p-1.5" style={styles.iconOuterShadow}>
          <LinearGradient colors={gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.heroIcon}>
            <MaterialCommunityIcons name={icon} size={isSmallPhone ? 34 : 38} color="#ffffff" />
          </LinearGradient>
        </View>

        <View className="h-10 w-10" />
      </View>

      <View className="items-center">
        <View className="mt-3 flex-row items-center rounded-full border border-white bg-white/80 px-3 py-1">
          <MaterialCommunityIcons name="shield-check-outline" size={14} color={accent} />
          <Text className="ml-1.5 text-[11px] font-black text-blue-700">{chip}</Text>
        </View>
        <Text className="mt-3 text-center text-[26px] font-black leading-8 text-slate-950">
          {title}
        </Text>
        <Text className="mt-1 text-center text-[13px] font-bold leading-5 text-slate-500">
          {subtitle}
        </Text>
      </View>
    </>
  );
}

type InputRowProps = ComponentProps<typeof TextInput> & {
  icon: ComponentProps<typeof Feather>['name'];
  marginBottom?: number;
};

function InputRow({ icon, marginBottom = 14, ...props }: InputRowProps) {
  return (
    <View
      className="flex-row items-center rounded-[20px] border border-slate-100 bg-slate-50 px-3.5"
      style={{ marginBottom }}
    >
      <View className="h-8 w-8 items-center justify-center rounded-full bg-white">
        <Feather name={icon} size={17} color="#64748b" />
      </View>
      <TextInput
        {...props}
        className="ml-3 flex-1 py-3.5 text-[15px] font-semibold text-slate-900"
        placeholderTextColor="#94a3b8"
      />
    </View>
  );
}

type PasswordRowProps = {
  value: string;
  onChangeText: (value: string) => void;
  secureEntry: boolean;
  onToggleSecure: () => void;
  onFocus: () => void;
};

function PasswordRow({
  value,
  onChangeText,
  secureEntry,
  onToggleSecure,
  onFocus,
}: PasswordRowProps) {
  return (
    <View className="mb-3.5 flex-row items-center rounded-[20px] border border-slate-100 bg-slate-50 px-3.5">
      <View className="h-8 w-8 items-center justify-center rounded-full bg-white">
        <Feather name="lock" size={17} color="#64748b" />
      </View>
      <TextInput
        placeholder="Create password"
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={secureEntry}
        className="ml-3 flex-1 py-3.5 pr-3 text-[15px] font-semibold text-slate-900"
        placeholderTextColor="#94a3b8"
        returnKeyType="next"
        onFocus={onFocus}
      />
      <TouchableOpacity onPress={onToggleSecure}>
        <Feather name={secureEntry ? 'eye-off' : 'eye'} size={19} color="#64748b" />
      </TouchableOpacity>
    </View>
  );
}

function PrimaryButton({
  disabled,
  label,
  onPress,
}: {
  disabled: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      disabled={disabled}
      activeOpacity={0.9}
      onPress={onPress}
      className="overflow-hidden rounded-[22px]"
      style={!disabled ? styles.buttonShadow : undefined}
    >
      <LinearGradient
        colors={!disabled ? gradient : ['#cbd5e1', '#94a3b8']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        className="flex-row items-center justify-center py-3.5"
      >
        <Text className="text-[15px] font-black text-white">{label}</Text>
        <Feather name="arrow-right" size={20} color="#ffffff" style={{ marginLeft: 8 }} />
      </LinearGradient>
    </TouchableOpacity>
  );
}

function Progress({ current }: { current: number }) {
  return (
    <View className="mt-4 flex-row items-center justify-center gap-3">
      {[1, 2].map((step) => (
        <View
          key={step}
          className={`${current === step ? 'h-2.5 w-7' : 'h-2.5 w-2.5'} rounded-full`}
          style={{ backgroundColor: current === step ? accent : '#cbd5e1' }}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    flexGrow: 1,
    paddingTop: isSmallPhone ? 6 : 12,
    paddingBottom: isSmallPhone ? 18 : 24,
  },
  keyboardScrollContent: {
    paddingBottom: 300,
  },
  softShadow: {
    elevation: 5,
    shadowColor: '#94a3b8',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 14,
  },
  iconOuterShadow: {
    elevation: 12,
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.22,
    shadowRadius: 22,
  },
  heroIcon: {
    width: isSmallPhone ? 64 : 70,
    height: isSmallPhone ? 64 : 70,
    borderRadius: isSmallPhone ? 22 : 25,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  cardShadow: {
    elevation: 14,
    shadowColor: '#94a3b8',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.22,
    shadowRadius: 30,
  },
  buttonShadow: {
    elevation: 10,
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.28,
    shadowRadius: 20,
  },
});
