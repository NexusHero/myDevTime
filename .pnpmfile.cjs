// pnpm install hook — keep build tooling out of the production API image (ADR-0078).
//
// better-auth and drizzle-orm declare a long list of *optional* peer dependencies
// (test runners, UI frameworks, alternative database drivers). pnpm satisfies an
// optional peer whenever a matching package exists anywhere in the workspace — so
// better-auth got linked to the API's dev-only drizzle-kit, the root's vitest and the
// mobile app's react, and drizzle-orm to the mobile app's expo-sqlite. `pnpm deploy
// --prod` follows those edges, which put Expo, Metro, esbuild binaries and drizzle-kit
// (648 MB of node_modules, several CRITICAL findings) into the server image.
//
// The API uses none of them at runtime: it talks to Postgres through `postgres`
// (postgres-js) and runs migrations with drizzle-orm's own migrator. Dropping these
// optional peers changes nothing they would do, only what gets installed beside them.
// The lockfile records this file's checksum, so the effect is reproducible; the
// Dockerfiles copy it before `pnpm install`.

const DROP_OPTIONAL_PEERS = {
  'better-auth': ['drizzle-kit', 'vitest', 'react', 'react-dom'],
  'drizzle-orm': ['expo-sqlite', 'gel', 'kysely'],
}

function readPackage(pkg) {
  const drop = DROP_OPTIONAL_PEERS[pkg.name]
  if (!drop) return pkg
  for (const name of drop) {
    // Only ever remove a peer the package itself marks optional.
    if (pkg.peerDependenciesMeta?.[name]?.optional !== true) continue
    delete pkg.peerDependencies[name]
    delete pkg.peerDependenciesMeta[name]
  }
  return pkg
}

module.exports = { hooks: { readPackage } }
