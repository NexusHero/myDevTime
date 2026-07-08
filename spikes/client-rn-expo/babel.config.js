// Expo + Reanimated. The reanimated plugin MUST be last — it rewrites worklets
// (the Day Canvas gesture math runs on the UI thread; see src/canvas/layout.ts).
module.exports = function (api) {
  api.cache(true)
  return {
    presets: ['babel-preset-expo'],
    plugins: ['react-native-reanimated/plugin'],
  }
}
