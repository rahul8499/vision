const app = require('./app.json');
module.exports = () => ({
  ...app.expo,
  extra: { ...app.expo.extra, BASE_URL: process.env.EXPO_PUBLIC_BASE_URL || app.expo.extra.BASE_URL },
});
