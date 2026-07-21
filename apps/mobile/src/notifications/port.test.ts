import { afterEach, describe, expect, it, vi } from 'vitest'
import { NullNotification } from './port.js'
import { createWebNotificationPort } from './local.web.js'

/**
 * The NotificationPort seam (ADR-0071 P2, REQ-069). The Null port must be a total no-op a
 * deployment without any notification vendor can run on forever; the web adapter must
 * feature-detect the browser Notification API, translate its permission model honestly, and
 * degrade to Null behaviour — never throw — when the API is missing or misbehaves.
 */
describe('NullNotification', () => {
  it('IsUnavailable_DeniesPermission_AndNotifiesAsANoOp', async () => {
    expect(NullNotification.available).toBe(false)
    await expect(NullNotification.requestPermission()).resolves.toBe(false)
    await expect(NullNotification.notify({ title: 'x' })).resolves.toBeUndefined()
  })
})

describe('createWebNotificationPort', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  /** A stubbed browser Notification API (constructable function + statics) capturing constructions. */
  function stubNotification(permission: NotificationPermission) {
    const constructed: { title: string; options?: { body?: string } }[] = []
    const requestPermission = vi.fn(() => {
      fake.permission = 'granted'
      return Promise.resolve<NotificationPermission>('granted')
    })
    const fake = Object.assign(
      function (this: unknown, title: string, options?: { body?: string }) {
        constructed.push({ title, ...(options ? { options } : {}) })
      },
      { permission, requestPermission },
    )
    vi.stubGlobal('Notification', fake)
    return { fake, constructed }
  }

  it('WithoutABrowserNotificationApi_DegradesToTheNullPort', async () => {
    // No stub installed → `typeof Notification === 'undefined'` in this environment.
    const port = createWebNotificationPort()
    expect(port.available).toBe(false)
    await expect(port.requestPermission()).resolves.toBe(false)
    await expect(port.notify({ title: 'x' })).resolves.toBeUndefined()
  })

  it('RequestPermission_MapsGrantedToTrue', async () => {
    const { fake } = stubNotification('default')
    const port = createWebNotificationPort()
    expect(port.available).toBe(true)
    await expect(port.requestPermission()).resolves.toBe(true)
    expect(fake.requestPermission).toHaveBeenCalledTimes(1)
  })

  it('Notify_WithGrantedPermission_RaisesABrowserNotification', async () => {
    const { constructed } = stubNotification('granted')
    const port = createWebNotificationPort()
    await port.notify({ title: 'Zeit für eine Pause', body: '6h ohne Pause' })
    expect(constructed).toEqual([
      { title: 'Zeit für eine Pause', options: { body: '6h ohne Pause' } },
    ])
  })

  it('Notify_WithoutPermission_QuietlyDoesNothing', async () => {
    const { constructed } = stubNotification('denied')
    const port = createWebNotificationPort()
    await port.notify({ title: 'x' })
    expect(constructed).toEqual([])
  })

  it('AMisbehavingVendorApi_NeverThrowsThroughThePort', async () => {
    const throwing = Object.assign(
      function (this: unknown) {
        throw new Error('boom')
      },
      {
        permission: 'granted',
        requestPermission: () => Promise.reject(new Error('boom')),
      },
    )
    vi.stubGlobal('Notification', throwing)
    const port = createWebNotificationPort()
    await expect(port.requestPermission()).resolves.toBe(false)
    await expect(port.notify({ title: 'x' })).resolves.toBeUndefined()
  })
})
