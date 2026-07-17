import { LocalizedText as Text, LocalizedTextInput as TextInput } from '@/components/Language/LocalizedPrimitives';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import * as DocumentPicker from 'expo-document-picker';
import Constants from 'expo-constants';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState, type ComponentProps } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View
} from 'react-native';
import Toast from 'react-native-toast-message';
import { useSignup } from '../context/SignupContext';

type PickedFile = DocumentPicker.DocumentPickerAsset | null;

const gradient = ['#60a5fa', '#2563eb'] as const;
const accent = '#2563eb';
const { width, height } = Dimensions.get('window');
const isSmallPhone = width < 380 || height < 700;

const getParamValue = (value?: string | string[]) =>
  Array.isArray(value) ? value[0] : value || '';

export default function SignupStep2() {
  const router = useRouter();
  const {
    name,
    owner_name,
    mobile,
    email,
    address: addressParam,
    pincode: pincodeParam,
    gstNumber: gstNumberParam,
    drugLicense: drugLicenseParam,
    latitude: latitudeParam,
    longitude: longitudeParam,
  } = useLocalSearchParams<{
    name?: string;
    owner_name?: string;
    mobile?: string;
    email?: string;
    address?: string;
    pincode?: string;
    gstNumber?: string;
    drugLicense?: string;
    latitude?: string;
    longitude?: string;
  }>();
  const routeName = getParamValue(name);
  const routeOwnerName = getParamValue(owner_name);
  const routeMobile = getParamValue(mobile);
  const routeEmail = getParamValue(email);
  const routeAddress = getParamValue(addressParam);
  const routePincode = getParamValue(pincodeParam);
  const routeGstNumber = getParamValue(gstNumberParam);
  const routeDrugLicense = getParamValue(drugLicenseParam);
  const routeLatitude = getParamValue(latitudeParam);
  const routeLongitude = getParamValue(longitudeParam);
  const { signupData, setSignupData } = useSignup();
  const BASE_URL = Constants.expoConfig?.extra?.BASE_URL;

  const [address, setAddress] = useState('');
  const [pincode, setPincode] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [locationBusy, setLocationBusy] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [isOpening, setIsOpening] = useState(false);
  const [storeLicenseDoc, setStoreLicenseDoc] = useState<PickedFile>(null);
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const hasLocation = latitude.trim() !== '' && longitude.trim() !== '';
  const isValid =
    address.trim() !== '' &&
    pincode.trim() !== '' &&
    storeLicenseDoc !== null;

  useEffect(() => {
    setAddress(signupData.address || routeAddress);
    setPincode(signupData.pincode || routePincode);
    setLatitude(signupData.latitude || routeLatitude);
    setLongitude(signupData.longitude || routeLongitude);
  }, [
    routeAddress,
    routeLatitude,
    routeLongitude,
    routePincode,
    signupData.address,
    signupData.latitude,
    signupData.longitude,
    signupData.pincode,
  ]);

  useFocusEffect(
    useCallback(() => {
      setIsOpening(false);
    }, [])
  );

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
        y: isSmallPhone ? 185 : 155,
        animated: true,
      });
    }, 120);
  };

  const buildAddress = (item: Location.LocationGeocodedAddress) => {
    if (item.formattedAddress) return item.formattedAddress;

    return [
      item.name,
      item.street,
      item.district,
      item.city,
      item.region,
      item.postalCode,
    ]
      .filter(Boolean)
      .join(', ');
  };

  const useCurrentLocation = async () => {
    if (locationBusy) return;

    try {
      setLocationBusy(true);
      const { status } = await Location.requestForegroundPermissionsAsync();

      if (status !== 'granted') {
        Toast.show({
          type: 'error',
          text1: 'Location permission needed',
          text2: 'Please allow location to verify your store.',
          position: 'bottom',
        });
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const coords = location.coords;
      const reverse = await Location.reverseGeocodeAsync({
        latitude: coords.latitude,
        longitude: coords.longitude,
      });
      const firstAddress = reverse[0];

      setLatitude(String(coords.latitude));
      setLongitude(String(coords.longitude));

      if (firstAddress) {
        const nextAddress = buildAddress(firstAddress);
        if (nextAddress) setAddress(nextAddress);
        if (firstAddress.postalCode) setPincode(firstAddress.postalCode);
      }

      Toast.show({
        type: 'success',
        text1: 'Store location captured',
        position: 'bottom',
      });
    } catch (error) {
      console.error('Seller location error:', error);
      Toast.show({
        type: 'error',
        text1: 'Could not fetch location',
        text2: 'Please try again near your store.',
        position: 'bottom',
      });
    } finally {
      setLocationBusy(false);
    }
  };

  const pickFile = async (setter: (file: PickedFile) => void) => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (!result.canceled && result.assets?.length) {
        setter(result.assets[0]);
      }
    } catch (error) {
      console.error('Error picking file:', error);
      Toast.show({
        type: 'error',
        text1: 'File selection failed',
        text2: 'Please try again.',
        position: 'bottom',
      });
    }
  };

  const appendFile = (formData: FormData, key: string, file: PickedFile) => {
    if (!file) return;

    formData.append(key, {
      uri: file.uri,
      name: file.name || `${key}.jpg`,
      type: file.mimeType || 'application/octet-stream',
    } as any);
  };

  const getErrorMessage = (data: any) => {
    if (data?.error) return data.error;
    if (data?.errors) {
      const firstKey = Object.keys(data.errors)[0];
      const firstError = data.errors[firstKey];
      const message = Array.isArray(firstError) ? firstError[0] : firstError;
      if (message) return `${firstKey}: ${message}`;
    }
    return data?.message || 'Please try again.';
  };

  const handleRegister = async () => {
    if (!isValid || loading) return;

    setLoading(true);

    const formData = new FormData();

    formData.append('name', signupData.name || routeName);
    formData.append('owner_name', signupData.ownerName || routeOwnerName);
    formData.append('mobile', signupData.mobile || routeMobile);
    const emailToUse = signupData.email || routeEmail;
    if (emailToUse) formData.append('email', emailToUse);
    formData.append('password', signupData.password || '');
    formData.append('address', address.trim());
    formData.append('pincode', pincode.trim());
    formData.append('latitude', latitude.trim());
    formData.append('longitude', longitude.trim());

    appendFile(formData, 'store_license_document', storeLicenseDoc);

    try {
      const response = await fetch(`${BASE_URL}/api/store/register/`, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (response.ok) {
        Toast.show({
          type: 'success',
          text1: 'Registration successful!',
          position: 'bottom',
        });

        router.push({
          pathname: '/onboarding/login',
          params: { userType: 'seller' },
        });
        return;
      }

      Toast.show({
        type: 'error',
        text1: 'Registration failed!',
        text2: getErrorMessage(data),
        position: 'bottom',
      });
    } catch (error) {
      console.error('Error during upload:', error);
      Toast.show({
        type: 'error',
        text1: 'Network error!',
        text2: 'Please try again later.',
        position: 'bottom',
      });
    } finally {
      setLoading(false);
    }
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
              chip="Store Location"
              title="Verify Store"
              subtitle="Capture location and licence"
              icon="store-marker-outline"
              onBack={() =>
                router.push({
                  pathname: '/onboarding/seller-signup-step1',
                  params: {
                    name: routeName,
                    owner_name: routeOwnerName,
                    mobile: routeMobile,
                    email: routeEmail,
                  },
                })
              }
            />

            <View
              className="mt-4 rounded-[26px] border border-white bg-white/90 p-4"
              style={styles.cardShadow}
            >
              <TouchableOpacity
                disabled={locationBusy}
                activeOpacity={0.9}
                onPress={useCurrentLocation}
                className="mb-3.5 overflow-hidden rounded-[22px]"
                style={!locationBusy ? styles.buttonShadow : undefined}
              >
                <LinearGradient
                  colors={!locationBusy ? gradient : ['#cbd5e1', '#94a3b8']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  className="flex-row items-center justify-center py-3.5"
                >
                  <MaterialCommunityIcons
                    name={hasLocation ? 'crosshairs-gps' : 'crosshairs'}
                    size={20}
                    color="#ffffff"
                  />
                  <Text className="ml-2 text-[15px] font-black text-white">
                    {locationBusy
                      ? 'Fetching location'
                      : hasLocation
                        ? 'Location Captured'
                        : 'Use Current Location'}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>

              {hasLocation && (
                <View className="mb-3.5 rounded-[18px] bg-blue-50 px-3 py-2">
                  <Text className="text-[11px] font-black text-blue-700">
                    Lat {Number(latitude).toFixed(5)} · Long {Number(longitude).toFixed(5)}
                  </Text>
                </View>
              )}

              <InputRow
                icon="map-pin"
                placeholder="Store address"
                value={address}
                onChangeText={setAddress}
                returnKeyType="next"
                onFocus={scrollInputIntoView}
              />

              <InputRow
                icon="hash"
                placeholder="Pincode"
                value={pincode}
                onChangeText={setPincode}
                keyboardType="number-pad"
                returnKeyType="next"
                onFocus={scrollInputIntoView}
              />

              <UploadButton
                icon="file-text"
                label="Store licence document"
                file={storeLicenseDoc}
                onPress={() => pickFile(setStoreLicenseDoc)}
              />

              <TouchableOpacity
                onPress={handleRegister}
                disabled={!isValid || loading}
                activeOpacity={0.9}
                className="mt-2 overflow-hidden rounded-[22px]"
                style={!loading && isValid ? styles.buttonShadow : undefined}
              >
                <LinearGradient
                  colors={!loading && isValid ? gradient : ['#cbd5e1', '#94a3b8']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  className="flex-row items-center justify-center py-3.5"
                >
                  {loading ? (
                    <>
                      <Text className="mr-2 text-[15px] font-black text-white">
                        Creating store
                      </Text>
                      <ActivityIndicator color="#ffffff" />
                    </>
                  ) : (
                    <>
                      <Text className="text-[15px] font-black text-white">
                        Submit for Review
                      </Text>
                      <Feather
                        name="check-circle"
                        size={20}
                        color="#ffffff"
                        style={{ marginLeft: 8 }}
                      />
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>

            <Progress current={2} />
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
            <MaterialCommunityIcons name={icon} size={isSmallPhone ? 36 : 40} color="#ffffff" />
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

type UploadButtonProps = {
  icon: ComponentProps<typeof Feather>['name'];
  label: string;
  file: PickedFile;
  onPress: () => void;
};

function UploadButton({ icon, label, file, onPress }: UploadButtonProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.86}
      className="mb-4 flex-row items-center rounded-[20px] border border-slate-100 bg-slate-50 px-3.5 py-3.5"
    >
      <View className="h-9 w-9 items-center justify-center rounded-full bg-white">
        <Feather name={icon} size={17} color={file ? accent : '#64748b'} />
      </View>

      <View className="ml-3 flex-1">
        <Text className="text-[15px] font-black text-slate-900" numberOfLines={1}>
          {file ? file.name : label}
        </Text>
        <Text className="mt-0.5 text-xs font-bold text-slate-500">
          {file ? 'Selected' : 'Tap to upload'}
        </Text>
      </View>

      <MaterialCommunityIcons
        name={file ? 'check-circle' : 'cloud-upload-outline'}
        size={22}
        color={file ? accent : '#94a3b8'}
      />
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
