import { Body, Controller, Delete, Get, Param, Put, Query, UseGuards } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { AuthGuard, CurrentUser, type AuthenticatedUser } from '../auth/contract.js'
import { NotFoundError, ValidationError } from '../../errors.js'
import { planImport, providerForConnector, resolveCalendarPort } from '../calendarsync/service.js'
import { ConnectorsContext } from './connectors.context.js'
import {
  CalendarPreviewQueryDto,
  ConnectorIdParamDto,
  ConsentDto,
  OAuthCallbackQueryDto,
} from './connectors.dto.js'
import { connectorById, isConnectorId, type ConnectorId } from './registry.js'
import { grantedCapabilities, revokeAllGrants, setGrant } from './consent.js'
import { deleteToken, getToken, hasToken, putToken } from './vault.js'
import { signState, verifyState } from './crypto.js'
import { buildAuthorizeUrl, connectorStatuses, isConfigured } from './service.js'
import {
  ConflictError,
  exchangeAuthorizationCode,
  freshAccessToken,
  masterKeyFromEnv,
  oauthClient,
  preserveRefreshToken,
  redirectUriFor,
  tokenEndpoint,
  vaultTokenStore,
} from './oauth.js'

/** Everything the live OAuth flow needs from the environment, or a 409 why not. */
interface OAuthFlowConfig {
  readonly endpoint: string
  readonly clientId: string
  readonly clientSecret: string
  readonly redirectUri: string
  readonly masterKey: Buffer
}

/**
 * Resolve the full env-gated OAuth configuration for a connector. Each missing
 * piece is a 409 with an honest reason — an unconfigured deployment keeps
 * reporting "Planned"/"not configured" exactly as before, never a fake flow.
 */
function requireOAuthFlowConfig(id: ConnectorId): OAuthFlowConfig {
  const env = process.env
  const endpoint = tokenEndpoint(id)
  if (endpoint === null) {
    throw new ConflictError(`the OAuth flow for '${id}' is not implemented yet`)
  }
  const client = oauthClient(id, env)
  if (client === null) {
    throw new ConflictError(`'${id}' is not configured in this deployment (client id/secret)`)
  }
  const redirectUri = redirectUriFor(id, env)
  if (redirectUri === null) {
    throw new ConflictError(
      'no OAuth redirect base configured (CONNECTOR_REDIRECT_BASE_URL or AUTH_BASE_URL)',
    )
  }
  const masterKey = masterKeyFromEnv(env)
  if (masterKey === null) {
    throw new ConflictError('CONNECTOR_MASTER_KEY is not set — the token vault cannot seal tokens')
  }
  return { ...client, endpoint, redirectUri, masterKey }
}

/** Default preview window: the past week through the coming week. */
const PREVIEW_WINDOW_MS = 7 * 24 * 60 * 60 * 1000

/**
 * The `connectors` surface (M3, ADR-0032/0033): de-fakes the "Integrationen" screen.
 * Reports each connector's real state (configured / connected / per-capability
 * consent), records consent per capability, and disconnects (deletes sealed tokens
 * + revokes consent). The OAuth flow (REQ-010, #15) is env-gated: authorize builds
 * the provider URL with a signed state binding the callback to the caller; the
 * callback verifies that state, exchanges the code, and seals the tokens into the
 * vault. The calendar preview surfaces `planImport`'s **proposals** from the live
 * window — consent-gated, and it writes nothing (ADR-0005). Behind `AuthGuard`;
 * scoped to the caller's workspace + user.
 */
@ApiTags('connectors')
@Controller('api/connectors')
@UseGuards(AuthGuard)
export class ConnectorsController {
  constructor(private readonly ctx: ConnectorsContext) {}

  @Get()
  async list(@CurrentUser() user: AuthenticatedUser) {
    const { db, workspaceId, userId } = await this.ctx.contextOf(user)
    return connectorStatuses(db, { workspaceId, userId }, process.env)
  }

  /**
   * Calendar import preview for Google (REQ-010) — the original route a client
   * already calls, kept intact. It delegates to the generic calendar-preview
   * helper. Declared before the `:id` routes only for readability — a static path
   * wins over the parametric `:id/preview` regardless, so both coexist.
   */
  @Get('google-calendar/preview')
  async previewGoogleCalendar(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: CalendarPreviewQueryDto,
  ) {
    return this.runCalendarPreview(user, 'google-calendar', query)
  }

  /**
   * Generic calendar import preview (REQ-010): resolves the right vendor adapter by
   * connector id for any OAuth calendar connector (Google, Microsoft) and returns
   * `planImport`'s proposal for the live window — ghost blocks to confirm, never a
   * write (ADR-0005). Same consent gate as Google (409 unless `inbound` is granted
   * AND a sealed token exists — consent-first, REQ-025/ADR-0033). A non-calendar or
   * native connector (Apple/EventKit — no OAuth token here) is a 409/NotFound.
   */
  @Get(':id/preview')
  async previewCalendar(
    @CurrentUser() user: AuthenticatedUser,
    @Param() params: ConnectorIdParamDto,
    @Query() query: CalendarPreviewQueryDto,
  ) {
    if (!isConnectorId(params.id)) throw new NotFoundError('unknown connector')
    const spec = connectorById(params.id)
    if (spec?.category !== 'calendar' || spec.auth !== 'oauth2') {
      throw new ConflictError(`'${params.id}' does not support an OAuth calendar preview`)
    }
    return this.runCalendarPreview(user, params.id, query)
  }

