# Google Sign-In setup

The app code never auto-merges users by email. A phone-authenticated user must
link Google first. Later Google login looks up only the verified Google `sub`
stored on that same AARX user.

## Firebase / Google Cloud

1. Open the Firebase project used by `AARXUI/google-services.json`.
2. Enable **Authentication → Sign-in method → Google**.
3. In the Android app (`com.anonymous.AARXUI`), add the SHA-1 and SHA-256
   fingerprints for the development/release signing keys.
4. Download the refreshed `google-services.json` and replace
   `AARXUI/google-services.json`. Its `oauth_client` list must no longer be
   empty.
5. Create/select an OAuth 2.0 **Web application** client. Use that Web client
   ID in both configuration files below. Do not use the Android client ID as
   the backend audience.

## Environment

In `AARXUI/.env`:

```dotenv
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=123456789-example.apps.googleusercontent.com
```

In `django/.env`:

```dotenv
GOOGLE_OAUTH_WEB_CLIENT_ID=123456789-example.apps.googleusercontent.com
```

Both values must be identical.

## Rebuild

Google Sign-In contains native code. Restarting Metro is not enough after the
first installation:

```bash
cd AARXUI
npx expo run:android
```

Then restart the project with `./start.sh`.
