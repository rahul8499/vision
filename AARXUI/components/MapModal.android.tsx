import { LocalizedText as Text, LocalizedTextInput as TextInput } from '@/components/Language/LocalizedPrimitives';
import { MaterialIcons, Feather, Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import Constants from 'expo-constants';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  Keyboard,
  Modal,
  Platform,
  StyleSheet,
  TouchableOpacity,
  View
} from 'react-native';
import { Camera, type CameraRef, MapView, type RegionPayload, RestApi, UserLocation, Logger } from 'mappls-map-react-native';
import { LocationStorage, RecentLocation } from '../utils/LocationStorage';

interface LocationCoords {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
}

interface Props {
  setModalVisible: (visible: boolean) => void;
  currentlocation: LocationCoords | null;
  setCurrentLocation: (location: LocationCoords) => void;
  setAddress: (address: string) => void;
  address: string | null;
}

const useDebounce = (value: string, delay: number): string => {
  const [debouncedValue, setDebouncedValue] = useState<string>(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
};

const MapModal: React.FC<Props> = ({
  setModalVisible,
  currentlocation,
  setCurrentLocation,
  setAddress,
  address,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebounce(searchQuery, 600);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [recentLocations, setRecentLocations] = useState<RecentLocation[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [fetchingGPS, setFetchingGPS] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [sessionToken, setSessionToken] = useState<string>('');
  const [resolvingPin, setResolvingPin] = useState(false);
  const reverseGeocodeRequest = useRef(0);
  const preserveSelectedAddressRef = useRef(false);
  const pendingMapplsSelectionRef = useRef<any | null>(null);
  
  const cameraRef = useRef<CameraRef>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const searchCache = useRef<Map<string, any[]>>(new Map());

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(300)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 40,
        friction: 8,
        useNativeDriver: true,
      })
    ]).start();
  }, []);

  useEffect(() => {
    const optionalUnprovisionedMethods = ['setLogoGravity', 'enableTraffic', 'enableTrafficClosure', 'enableTrafficFreeFlow', 'enableTrafficNonFreeFlow', 'enableTrafficStopIcon'];
    Logger.setLogCallback((log) =>
      log.message.includes('Method not Provisioned') &&
      optionalUnprovisionedMethods.some((method) => log.message.startsWith(method))
    );
    return () => Logger.setLogCallback(() => false);
  }, []);

  const reverseGeocodeMappls = async (latitude: number, longitude: number) => {
    const response = await RestApi.reverseGeocode({ latitude, longitude });
    const place = response.results?.[0];
    if (!place) return '';
    return place.formatted_address || [place.poi, place.street, place.locality, place.city, place.state, place.pincode].filter(Boolean).join(', ');
  };

  const generateToken = () => Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

  const ensureSessionToken = () => {
    if (!sessionToken) {
      setSessionToken(generateToken());
    }
  };

  useEffect(() => {
    const loadRecent = async () => {
      const data = await LocationStorage.getRecentLocations();
      setRecentLocations(data);
    };
    loadRecent();
  }, []);

  const [mapRegion, setMapRegion] = useState<LocationCoords>(() => {
    const defaultRegion = {
      latitude: 18.5204,
      longitude: 73.8567,
      latitudeDelta: 0.005,
      longitudeDelta: 0.005,
    };

    if (currentlocation) {
      return {
        ...defaultRegion,
        ...currentlocation,
        latitudeDelta: currentlocation.latitudeDelta || 0.005,
        longitudeDelta: currentlocation.longitudeDelta || 0.005,
      };
    }
    return defaultRegion;
  });

  const fetchSuggestions = async (query: string) => {
    if (!query || query.length < 3) return setSuggestions([]);

    if (searchCache.current.has(query)) {
      setSuggestions(searchCache.current.get(query) || []);
      return;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    setLoadingSuggestions(true);
    try {
      ensureSessionToken();
      const BASE_URL = Constants.expoConfig?.extra?.BASE_URL;
      let url = `${BASE_URL}/api/search-location/?q=${encodeURIComponent(query)}&sessiontoken=${sessionToken}`;
      
      if (currentlocation) {
        url += `&lat=${currentlocation.latitude}&lon=${currentlocation.longitude}`;
      }

      const res = await fetch(url, {
        signal: abortControllerRef.current.signal,
      });
      const data = await res.json();

      if (!res.ok) throw new Error(`Location search failed (${res.status})`);
      const normalized = Array.isArray(data) ? data : [];
      searchCache.current.set(query, normalized);
      setSuggestions(normalized);
    } catch (error: any) {
      if (error.name === 'AbortError') return;
      console.error('Search error:', error);
    } finally {
      setLoadingSuggestions(false);
    }
  };

  useEffect(() => {
    fetchSuggestions(debouncedSearch);
    return () => {
      if (abortControllerRef.current) abortControllerRef.current.abort();
    };
  }, [debouncedSearch]);

  const useCurrentLocation = async () => {
    setFetchingGPS(true);
    try {
      const enabled = await Location.hasServicesEnabledAsync();
      if (!enabled) {
        Alert.alert('Location Services Disabled', 'Please enable location services in your device settings.');
        return;
      }

      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location access is needed to find your address.');
        return;
      }

      let loc = null;
      try {
        loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
      } catch (err) {
        loc = await Location.getLastKnownPositionAsync({});
      }

      if (!loc) throw new Error('Could not fetch location');

      const coords = {
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        latitudeDelta: 0.005,
        longitudeDelta: 0.005,
      };

      setMapRegion(coords);
      setCurrentLocation(coords);

      const addr = await reverseGeocodeMappls(coords.latitude, coords.longitude);
      if (addr) {
        setAddress(addr);
        setSearchQuery(addr);
      }
      setShowMap(true);
      preserveSelectedAddressRef.current = true;
      cameraRef.current?.setCamera({ centerCoordinate: [coords.longitude, coords.latitude], zoomLevel: 16, animationDuration: 1000, animationMode: 'easeTo' });
    } catch (error) {
      Alert.alert('GPS Error', 'Could not determine your location. Please try again.');
    } finally {
      setFetchingGPS(false);
    }
  };

  const handleSelectSuggestion = async (item: any) => {
    try {
      setLoadingSuggestions(true);
      let latitude = parseFloat(item.lat);
      let longitude = parseFloat(item.lon);

      if (item.provider === 'mappls' && (!Number.isFinite(latitude) || !Number.isFinite(longitude))) {
        const mapplsPin = String(item.place_id).replace(/^mappls:\s*/, '');
        preserveSelectedAddressRef.current = true;
        setAddress(item.display_name);
        setSearchQuery('');
        setSuggestions([]);
        setSessionToken('');
        setShowMap(true);
        Keyboard.dismiss();
        setTimeout(() => {
          pendingMapplsSelectionRef.current = item;
          cameraRef.current?.setCamera({ centerMapplsPin: mapplsPin, zoomLevel: 16, animationDuration: 1000, animationMode: 'easeTo' });
        }, 100);
        return;
      }

      if (item.is_prediction && (!Number.isFinite(latitude) || !Number.isFinite(longitude))) {
        const BASE_URL = Constants.expoConfig?.extra?.BASE_URL;
        const url = `${BASE_URL}/api/location-details/?place_id=${encodeURIComponent(item.place_id)}&sessiontoken=${sessionToken}&q=${encodeURIComponent(item.display_name)}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Location details failed (${res.status})`);
        const details = await res.json();
        
        if (details.lat && details.lon) {
          latitude = parseFloat(details.lat);
          longitude = parseFloat(details.lon);
        } else {
          Alert.alert("Error", "Could not fetch location details.");
          return;
        }
      }

      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        Alert.alert("Error", "Could not fetch valid location coordinates.");
        return;
      }

      const coords = {
        latitude,
        longitude,
        latitudeDelta: 0.005,
        longitudeDelta: 0.005,
      };

      setMapRegion(coords);
      setCurrentLocation(coords);
      preserveSelectedAddressRef.current = true;
      setAddress(item.display_name);
      setSearchQuery('');
      setSuggestions([]);
      setSessionToken(''); 
      setShowMap(true); 
      Keyboard.dismiss();

      await LocationStorage.saveLocation({
        id: item.place_id,
        display_name: item.display_name,
        lat: latitude.toString(),
        lon: longitude.toString(),
        place_id: item.place_id
      });
      
      const updatedRecent = await LocationStorage.getRecentLocations();
      setRecentLocations(updatedRecent);
      
      setTimeout(() => cameraRef.current?.setCamera({ centerCoordinate: [coords.longitude, coords.latitude], zoomLevel: 16, animationDuration: 1000, animationMode: 'easeTo' }), 100);
    } catch (error) {
      Alert.alert("Error", "Something went wrong while selecting location.");
    } finally {
      setLoadingSuggestions(false);
    }
  };

  const onRegionChangeComplete = async (feature: GeoJSON.Feature<GeoJSON.Point, RegionPayload>) => {
    const [longitude, latitude] = feature.geometry.coordinates;
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;
    const region = { latitude, longitude, latitudeDelta: mapRegion.latitudeDelta, longitudeDelta: mapRegion.longitudeDelta };
    setMapRegion(region);
    setCurrentLocation(region);

    const pendingSelection = pendingMapplsSelectionRef.current;
    if (pendingSelection) {
      pendingMapplsSelectionRef.current = null;
      preserveSelectedAddressRef.current = false;
      await LocationStorage.saveLocation({
        id: pendingSelection.place_id,
        display_name: pendingSelection.display_name,
        lat: latitude.toString(),
        lon: longitude.toString(),
        place_id: pendingSelection.place_id,
      });
      setRecentLocations(await LocationStorage.getRecentLocations());
      return;
    }

    if (preserveSelectedAddressRef.current || !feature.properties.isUserInteraction) {
      preserveSelectedAddressRef.current = false;
      return;
    }

    const requestId = ++reverseGeocodeRequest.current;
    setResolvingPin(true);
    try {
      const nextAddress = await reverseGeocodeMappls(region.latitude, region.longitude);
      if (requestId !== reverseGeocodeRequest.current) return;
      if (nextAddress) setAddress(nextAddress);
    } catch {
      // Keep the selected coordinates when Mappls reverse-geocoding is unavailable.
    } finally {
      if (requestId === reverseGeocodeRequest.current) setResolvingPin(false);
    }
  };

  const openMap = () => {
    setShowMap(true);
  };

  return (
    <Modal visible animationType="none" transparent>
      <Animated.View style={[styles.masterContainer, { opacity: fadeAnim }]}>
        
        {/* Map Background */}
        {showMap ? (
          <>
          <MapView
            style={styles.map}
            onRegionDidChange={onRegionChangeComplete}
            onMapError={(error) => console.error('Mappls map error:', error.code, error.message)}
            logoEnabled
            attributionEnabled
            compassEnabled
          >
            <Camera ref={cameraRef} defaultSettings={{ centerCoordinate: [mapRegion.longitude, mapRegion.latitude], zoomLevel: 16 }} />
            <UserLocation visible />
          </MapView>
          <View pointerEvents="none" style={styles.centerPinWrap}>
            <View style={styles.centerPinHalo} />
            <View style={styles.centerPin}>
              <Ionicons name="location" size={25} color="#ffffff" />
            </View>
            <View style={styles.centerPinShadow} />
            <Text style={styles.moveMapHint}>{resolvingPin ? 'Finding address…' : 'Move map to adjust pin'}</Text>
          </View>
          </>
        ) : (
          <View style={styles.emptyMapPlaceholder}>
            <LinearGradient
              colors={['#f8fafc', '#e2e8f0']}
              style={StyleSheet.absoluteFillObject}
            />
            <MaterialIcons name="travel-explore" size={80} color="#cbd5e1" />
            <Text style={styles.placeholderTitle}>Where to?</Text>
            <Text style={styles.placeholderSubtitle}>Find your exact location to get started</Text>
          </View>
        )}

        {/* Top Search Hub */}
        <Animated.View style={[styles.topControlHub, { transform: [{ translateY: Animated.multiply(slideAnim, -1) }] }]}>
          <BlurView intensity={40} tint="light" style={styles.searchBarContainer}>
            <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.backButton}>
              <Feather name="arrow-left" size={24} color="#334155" />
            </TouchableOpacity>
            
            <TextInput
              placeholder="Search for building, street, or area..."
              placeholderTextColor="#94a3b8"
              style={styles.searchInput}
              value={searchQuery}
              onChangeText={setSearchQuery}
              onFocus={ensureSessionToken}
              autoCapitalize="words"
            />
            
            {loadingSuggestions ? (
              <ActivityIndicator color="#059669" style={styles.loadingIndicator} />
            ) : searchQuery.length > 0 ? (
              <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearButton}>
                <Feather name="x" size={18} color="#94a3b8" />
              </TouchableOpacity>
            ) : (
              <Feather name="search" size={20} color="#94a3b8" style={styles.loadingIndicator} />
            )}
          </BlurView>

          {/* Suggestions Dropdown */}
          {(suggestions.length > 0 || (searchQuery.length === 0 && recentLocations.length > 0)) && (
            <BlurView intensity={50} tint="light" style={styles.suggestionsCard}>
              <FlatList
                data={searchQuery.length > 0 ? suggestions : recentLocations}
                keyExtractor={(item) => (item.place_id || item.id).toString()}
                keyboardShouldPersistTaps="handled"
                renderItem={({ item }) => (
                  <TouchableOpacity
                    onPress={() => handleSelectSuggestion(item)}
                    style={styles.suggestionItem}
                    activeOpacity={0.7}
                  >
                    <View style={styles.suggestionIcon}>
                      <MaterialIcons 
                        name={searchQuery.length > 0 ? "location-on" : "history"} 
                        size={20} 
                        color={searchQuery.length > 0 ? "#059669" : "#64748b"} 
                      />
                    </View>
                    <View style={styles.suggestionTextContainer}>
                      <Text style={styles.suggestionTitle} numberOfLines={1}>
                        {item.display_name.split(',')[0]}
                      </Text>
                      <Text style={styles.suggestionSubtitle} numberOfLines={1}>
                        {item.display_name.substring(item.display_name.indexOf(',') + 1).trim() || "Location"}
                      </Text>
                      {item.provider === 'mappls' && <Text style={styles.providerBadge}>MAPPLS RESULT</Text>}
                    </View>
                  </TouchableOpacity>
                )}
              />
            </BlurView>
          )}
        </Animated.View>

        {/* Floating Controls */}
        <View style={styles.floatingControls}>
          {!showMap && (
             <TouchableOpacity
             onPress={openMap}
             style={styles.secondaryFloatingBtn}
             activeOpacity={0.8}
           >
             <Feather name="map" size={22} color="#475569" />
           </TouchableOpacity>
          )}
          
          <TouchableOpacity
            onPress={useCurrentLocation}
            style={styles.currentLocFloatingBtn}
            activeOpacity={0.8}
            disabled={fetchingGPS}
          >
            {fetchingGPS ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <MaterialIcons name="my-location" size={24} color="#ffffff" />
            )}
          </TouchableOpacity>
        </View>

        {/* Premium Bottom Sheet */}
        <Animated.View style={[styles.bottomCardWrapper, { transform: [{ translateY: slideAnim }] }]}>
          <View style={styles.bottomCard}>
            <View style={styles.handle} />
            
            <View style={styles.cardHeader}>
              <View>
                <Text style={styles.cardTitle}>CONFIRM DELIVERY LOCATION</Text>
                <Text style={styles.cardSubtitle}>Your order will be delivered to this pin</Text>
              </View>
              <View style={styles.accuracyPill}>
                <View style={styles.accuracyDot} />
                <Text style={styles.accuracyText}>Mappls</Text>
              </View>
            </View>
            
            <View style={styles.addressBox}>
              <View style={styles.addressIconWrapper}>
                <Ionicons name="location" size={24} color="#059669" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.addressTitle}>DELIVERING TO</Text>
                <Text style={styles.addressText} numberOfLines={2}>
                  {address || "Pinpoint your exact location on the map"}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              onPress={() => setModalVisible(false)}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={['#10b981', '#059669']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.confirmBtn}
              >
                <Text style={styles.confirmBtnText}>Confirm Location</Text>
                <Feather name="arrow-right" size={20} color="white" />
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  masterContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  topControlHub: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 52 : 24,
    left: 14,
    right: 14,
    zIndex: 10,
  },
  deliveryHeader: {
    minHeight: 58, flexDirection: 'row', alignItems: 'center', marginBottom: 10,
    paddingHorizontal: 4,
  },
  deliveryHeaderIcon: {
    width: 34, height: 34, borderRadius: 12, backgroundColor: '#059669', alignItems: 'center', justifyContent: 'center',
    shadowColor: '#059669', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.28, shadowRadius: 10, elevation: 6,
  },
  deliveryHeaderCopy: { flex: 1, marginLeft: 11 },
  deliveryEyebrow: { fontSize: 9, fontWeight: '900', color: '#64748b', letterSpacing: 1.5 },
  deliveryHeading: { marginTop: 2, fontSize: 16, fontWeight: '900', color: '#0f172a' },
  secureBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, height: 30, borderRadius: 15,
    backgroundColor: 'rgba(236, 253, 245, 0.96)', borderWidth: 1, borderColor: '#a7f3d0',
  },
  secureBadgeText: { fontSize: 10, fontWeight: '800', color: '#047857' },
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 18,
    height: 62,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.14,
    shadowRadius: 18,
    elevation: 10,
    overflow: 'hidden',
  },
  backButton: {
    paddingHorizontal: 17,
    paddingVertical: 16,
  },
  searchInput: {
    flex: 1,
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '600',
  },
  clearButton: {
    padding: 16,
  },
  loadingIndicator: {
    marginRight: 16,
  },
  suggestionsCard: {
    backgroundColor: '#ffffff',
    marginTop: 10,
    borderRadius: 22,
    paddingTop: 8,
    paddingBottom: 10,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.4)',
    maxHeight: 390,
  },
  currentLocationRow: {
    flexDirection: 'row', alignItems: 'center', marginHorizontal: 10, paddingHorizontal: 10, paddingVertical: 11,
    borderRadius: 16, backgroundColor: '#ecfdf5', borderWidth: 1, borderColor: '#d1fae5',
  },
  currentLocationIcon: { width: 40, height: 40, borderRadius: 14, backgroundColor: '#ffffff', alignItems: 'center', justifyContent: 'center' },
  currentLocationCopy: { flex: 1, marginLeft: 12 },
  currentLocationTitle: { fontSize: 14, fontWeight: '800', color: '#047857' },
  currentLocationSubtitle: { marginTop: 2, fontSize: 11, fontWeight: '600', color: '#6b7280' },
  resultsHeadingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingRight: 18, marginTop: 8 },
  mapplsPowered: { fontSize: 9, fontWeight: '700', color: '#94a3b8' },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(241, 245, 249, 0.8)',
  },
  suggestionIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: '#f0fdf4',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  suggestionTextContainer: {
    flex: 1,
  },
  suggestionTitle: {
    color: '#1e293b',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 2,
  },
  suggestionSubtitle: {
    color: '#64748b',
    fontSize: 13,
    fontWeight: '500',
  },
  currentLocFloatingBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#0f172a',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  secondaryFloatingBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 15,
    elevation: 8,
    marginBottom: 16,
  },
  floatingControls: {
    position: 'absolute',
    bottom: 286,
    right: 20,
    alignItems: 'center',
  },
  emptyMapPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderTitle: {
    marginTop: 24,
    color: '#334155',
    fontSize: 24,
    fontWeight: '800',
  },
  placeholderSubtitle: {
    marginTop: 8,
    color: '#64748b',
    fontSize: 15,
    fontWeight: '500',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: '800',
    color: '#94a3b8',
    letterSpacing: 1.2,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 4,
  },
  pickOnMapText: {
    color: '#059669',
    fontSize: 13,
    fontWeight: '700',
  },
  bottomCardWrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -20 },
    shadowOpacity: 0.1,
    shadowRadius: 30,
    elevation: 40,
  },
  bottomCard: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 38 : 22,
  },
  handle: {
    width: 40,
    height: 5,
    backgroundColor: '#e2e8f0',
    borderRadius: 10,
    alignSelf: 'center',
    marginBottom: 20,
  },
  cardSubtitle: { marginTop: 5, fontSize: 12, fontWeight: '600', color: '#64748b' },
  accuracyPill: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#ecfdf5', paddingHorizontal: 10, height: 28, borderRadius: 14 },
  accuracyDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#10b981' },
  accuracyText: { fontSize: 10, fontWeight: '800', color: '#047857' },
  cardTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#94a3b8',
    letterSpacing: 1.5,
  },
  addressBox: {
    flexDirection: 'row',
    backgroundColor: '#f8fafc',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 18,
    alignItems: 'center',
  },
  addressIconWrapper: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#ecfdf5',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  addressTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  addressText: {
    color: '#0f172a',
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 22,
  },
  confirmBtn: {
    borderRadius: 18,
    height: 62,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 15,
    elevation: 10,
  },
  confirmBtnCopy: { flex: 1 },
  confirmBtnHint: { marginTop: 2, color: 'rgba(255,255,255,0.78)', fontSize: 10, fontWeight: '600' },
  confirmArrow: { width: 36, height: 36, borderRadius: 12, backgroundColor: '#ffffff', alignItems: 'center', justifyContent: 'center' },
  confirmBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginRight: 0,
  },
  providerBadge: {
    color: '#047857', fontSize: 9, fontWeight: '800', letterSpacing: 0.8, marginTop: 4,
  },
  centerPinWrap: {
    position: 'absolute', top: '50%', left: '50%', alignItems: 'center',
    transform: [{ translateX: -70 }, { translateY: -58 }], width: 140,
  },
  centerPinHalo: {
    position: 'absolute', top: 4, width: 54, height: 54, borderRadius: 27,
    backgroundColor: 'rgba(5, 150, 105, 0.16)',
  },
  centerPin: {
    width: 46, height: 46, borderRadius: 23, backgroundColor: '#059669',
    borderWidth: 4, borderColor: '#ffffff', alignItems: 'center', justifyContent: 'center', elevation: 12,
  },
  centerPinShadow: {
    width: 18, height: 6, borderRadius: 9, backgroundColor: 'rgba(15, 23, 42, 0.24)', marginTop: 6,
  },
  moveMapHint: {
    marginTop: 10, backgroundColor: 'rgba(15, 23, 42, 0.86)', color: '#ffffff',
    fontSize: 11, fontWeight: '700', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 14, overflow: 'hidden',
  },
  markerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerCore: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#0f172a',
    borderWidth: 3,
    borderColor: '#ffffff',
    zIndex: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 5,
  },
  markerPulse: {
    position: 'absolute',
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(15, 23, 42, 0.15)',
    zIndex: 1,
  }
});

export default MapModal;
