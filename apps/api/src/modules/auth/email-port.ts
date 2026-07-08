import type { FastifyBaseLogger } from 'fastify'

/**
 * Port for transactional auth emails — verification and password reset (ADR-0007
 * §2.2: volatile vendors behind a narrow interface). The real transport
 * (SES/Resend/Postmark) is its own adapter and issue; nothing upstream imports
 * it. The dev implementation logs the message instead of sending it, so local
 * and CI runs never depend on an external mail service.
 */
export interface EmailMessage {
  readonly to: string
  readonly subject: string
  readonly text: string
}

export interface EmailPort {
  send: (message: EmailMessage) => Promise<void>
}

/** Dev/CI email port: records that a mail would be sent, never leaks the body. */
export function loggingEmailPort(log: FastifyBaseLogger): EmailPort {
  return {
    send: (message: EmailMessage): Promise<void> => {
      log.info({ to: message.to, subject: message.subject }, 'auth email (dev: logged, not sent)')
      return Promise.resolve()
    },
  }
}
