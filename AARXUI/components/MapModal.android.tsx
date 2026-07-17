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
  Dimensions,
  FlatList,
  Keyboard,
  Modal,
  Platform,
  StyleSheet,
  TouchableOpacity,
  View
} from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { LocationStorage, RecentLocation } from '../utils/LocationStorage';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

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
  
  const mapRef = useRef<MapView>(null);
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

      searchCache.current.set(query, data);
      setSuggestions(data);
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

      const revGeo = await Location.reverseGeocodeAsync({
        latitude: coords.latitude,
        longitude: coords.longitude,
      });

      if (revGeo && revGeo.length > 0) {
        const place = revGeo[0];
        const addr = [
          place.name, place.street, place.district, place.city, place.region, place.postalCode
        ].filter(Boolean).join(', ');
        
        setAddress(addr);
        setSearchQuery(addr);
      }
      setShowMap(true);
      mapRef.current?.animateToRegion(coords, 1000);
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

      if (item.is_prediction && (!latitude || !longitude)) {
        const BASE_URL = Constants.expoConfig?.extra?.BASE_URL;
        const url = `${BASE_URL}/api/location-details/?place_id=${item.place_id}&sessiontoken=${sessionToken}`;
        const res = await fetch(url);
        const details = await res.json();
        
        if (details.lat && details.lon) {
          latitude = parseFloat(details.lat);
          longitude = parseFloat(details.lon);
        } else {
          Alert.alert("Error", "Could not fetch location details.");
          return;
        }
      }

      const coords = {
        latitude,
        longitude,
        latitudeDelta: 0.005,
        longitudeDelta: 0.005,
      };

      setMapRegion(coords);
      setCurrentLocation(coords);
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
      
      setTimeout(() => mapRef.current?.animateToRegion(coords, 1000), 100);
    } catch (error) {
      Alert.alert("Error", "Something went wrong while selecting location.");
    } finally {
      setLoadingSuggestions(false);
    }
  };

  const onRegionChangeComplete = (region: LocationCoords) => {
    if (region && !isNaN(region.latitude) && !isNaN(region.longitude)) {
      setMapRegion(region);
    }
  };

  return (
    <Modal visible animationType="none" transparent>
      <Animated.View style={[styles.masterContainer, { opacity: fadeAnim }]}>
        
        {/* Map Background */}
        {showMap ? (
          <MapView
            ref={mapRef}
            style={styles.map}
            region={mapRegion}
            onRegionChangeComplete={onRegionChangeComplete}
            showsUserLocation={true}
            showsMyLocationButton={false}
             // Premium map style
          >
            <Marker coordinate={mapRegion}>
              <View style={styles.markerContainer}>
                <View style={styles.markerCore} />
                <View style={styles.markerPulse} />
              </View>
            </Marker>
          </MapView>
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
              {searchQuery.length === 0 && recentLocations.length > 0 && (
                <Text style={styles.sectionHeader}>RECENTLY SEARCHED</Text>
              )}
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
             onPress={() => setShowMap(true)}
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
              <Text style={styles.cardTitle}>CONFIRM LOCATION</Text>
              {!showMap && (
                <TouchableOpacity onPress={() => setShowMap(true)}>
                  <Text style={styles.pickOnMapText}>Pick on Map</Text>
                </TouchableOpacity>
              )}
            </View>
            
            <View style={styles.addressBox}>
              <View style={styles.addressIconWrapper}>
                <Ionicons name="location" size={24} color="#059669" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.addressTitle}>Delivery Address</Text>
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
    top: Platform.OS === 'ios' ? 50 : 30,
    left: 16,
    right: 16,
    zIndex: 10,
  },
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    borderRadius: 20,
    height: 60,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.5)',
    overflow: 'hidden',
  },
  backButton: {
    padding: 16,
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
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    marginTop: 12,
    borderRadius: 24,
    paddingVertical: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.4)',
    maxHeight: 300,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(241, 245, 249, 0.8)',
  },
  suggestionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
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
    bottom: 250,
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
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 24,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
  },
  handle: {
    width: 40,
    height: 5,
    backgroundColor: '#e2e8f0',
    borderRadius: 10,
    alignSelf: 'center',
    marginBottom: 20,
  },
  cardTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#94a3b8',
    letterSpacing: 1.5,
  },
  addressBox: {
    flexDirection: 'row',
    backgroundColor: '#f8fafc',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 24,
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
    borderRadius: 20,
    height: 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 15,
    elevation: 10,
  },
  confirmBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginRight: 12,
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

const mapStyle = [
  {
    "featureType": "all",
    "elementType": "geometry",
    "stylers": [{"color": "#f3f4f6"}]
  },
  {
    "featureType": "all",
    "elementType": "labels.text.fill",
    "stylers": [{"color": "#64748b"}]
  },
  {
    "featureType": "all",
    "elementType": "labels.text.stroke",
    "stylers": [{"color": "#ffffff"}]
  },
  {
    "featureType": "poi",
    "elementType": "geometry",
    "stylers": [{"color": "#e2e8f0"}]
  },
  {
    "featureType": "road",
    "elementType": "geometry",
    "stylers": [{"color": "#ffffff"}]
  },
  {
    "featureType": "road.arterial",
    "elementType": "labels.icon",
    "stylers": [{"visibility": "off"}]
  },
  {
    "featureType": "water",
    "elementType": "geometry",
    "stylers": [{"color": "#cbd5e1"}]
  }
];

export default MapModal;
