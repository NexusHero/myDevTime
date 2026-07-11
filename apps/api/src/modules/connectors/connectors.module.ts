import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module.js'
import { ConnectorsController } from './connectors.controller.js'
import { ConnectorsContext } from './connectors.context.js'

/**
 * The `connectors` module (M3, ADR-0032/0033): the OAuth-connector surface — real
 * per-connector state, per-capability consent, and disconnect over the sealed
 * TokenVault. Imports `AuthModule` for the guard; `ConnectorsContext` resolves each
 * caller's workspace + user over the `DB` token, so secrets stay isolated by
 * construction. The crypto backend is confined to `crypto.ts` (ports & adapters).
 */
@Module({
  imports: [AuthModule],
  controllers: [ConnectorsController],
  providers: [ConnectorsContext],
})
export class ConnectorsModule {}
