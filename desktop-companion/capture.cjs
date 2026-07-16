'use strict'

// Desktop app-usage capture (ADR-0059). Polls the focused application and turns the
// elapsed time between polls into activity spans, then aggregates them with the SAME
// deterministic core the mobile app uses (`summarizeActivity` from @mydevtime/domain)
// — so the breakdown is the core's, never fabricated. `active-win` is the only native
// dependency; everything else is the shared, tested aggregation.
//
// Local-only + consent-first: this runs only while the companion is open and enabled,
// captures app names only, and keeps everything on the machine (no upload).

const activeWin = require('active-win')
const { summarizeActivity } = require('@mydevtime/domain')

const DEFAULT_POLL_MS = 15_000
const DEFAULT_TOP_N = 6

function createTracker(opts = {}) {
  const pollMs = opts.pollMs ?? DEFAULT_POLL_MS
  const topN = opts.topN ?? DEFAULT_TOP_N
  const spans = []
  let lastTs = null
  let timer = null

  async function tick(onUpdate) {
    const now = Date.now()
    try {
      const win = await activeWin()
      const source = (win && win.owner && win.owner.name) || 'Unknown'
      // Attribute the elapsed interval to the app focused at this poll (coarse but
      // honest at a 15 s cadence). The first tick only sets the clock.
      if (lastTs !== null) spans.push({ source, ms: now - lastTs })
      lastTs = now
      onUpdate(summarizeActivity(spans, { topN }))
    } catch (err) {
      // e.g. Screen Recording permission not yet granted on macOS — stay quiet.
      onUpdate(summarizeActivity(spans, { topN }), err)
    }
  }

  return {
    start(onUpdate) {
      lastTs = Date.now()
      timer = setInterval(() => {
        void tick(onUpdate)
      }, pollMs)
    },
    stop() {
      if (timer) clearInterval(timer)
      timer = null
    },
  }
}

module.exports = { createTracker }
