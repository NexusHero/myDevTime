import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { AuthGuard, CurrentUser, type AuthenticatedUser } from '../auth/contract.js'
import { NotFoundError } from '../../errors.js'
import { ConnectorsContext } from '../connectors/connectors.context.js'
import { grantedCapabilities } from '../connectors/consent.js'
import { hasToken } from '../connectors/vault.js'
import { isConnectorId, type ConnectorId } from '../connectors/registry.js'
import {
  ConflictError,
  freshAccessToken,
  masterKeyFromEnv,
  oauthClient,
  tokenEndpoint,
  vaultTokenStore,
} from '../connectors/oauth.js'
import { previewImport, providerForConnector, resolveIssueImportPort } from './service.js'
import { ConnectorIdParamDto, IssuePreviewQueryDto } from './issueimport.dto.js'

/**
 * Everything the vault-backed token flow needs from the environment, or a 409 why not. Mirrors the
 * connectors controller's OAuth-flow resolution, pared to what a *read-only preview* needs
 * (endpoint + client credentials to refresh, master key to open the vault) — no redirect URI,
 * because the preview never redirects.
 */
interface TokenFlowConfig {
  readonly endpoint: string
  readonly clientId: string
  readonly clientSecret: string
  readonly masterKey: Buffer
}

function requireTokenFlowConfig(id: ConnectorId): TokenFlowConfig {
  const env = process.env
  const endpoint = tokenEndpoint(id)
  if (endpoint === null) {
    throw new ConflictError(`the OAuth flow for '${id}' is not implemented yet`)
  }
  const client = oauthClient(id, env)
  if (client === null) {
    throw new ConflictError(`'${id}' is not configured in this deployment (client id/secret)`)
  }
  const masterKey = masterKeyFromEnv(env)
  if (masterKey === null) {
    throw new ConflictError('CONNECTOR_MASTER_KEY is not set — the token vault cannot seal tokens')
  }
  return { ...client, endpoint, masterKey }
}

/** Azure DevOps org + project (config, never client-supplied), or `null` when not configured. */
function azureConfig(): { org: string; project: string } | null {
  const org = process.env.CONNECTOR_AZURE_DEVOPS_ORG
  const project = process.env.CONNECTOR_AZURE_DEVOPS_PROJECT
  if (org === undefined || org.length === 0) return null
  if (project === undefined || project.length === 0) return null
  return { org, project }
}

/**
 * The issue-import surface (ADR-0005): connect a tracker (GitHub Issues, Azure DevOps Work Items)
 * and preview its tickets as candidate-task **proposals** — it writes nothing. Tasks are created
 * only when the client confirms a candidate via the existing tracking endpoint. Same consent +
 * sealed-token gate as the calendar preview (409 unless `inbound` is granted AND a sealed token
 * exists — consent-first, REQ-025/ADR-0033). Behind `AuthGuard`; scoped to the caller's workspace +
 * user. An unconfigured deployment reports an honest `unavailable`, never a fake import.
 */
@ApiTags('issueimport')
@Controller('api/connectors')
@UseGuards(AuthGuard)
export class IssueImportController {
  constructor(private readonly ctx: ConnectorsContext) {}

  /**
   * Preview the caller's assigned tickets for an issues connector as candidate-task proposals. The
   * concrete vendor adapter is resolved by connector id and wired to the vault's live-token
   * accessor; Azure additionally needs `CONNECTOR_AZURE_DEVOPS_ORG`/`_PROJECT`. Returns
   * `{ proposals, status }` — proposals only, writes nothing (ADR-0005).
   */
  @Get(':id/issues/preview')
  async preview(
    @CurrentUser() user: AuthenticatedUser,
    @Param() params: ConnectorIdParamDto,
    @Query() query: IssuePreviewQueryDto,
  ) {
    if (!isConnectorId(params.id)) throw new NotFoundError('unknown connector')
    const provider = providerForConnector(params.id)
    if (provider === 'null') {
      throw new ConflictError(`'${params.id}' does not support issue import`)
    }
    const connector: ConnectorId = params.id
    const { db, workspaceId, userId } = await this.ctx.contextOf(user)
    const key = { workspaceId, userId, connector }
    const granted = await grantedCapabilities(db, key)
    if (!granted.includes('inbound')) {
      throw new ConflictError(`consent for 'inbound' has not been granted for ${connector}`)
    }
    if (!(await hasToken(db, key))) {
      throw new ConflictError(`${connector} is not connected`)
    }
    const flow = requireTokenFlowConfig(connector)
    const store = vaultTokenStore(db, flow.masterKey, key)
    const accessToken = (): Promise<string | null> =>
      freshAccessToken(store, {
        endpoint: flow.endpoint,
        clientId: flow.clientId,
        clientSecret: flow.clientSecret,
      })
    const azure = azureConfig()
    const port = resolveIssueImportPort(provider, {
      accessToken,
      ...(azure !== null ? { azure } : {}),
    })
    // Consent already checked; pass `true` and let availability/HTTP failures degrade honestly.
    return previewImport(port, true, { state: query.state ?? 'open' })
  }
}
