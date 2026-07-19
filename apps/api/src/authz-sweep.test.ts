import 'reflect-metadata'
import { RequestMethod } from '@nestjs/common'
import { describe, expect, it } from 'vitest'
import { loadConfig } from './config.js'
import { AppModule } from './app.module.js'
import { AuthGuard } from './modules/auth/contract.js'

/**
 * Authorization sweep (REQ-019, issue #24). A structural guard against the most
 * expensive class of security regression: a new HTTP route that quietly ships
 * without authentication.
 *
 * Rather than trust a reviewer to spot a missing `@UseGuards(AuthGuard)`, this
 * test reflects over the ACTUAL Nest module graph — `AppModule.forRoot(...)`, the
 * same composition root the server boots — discovers every controller and every
 * route handler on it, and asserts each route is EITHER covered by the shared
 * `AuthGuard` (class-level or method-level) OR listed on the explicit, justified
 * public-route allowlist below. A newly added controller or route is discovered
 * automatically (it is read from module metadata, not a hand-maintained import
 * list), so an unguarded newcomer fails this test loudly the moment it lands.
 *
 * No database is needed: `forRoot` only builds the DI metadata graph (no factory
 * runs, no connection opens), and guard coverage is decorator metadata. The test
 * therefore always runs — it is never skipped for want of a `DATABASE_URL`.
 */

/**
 * Nest's decorator metadata keys, mirrored from `@nestjs/common/constants`. That
 * module is a deep subpath which pnpm's symlinked `node_modules` layout under
 * `moduleResolution: NodeNext` cannot type-resolve from an app package (the JS
 * resolves, the `.d.ts` does not). These string keys are Nest's documented,
 * stable decorator contract — `@UseGuards`, `@Get`/`@Post`, `@Module` all write
 * them — and change only on a major internal rework, which this same test would
 * catch (discovery would go empty and the floor assertions below would fail).
 */
const GUARDS_METADATA = '__guards__'
const PATH_METADATA = 'path'
const METHOD_METADATA = 'method'
const CONTROLLERS_METADATA = 'controllers'
const IMPORTS_METADATA = 'imports'

/** A controller constructor as recovered from module metadata. */
type Ctor = (new (...args: never[]) => object) & {
  readonly name: string
  readonly prototype: object
}

/** Read decorator metadata at the `any`→`unknown` boundary (no unsafe leakage upstream). */
function getMeta(key: string, target: object): unknown {
  return Reflect.getMetadata(key, target) as unknown
}

function toArray(value: unknown): readonly unknown[] {
  return Array.isArray(value) ? (value as readonly unknown[]) : []
}

/** True when `AuthGuard` is among the guards attached to a class or a method. */
function hasAuthGuard(target: object): boolean {
  const guards = getMeta(GUARDS_METADATA, target)
  return toArray(guards).some(
    // `@UseGuards(AuthGuard)` records the class; instances are tolerated too.
    g => g === AuthGuard || (typeof g === 'object' && g !== null && g instanceof AuthGuard),
  )
}

function segments(path: unknown): readonly string[] {
  return typeof path === 'string' ? path.split('/').filter(s => s.length > 0) : []
}

/** Join a controller base path and a handler path into one canonical `/a/b/c`. */
function joinPath(controllerPath: unknown, methodPath: unknown): string {
  return `/${[...segments(controllerPath), ...segments(methodPath)].join('/')}`
}

/**
 * Walk the module graph from the real composition root and collect every
 * controller declared anywhere in it. Traversal reads `controllers`/`imports`
 * off both static module classes and dynamic modules, deduping by identity, so
 * a controller added to any imported module is picked up without editing this
 * test.
 */
function collectControllers(): readonly Ctor[] {
  const config = loadConfig({ LOG_LEVEL: 'silent' })
  const root = AppModule.forRoot({ config, db: null })
  const found = new Set<Ctor>()
  const seen = new Set<unknown>()
  const queue: unknown[] = [...toArray(root.imports)]

  while (queue.length > 0) {
    const entry = queue.shift()
    if (entry === undefined || entry === null || seen.has(entry)) continue
    seen.add(entry)

    let controllers: unknown
    let imports: unknown
    if (typeof entry === 'function') {
      controllers = getMeta(CONTROLLERS_METADATA, entry)
      imports = getMeta(IMPORTS_METADATA, entry)
    } else if (typeof entry === 'object') {
      const dynamic = entry as { controllers?: unknown; imports?: unknown }
      controllers = dynamic.controllers
      imports = dynamic.imports
    }

    for (const controller of toArray(controllers)) {
      if (typeof controller === 'function') found.add(controller as Ctor)
    }
    for (const imported of toArray(imports)) queue.push(imported)
  }

  return [...found]
}

interface Route {
  readonly controller: string
  readonly key: string
  readonly guarded: boolean
}

