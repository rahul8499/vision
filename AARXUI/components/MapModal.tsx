import { Platform } from 'react-native';

// Platform-specific imports
const MapModalComponent = Platform.select({
  android: () => require('./components/MapModal.android').default,
  web: () => require('./components/MapModal.web').default,
});

// Ensure MapModalComponent is not undefined
if (!MapModalComponent) {
  throw new Error('MapModal component is not available for this platform.');
}

const MapModal = MapModalComponent(); // Execute the function to get the component

export default MapModal;
