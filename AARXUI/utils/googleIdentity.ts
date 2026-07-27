import Constants from 'expo-constants';

let configuredClientId = '';

function getGoogleModule() {
  // Loaded only when the button is pressed so an older dev-client build can
  // still open the app and show a useful rebuild/configuration error.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('@react-native-google-signin/google-signin') as typeof import('@react-native-google-signin/google-signin');
}

function configureGoogle() {
  const webClientId = String(
    Constants.expoConfig?.extra?.GOOGLE_WEB_CLIENT_ID || '',
  ).trim();
  if (!webClientId) {
    throw new Error('Google Sign-In client ID is not configured.');
  }
  if (configuredClientId !== webClientId) {
    const { GoogleSignin } = getGoogleModule();
    GoogleSignin.configure({
      webClientId,
      offlineAccess: false,
    });
    configuredClientId = webClientId;
  }
}

export async function getGoogleIdToken() {
  configureGoogle();
  const { GoogleSignin, isSuccessResponse } = getGoogleModule();
  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  const response = await GoogleSignin.signIn();
  if (!isSuccessResponse(response)) return null;
  if (!response.data.idToken) {
    throw new Error('Google did not return an identity token.');
  }
  return response.data.idToken;
}
