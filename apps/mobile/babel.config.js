// Expo preset. (Reanimated isn't a dependency yet — the shell scaffold uses only
// core RN; its plugin is added with the Day Canvas in a later phase of #11.)
module.exports = function (api) {
  api.cache(true)
  return { presets: ['babel-preset-expo'] }
}
