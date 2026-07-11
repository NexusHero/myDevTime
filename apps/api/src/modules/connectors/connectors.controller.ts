import { Body, Controller, Delete, Get, Param, Put, UseGuards } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { AuthGuard, CurrentUser, type AuthenticatedUser } from '../auth/contract.js'
import { NotFoundError } from '../../errors.js'
import { ConnectorsContext } from './connectors.context.js'
import { ConnectorIdParamDto, ConsentDto } from './connectors.dto.js'
import { isConnectorId } from './registry.js'
import { revokeAllGrants, setGrant } from './consent.js'
import { deleteToken } from './vault.js'
import { connectorStatuses } from './service.js'

/**
 * The `connectors` surface (M3, ADR-0032/0033): de-fakes the "Integrationen" screen.
 * Reports each connector's real state (configured / connected / per-capability
 * consent), records consent per capability, and disconnects (deletes sealed tokens
 * + revokes consent). Behind `AuthGuard`; scoped to the caller's workspace + user.
 * The OAuth authorize/callback token exchange needs a registered app per provider
 * (client id/secret in the environment) — until then a provider reads as "geplant".
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
