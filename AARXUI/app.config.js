const app = require('./app.json');
module.exports = () => ({
  ...app.expo,
  extra: {
    ...app.expo.extra,
    BASE_URL: process.env.EXPO_PUBLIC_BASE_URL,
    GOOGLE_MAPS_API_KEY_CONFIGURED: Boolean(process.env.GOOGLE_MAPS_API_KEY),
  },
  android: {
    ...app.expo.android,
    config: process.env.GOOGLE_MAPS_API_KEY
      ? { ...(app.expo.android?.config || {}), googleMaps: { apiKey: process.env.GOOGLE_MAPS_API_KEY } }
      : app.expo.android?.config,
  },
});
