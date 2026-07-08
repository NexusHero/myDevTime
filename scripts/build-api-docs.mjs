#!/usr/bin/env node
// Build a static, read-only mirror of the OpenAPI reference for GitHub Pages
// (ADR-0016). The interactive docs for real calls live at the running server's
// /documentation (served by @fastify/swagger-ui). This mirror is for browsing
// only, so "Try it out" is disabled — it isn't authenticated against a live
// server.
//
// Assets are copied from the @fastify/swagger-ui package we already depend on
// (its bundled static/ folder), so there is no CDN and no extra dependency —
// same self-hosting reasoning as the in-app docs.
//
// Usage: node scripts/build-api-docs.mjs [outDir]   (default: dist-pages)
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { cpSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')
const out = resolve(root, process.argv[2] ?? 'dist-pages')

// 1. Generate the OpenAPI spec fresh from the running app definition.
const apiDir = join(root, 'apps', 'api')
execFileSync('pnpm', ['--filter', '@mydevtime/api', 'openapi:emit'], {
  cwd: root,
  stdio: 'inherit',
})

// 2. Locate the self-hosted swagger-ui assets bundled with @fastify/swagger-ui.
const require = createRequire(join(apiDir, 'package.json'))
const swaggerUiStatic = join(dirname(require.resolve('@fastify/swagger-ui/package.json')), 'static')

// 3. Assemble the static mirror.
rmSync(out, { recursive: true, force: true })
mkdirSync(out, { recursive: true })

for (const asset of ['swagger-ui.css', 'swagger-ui-bundle.js', 'swagger-ui-standalone-preset.js']) {
  cpSync(join(swaggerUiStatic, asset), join(out, asset))
}
cpSync(join(apiDir, 'openapi.json'), join(out, 'openapi.json'))

writeFileSync(
  join(out, 'index.html'),
  `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>myDevTime API — Swagger UI</title>
<link rel="stylesheet" href="swagger-ui.css" />
</head>
<body>
<div id="swagger-ui"></div>
<script src="swagger-ui-bundle.js" charset="UTF-8"></script>
<script src="swagger-ui-standalone-preset.js" charset="UTF-8"></script>
<script src="swagger-initializer.js" charset="UTF-8"></script>
</body>
</html>
`,
)

writeFileSync(
  join(out, 'swagger-initializer.js'),
  `window.onload = function () {
  window.ui = SwaggerUIBundle({
    url: 'openapi.json',
    dom_id: '#swagger-ui',
    deepLinking: true,
    presets: [SwaggerUIBundle.presets.apis, SwaggerUIStandalonePreset],
    supportedSubmitMethods: [],
  });
};
`,
)

console.log(`✓ built ${out}/ — static Swagger UI mirror (read-only, self-hosted)`)
