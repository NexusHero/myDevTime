import { test } from '@playwright/test'
import { apiSignUp, freshUser, uiSignIn } from './support/fixtures.js'

/**
 * TEMPORARY diagnostic for #337: `page.goto('/projects')` fails with
 * net::ERR_CONNECTION_REFUSED in the CI stack while every other deep link works.
 * This spec never asserts — it probes the suspects one by one and prints the
 * results into the job log, so the failing layer (server response, static-export
 * structure, service worker, localhost/IPv6 resolution) can be read off directly.
 * Delete this file once #337 is fixed.
 */

const log = (...parts: unknown[]): void => {
  console.log('DIAG >>>', ...parts)
}

test('DIAG-337 · /projects navigation matrix', async ({ page, request }) => {
  const user = freshUser('diag')
  await apiSignUp(request, user)

  // 1 — node-side truth: what does nginx actually answer for these paths?
  for (const path of [
    '/projects',
    '/projects/',
    '/projects.html',
    '/planner',
    '/meetings',
    '/profile',
    '/today',
  ]) {
    try {
      const res = await request.get(path, { maxRedirects: 0 })
      log('request.get', path, '→', res.status(), res.headers()['location'] ?? '')
    } catch (err) {
      log('request.get', path, '→ ERROR:', (err as Error).message.split('\n')[0])
    }
  }

  await uiSignIn(page, user)

  // 2 — is a service worker controlling the page after sign-in?
  const swState = await page.evaluate(async () => {
    const regs = (await navigator.serviceWorker?.getRegistrations?.()) ?? []
    return {
      controlled: !!navigator.serviceWorker?.controller,
      registrations: regs.map(r => ({ scope: r.scope, active: r.active?.state ?? null })),
    }
  })
  log('service worker', JSON.stringify(swState))

  // 3 — in-page fetch of /projects (routes through the SW if it controls the page)
  const fetchResult = await page.evaluate(() =>
    fetch('/projects').then(
      r => `OK:${String(r.status)}`,
      (e: Error) => `ERR:${e.message}`,
    ),
  )
  log('in-page fetch /projects →', fetchResult)

  // 4 — goto via 127.0.0.1 (bypasses localhost/IPv6 resolution)
  const gotoV4 = await page
    .goto('http://127.0.0.1:8080/projects')
    .then(r => `OK:${String(r?.status())}`)
    .catch((e: Error) => `ERR:${e.message.split('\n')[0]}`)
  log('goto 127.0.0.1 /projects →', gotoV4)

  // 5 — the failing navigation itself
  const gotoLocalhost = await page
    .goto('/projects')
    .then(r => `OK:${String(r?.status())}`)
    .catch((e: Error) => `ERR:${e.message.split('\n')[0]}`)
  log('goto localhost /projects →', gotoLocalhost)

  // 6 — unregister every service worker, then retry the exact failing navigation
  await page.evaluate(async () => {
    const regs = (await navigator.serviceWorker?.getRegistrations?.()) ?? []
    for (const r of regs) await r.unregister()
  })
  const gotoAfterSw = await page
    .goto('/projects')
    .then(r => `OK:${String(r?.status())}`)
    .catch((e: Error) => `ERR:${e.message.split('\n')[0]}`)
  log('goto localhost /projects after SW unregister →', gotoAfterSw)

  // 7 — control: the same sequence against a deep link that is known to work
  const gotoControl = await page
    .goto('/planner')
    .then(r => `OK:${String(r?.status())}`)
    .catch((e: Error) => `ERR:${e.message.split('\n')[0]}`)
  log('goto localhost /planner (control) →', gotoControl)
})
