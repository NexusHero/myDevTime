#!/usr/bin/env node
// Deploy gate (ADR-0078): block until the named workflows of this push are green.
//
// The deploy workflow fires on the same push to `main` as CI, Security, CodeQL,
// container smoke and E2E — in parallel, with no dependency between them. Without
// this gate a commit whose tests or vulnerability scan failed would still be built,
// pushed and rolled out.
//
// It waits on an explicit list of *workflow* names (not job names: those collide —
// Pages also has `build`/`deploy` jobs — and the commit also carries Dependabot and
// scheduled-scan check runs that are not this push's verdict). If a listed workflow
// is renamed, the gate never sees it and times out red: it fails closed, never open.
//
// Usage (in a workflow, with `actions: read`):
//   node scripts/wait-for-checks.mjs --workflow CI --workflow Security
// Env: GITHUB_TOKEN, GITHUB_REPOSITORY, GITHUB_SHA, GITHUB_API_URL (optional).

import { pathToFileURL } from 'node:url'
import { setTimeout as sleep } from 'node:timers/promises'

const PASSING = new Set(['success', 'skipped', 'neutral'])

/**
 * Pure verdict over the workflow runs recorded for one commit.
 * @param {Array<{id: number, name: string, event: string, status: string, conclusion: string|null}>} runs
 * @param {{required: string[]}} opts
 * @returns {{state: 'success'|'pending'|'failure', reason: string}}
 */
export function evaluateRuns(runs, { required }) {
  // Only this push's runs; a workflow re-triggered for the commit counts by its newest run.
  const latest = new Map()
  for (const r of runs) {
    if (r.event !== 'push' || !required.includes(r.name)) continue
    const prev = latest.get(r.name)
    if (!prev || r.id > prev.id) latest.set(r.name, r)
  }
  const seen = [...latest.values()]

  const failed = seen.filter(r => r.status === 'completed' && !PASSING.has(r.conclusion))
  if (failed.length > 0) {
    return {
      state: 'failure',
      reason: `blocking: ${failed.map(r => `${r.name} (${r.conclusion})`).join(', ')}`,
    }
  }

  const missing = required.filter(name => !latest.has(name))
  if (missing.length > 0) {
    return { state: 'pending', reason: `not started yet: ${missing.join(', ')}` }
  }

  const running = seen.filter(r => r.status !== 'completed')
  if (running.length > 0) {
    return { state: 'pending', reason: `still running: ${running.map(r => r.name).join(', ')}` }
  }

  return { state: 'success', reason: `all green: ${required.join(', ')}` }
}

async function api(path) {
  const base = process.env.GITHUB_API_URL ?? 'https://api.github.com'
  const res = await fetch(`${base}${path}`, {
    headers: {
      Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  })
  if (!res.ok) throw new Error(`GitHub API ${path} → ${res.status} ${await res.text()}`)
  return res.json()
}

async function listWorkflowRuns(repo, sha) {
  const runs = []
  for (let page = 1; ; page++) {
    const body = await api(`/repos/${repo}/actions/runs?head_sha=${sha}&per_page=100&page=${page}`)
    runs.push(...body.workflow_runs)
    if (runs.length >= body.total_count || body.workflow_runs.length === 0) return runs
  }
}

async function main(argv) {
  const required = []
  let timeoutMin = 45
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--workflow') required.push(argv[++i])
    else if (argv[i] === '--timeout-minutes') timeoutMin = Number(argv[++i])
    else throw new Error(`unknown argument: ${argv[i]}`)
  }
  const { GITHUB_REPOSITORY: repo, GITHUB_SHA: sha } = process.env
  if (required.length === 0) throw new Error('name at least one --workflow to wait for')
  if (!repo || !sha || !process.env.GITHUB_TOKEN) {
    throw new Error('GITHUB_TOKEN, GITHUB_REPOSITORY and GITHUB_SHA are required')
  }

  const deadline = Date.now() + timeoutMin * 60_000
  for (;;) {
    const verdict = evaluateRuns(await listWorkflowRuns(repo, sha), { required })
    console.log(`[${new Date().toISOString()}] ${verdict.state}: ${verdict.reason}`)
    if (verdict.state === 'success') return 0
    if (verdict.state === 'failure') {
      console.error('::error::Deploy blocked — a required workflow on this commit is not green.')
      return 1
    }
    if (Date.now() > deadline) {
      console.error(`::error::Deploy blocked — still pending after ${timeoutMin} min.`)
      return 1
    }
    await sleep(30_000)
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main(process.argv.slice(2)).then(
    code => process.exit(code),
    err => {
      console.error(`::error::${err.message}`)
      process.exit(1)
    },
  )
}
