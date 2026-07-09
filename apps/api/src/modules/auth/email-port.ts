import { createTransport } from 'nodemailer'
import type { Config } from '../../config.js'

/**
 * Port for transactional auth emails — verification, password reset, and
 * account-deletion confirmation (ADR-0007 §2.2: volatile vendors behind a narrow
 * interface). Nothing upstream imports the transport; the module picks SMTP or
 * a dev logger from config.
 */
export interface EmailMessage {
  readonly to: string
  readonly subject: string
  readonly text: string
}

/** Narrow structured logger the dev port needs — a Fastify or Nest logger both satisfy it. */
export interface EmailLogger {
  info: (obj: Record<string, unknown>, msg: string) => void
}

export interface EmailPort {
  send: (message: EmailMessage) => Promise<void>
}

/** Dev/CI email port: records that a mail would be sent, never leaks the body. */
export function loggingEmailPort(log: EmailLogger): EmailPort {
  return {
    send: (message: EmailMessage): Promise<void> => {
      log.info({ to: message.to, subject: message.subject }, 'auth email (dev: logged, not sent)')
      return Promise.resolve()
    },
  }
}

/** SMTP transport (nodemailer) built from a connection URL. */
export function smtpEmailPort(smtpUrl: string, from: string): EmailPort {
  const transport = createTransport(smtpUrl)
  return {
    send: async (message: EmailMessage): Promise<void> => {
      await transport.sendMail({
        from,
        to: message.to,
        subject: message.subject,
        text: message.text,
      })
    },
  }
}

/** Choose the transport: SMTP when configured, otherwise the dev logger. */
export function createEmailPort(config: Config, log: EmailLogger): EmailPort {
  return config.SMTP_URL ? smtpEmailPort(config.SMTP_URL, config.EMAIL_FROM) : loggingEmailPort(log)
}
