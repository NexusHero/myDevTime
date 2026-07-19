import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module.js'
import { ConnectorsContext } from '../connectors/connectors.context.js'
import { IssueImportController } from './issueimport.controller.js'

/**
 * The `issueimport` module (ADR-0005): the issue/ticket-import surface — preview a connected
 * tracker's tickets (GitHub Issues, Azure DevOps Work Items) as candidate-task proposals over the
 * narrow `IssueImportPort`. Imports `AuthModule` for the guard and reuses the connectors'
 * `ConnectorsContext` (workspace/user resolution) + sealed TokenVault + per-capability consent, so
 * secrets stay isolated by construction. Writes nothing — tasks are created only when the client
 * confirms a candidate via the tracking endpoint.
 */
@Module({
  imports: [AuthModule],
  controllers: [IssueImportController],
  providers: [ConnectorsContext],
})
export class IssueImportModule {}
