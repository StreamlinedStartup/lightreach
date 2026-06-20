import { db, connections } from '@workspace/db'
import { ConnectionsView } from './connections-view'

export default async function ConnectionsPage() {
  const rows = await db.select().from(connections).orderBy(connections.createdAt)

  const safe = rows.map(({ smtpPassEncrypted: _sp, imapPassEncrypted: _ip, lastTestedAt, createdAt, ...rest }) => ({
    ...rest,
    lastTestedAt: lastTestedAt?.toISOString() ?? null,
    createdAt: createdAt.toISOString(),
  }))

  return <ConnectionsView connections={safe} />
}
