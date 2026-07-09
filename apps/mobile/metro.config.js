const { getDefaultConfig } = require('expo/metro-config')
const path = require('path')

const projectRoot = __dirname
const monorepoRoot = path.resolve(projectRoot, '../..')

const config = getDefaultConfig(projectRoot)

// Watch all files within the monorepo
config.watchFolders = [monorepoRoot]

// Let Metro resolve packages from both project node_modules and monorepo node_modules
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
]

// Enable symlinks for pnpm support
config.resolver.unstable_enableSymlinks = true
// Enable package exports support
config.resolver.unstable_enablePackageExports = true

// Custom resolver to redirect relative .js imports to .ts/.tsx files
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName.endsWith('.js') && (moduleName.startsWith('./') || moduleName.startsWith('../'))) {
    const candidateName = moduleName.slice(0, -3)
    try {
      return context.resolveRequest(context, candidateName, platform)
    } catch {
      // Fallback to original module resolution if candidate resolution fails
    }
  }
  return context.resolveRequest(context, moduleName, platform)
}

module.exports = config
