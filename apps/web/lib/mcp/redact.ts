import type { Connection } from '@workspace/db'

export type SafeConnection = Omit<Connection, 'smtpPassEncrypted' | 'imapPassEncrypted'> & {
  hasSmtpPass: boolean
  hasImapPass: boolean
}

/** Strip encrypted credential columns; add boolean presence flags instead. */
export function redactConnection(row: Connection): SafeConnection {
  const { smtpPassEncrypted, imapPassEncrypted, ...rest } = row
  return {
    ...rest,
    hasSmtpPass: Boolean(smtpPassEncrypted),
    hasImapPass: Boolean(imapPassEncrypted),
  }
}
