import { apiBaseUrl } from '../config.js'
import {
  createRule,
  deleteRule,
  getRules,
  updateRule,
  type Rule,
  type RuleInput,
} from '../api/rules.js'
import { useAsync, type AsyncResource } from './useAsync.js'

/**
 * The categorization-rules source (REQ-011, ADR-0005). When an API base URL is configured the
 * hook lists the workspace's ordered `matcher → action` rules from the `automation` module and
 * creates/updates/deletes them there; otherwise — the default in local dev and the test gate — it
 * resolves **empty** (and the mutators are inert). The app fabricates no rules. `live` lets the UI
 * flag that the data is API-backed; the deterministic engine on the server owns all evaluation.
 */
export interface RulesResource extends AsyncResource<Rule[]> {
  readonly live: boolean
  readonly create: (input: RuleInput) => Promise<void>
  readonly update: (id: string, patch: RuleInput) => Promise<void>
  readonly remove: (id: string) => Promise<void>
}

export function useRules(): RulesResource {
  const base = apiBaseUrl
  const resource = useAsync<Rule[]>(
    () => (base !== null ? getRules(base) : Promise.resolve<Rule[]>([])),
    base !== null ? `rules:${base}` : 'rules:empty',
  )
  const create = async (input: RuleInput): Promise<void> => {
    if (base === null) return
    await createRule(base, input)
    resource.reload()
  }
  const update = async (id: string, patch: RuleInput): Promise<void> => {
    if (base === null) return
    await updateRule(base, id, patch)
    resource.reload()
  }
  const remove = async (id: string): Promise<void> => {
    if (base === null) return
    await deleteRule(base, id)
    resource.reload()
  }
  return { ...resource, live: base !== null, create, update, remove }
}
