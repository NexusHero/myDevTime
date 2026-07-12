// Expo preset + the Reanimated plugin (must be last) for the UI-thread stopwatch
// (ReanimatedTimer, ADR-0039 direction).
module.exports = function (api) {
  api.cache(true)
  return {
    presets: ['babel-preset-expo'],
    plugins: ['react-native-reanimated/plugin'],
  }
}