/** Enumerate every route handler across the discovered controllers. */
function collectRoutes(controllers: readonly Ctor[]): readonly Route[] {
  const routes: Route[] = []
  for (const controller of controllers) {
    const classGuarded = hasAuthGuard(controller)
    const controllerPath = getMeta(PATH_METADATA, controller)
    const proto = controller.prototype
    for (const name of Object.getOwnPropertyNames(proto)) {
      if (name === 'constructor') continue
      const handler = Object.getOwnPropertyDescriptor(proto, name)?.value as unknown
      if (typeof handler !== 'function') continue
      const methodPath = getMeta(PATH_METADATA, handler)
      // A method with no route path is a plain helper, not an HTTP handler.
      if (methodPath === undefined) continue
      const methodMeta = getMeta(METHOD_METADATA, handler)
      const httpMethod =
        (typeof methodMeta === 'number' ? RequestMethod[methodMeta] : 'ALL') ?? 'ALL'
      const path = joinPath(controllerPath, methodPath)
      routes.push({
        controller: controller.name,
        key: `${httpMethod} ${path}`,
        guarded: classGuarded || hasAuthGuard(handler),
      })
    }
  }
  return routes
}

/**
 * The intentionally-public route allowlist. Every entry is a route that is public
 * BY DESIGN; each carries the reason it is exempt from `AuthGuard`. Adding a route
 * here is a deliberate security decision — the reviewer must justify it. Anything
 * not on this list must be guarded.
 */
const PUBLIC_ROUTES: readonly { readonly key: string; readonly why: string }[] = [
  // Liveness/readiness probes for the platform (load balancer, k8s). No identity
  // to assert; they expose only up/down + dependency reachability, no tenant data.
  { key: 'GET /health', why: 'liveness probe' },
  { key: 'GET /health/ready', why: 'readiness probe' },
  // Per-module capability/status pings. Each returns a static `{ module, status }`
  // shape (no workspace data) so unauthenticated clients can detect a module is
  // mounted; kept unguarded for boundary parity with the health probes.
  { key: 'GET /api/ai/status', why: 'module status ping (static, no tenant data)' },
  { key: 'GET /api/auth/status', why: 'auth config ping (static, no tenant data)' },
  { key: 'GET /api/automation/status', why: 'module status ping (static, no tenant data)' },
  { key: 'GET /api/planner/status', why: 'module status ping (static, no tenant data)' },
  { key: 'GET /api/absences/status', why: 'module status ping (static, no tenant data)' },
  { key: 'GET /api/billing/status', why: 'module status ping (static, no tenant data)' },
  { key: 'GET /api/tracking/status', why: 'module status ping (static, no tenant data)' },
  { key: 'GET /api/worktime/status', why: 'module status ping (static, no tenant data)' },
  // The sign-in UI needs to know which social providers are configured BEFORE a
  // session exists; returns only provider ids/labels, never secrets.
  { key: 'GET /api/auth/providers', why: 'pre-login provider discovery (no secrets)' },
  // Stripe → us. Authenticated by the Stripe-Signature HMAC over the raw body
  // (not a user session), so a session guard is inapplicable; a bad signature is
  // rejected inside the handler. Also `@SkipThrottle`d per ADR-0050.
  { key: 'POST /api/billing/stripe/webhook', why: 'Stripe webhook, signature-authenticated' },
  // A shared free/busy link: the opaque capability token IS the credential, and
  // only busy spans + free gaps cross the boundary (never a detail column).
  { key: 'GET /api/sharing/:token/freebusy', why: 'capability-token shared free/busy link' },
] as const

describe('authorization sweep (REQ-019)', () => {
  const controllers = collectControllers()
  const routes = collectRoutes(controllers)
  const allowlist = new Map(PUBLIC_ROUTES.map(r => [r.key, r.why]))

  it('discovers the controllers and routes from the real module graph', () => {
    // Guards against a silently-empty sweep (e.g. a discovery refactor that stops
    // finding controllers): the assertions below would then be vacuously green.
    expect(controllers.length).toBeGreaterThanOrEqual(20)
    expect(routes.length).toBeGreaterThanOrEqual(40)
  })

  it('every route is AuthGuard-covered or on the explicit public allowlist', () => {
    const unguarded = routes.filter(r => !r.guarded)
    const violations = unguarded
      .filter(r => !allowlist.has(r.key))
      .map(r => `${r.controller}: ${r.key}`)
      .sort()

    expect(
      violations,
      `Unauthenticated route(s) that are neither AuthGuard-covered nor allowlisted:\n` +
        `${violations.join('\n')}\n` +
        `Either add @UseGuards(AuthGuard) or, if the route is public by design, ` +
        `add it to PUBLIC_ROUTES with a justification.`,
    ).toEqual([])
  })

  it('the public allowlist has no stale entries', () => {
    // Every allowlisted key must still correspond to a real, currently-unguarded
    // route. If a route was guarded (good) or removed, its allowlist entry is now
    // dead weight and must be pruned so the list stays an honest inventory.
    const unguardedKeys = new Set(routes.filter(r => !r.guarded).map(r => r.key))
    const stale = PUBLIC_ROUTES.filter(r => !unguardedKeys.has(r.key))
      .map(r => r.key)
      .sort()

    expect(
      stale,
      `Stale PUBLIC_ROUTES entries (no matching unguarded route — now guarded or removed): ` +
        stale.join(', '),
    ).toEqual([])
  })
})