  /**
   * The shared calendar-preview flow behind both routes above: consent + connection
   * gate, resolve the vendor adapter for the connector's provider (wired to the
   * vault's live-token accessor), then `planImport` — proposals only, writes nothing.
   */
  private async runCalendarPreview(
    user: AuthenticatedUser,
    connector: ConnectorId,
    query: CalendarPreviewQueryDto,
  ) {
    const { db, workspaceId, userId } = await this.ctx.contextOf(user)
    const key = { workspaceId, userId, connector }
    const granted = await grantedCapabilities(db, key)
    if (!granted.includes('inbound')) {
      throw new ConflictError(`consent for 'inbound' has not been granted for ${connector}`)
    }
    if (!(await hasToken(db, key))) {
      throw new ConflictError(`${connector} is not connected`)
    }
    const flow = requireOAuthFlowConfig(connector)
    const now = Date.now()
    const fromMs = query.fromMs ?? now - PREVIEW_WINDOW_MS
    const toMs = query.toMs ?? now + PREVIEW_WINDOW_MS
    if (toMs <= fromMs) throw new ValidationError('toMs must be greater than fromMs')

    const store = vaultTokenStore(db, flow.masterKey, key)
    const port = resolveCalendarPort(providerForConnector(connector), {
      accessToken: () =>
        freshAccessToken(store, {
          endpoint: flow.endpoint,
          clientId: flow.clientId,
          clientSecret: flow.clientSecret,
        }),
    })
    // No imported-blocks store exists yet, so every live event is a 'new' proposal.
    return planImport(port, [], { fromMs, toMs }, true)
  }

  /**
   * Start the OAuth dance: the provider authorize URL for the scopes the user has
   * consented to (least privilege, ADR-0033), with a signed state that binds the
   * callback to this caller. Returns `{ url }` — the client opens it.
   */
  @Get(':id/authorize')
  async authorize(@CurrentUser() user: AuthenticatedUser, @Param() params: ConnectorIdParamDto) {
    if (!isConnectorId(params.id)) throw new NotFoundError('unknown connector')
    if (!isConfigured(params.id, process.env)) {
      throw new ConflictError(`'${params.id}' is not configured in this deployment`)
    }
    const flow = requireOAuthFlowConfig(params.id)
    const { db, workspaceId, userId } = await this.ctx.contextOf(user)
    const granted = await grantedCapabilities(db, { workspaceId, userId, connector: params.id })
    if (granted.length === 0) {
      throw new ConflictError('no capability consented — grant consent before connecting')
    }
    const state = signState(flow.masterKey, { userId, connector: params.id })
    const url = buildAuthorizeUrl(params.id, process.env, {
      redirectUri: flow.redirectUri,
      state,
      granted,
    })
    if (url === null) throw new ConflictError(`'${params.id}' is not configured`)
    return { url }
  }

  /**
   * The provider redirects here with `code` + `state`. The state must verify
   * against the caller's identity (tampered/foreign/stale → 400, nothing
   * exchanged); then the code is exchanged at the provider's token endpoint and
   * the tokens are sealed into the vault — which is what flips `connected`.
   */
  @Get(':id/callback')
  async callback(
    @CurrentUser() user: AuthenticatedUser,
    @Param() params: ConnectorIdParamDto,
    @Query() query: OAuthCallbackQueryDto,
  ) {
    if (!isConnectorId(params.id)) throw new NotFoundError('unknown connector')
    if (query.error !== undefined) {
      throw new ValidationError(`the provider returned an error: ${query.error}`)
    }
    if (query.code === undefined) throw new ValidationError('missing authorization code')
    const flow = requireOAuthFlowConfig(params.id)
    const { db, workspaceId, userId } = await this.ctx.contextOf(user)
    const claims = verifyState(flow.masterKey, query.state)
    if (claims?.userId !== userId || claims.connector !== params.id) {
      throw new ValidationError('invalid OAuth state')
    }
    const tokens = await exchangeAuthorizationCode(flow.endpoint, {
      clientId: flow.clientId,
      clientSecret: flow.clientSecret,
      code: query.code,
      redirectUri: flow.redirectUri,
    })
    const key = { workspaceId, userId, connector: params.id }
    // Google omits refresh_token on a repeat authorization-code exchange (reconnect / consent
    // change). Keep the stored one so a still-valid refresh token is never overwritten with null.
    const existing = await getToken(db, flow.masterKey, key)
    await putToken(db, flow.masterKey, key, {
      accessToken: tokens.accessToken,
      refreshToken: preserveRefreshToken(tokens.refreshToken, existing?.refreshToken ?? null),
      expiresAt: tokens.expiresAt,
      scopes: tokens.scopes,
    })
    return connectorStatuses(db, { workspaceId, userId }, process.env)
  }

  @Put(':id/consent')
  async consent(
    @CurrentUser() user: AuthenticatedUser,
    @Param() params: ConnectorIdParamDto,
    @Body() body: ConsentDto,
  ) {
    if (!isConnectorId(params.id)) throw new NotFoundError('unknown connector')
    const { db, workspaceId, userId } = await this.ctx.contextOf(user)
    await setGrant(db, { workspaceId, userId, connector: params.id }, body.capability, body.granted)
    return connectorStatuses(db, { workspaceId, userId }, process.env)
  }

  @Delete(':id')
  async disconnect(@CurrentUser() user: AuthenticatedUser, @Param() params: ConnectorIdParamDto) {
    if (!isConnectorId(params.id)) throw new NotFoundError('unknown connector')
    const { db, workspaceId, userId } = await this.ctx.contextOf(user)
    const key = { workspaceId, userId, connector: params.id }
    // Disconnect = delete sealed tokens + revoke every capability's consent (ADR-0033).
    await deleteToken(db, key)
    await revokeAllGrants(db, key)
    return connectorStatuses(db, { workspaceId, userId }, process.env)
  }
}
