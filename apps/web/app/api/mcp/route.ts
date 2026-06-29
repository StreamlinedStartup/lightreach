import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js'
import { requireBearer } from '@/lib/mcp/auth'
import { buildMcpServer } from '@/lib/mcp/server'

// This route must run in the Node.js runtime — crypto, better-sqlite3,
// and the scheduler all require Node APIs unavailable in Edge.
export const runtime = 'nodejs'
// Never cache; each request is a live RPC call.
export const dynamic = 'force-dynamic'

function unauthorized() {
  return Response.json({ error: 'Unauthorized' }, { status: 401 })
}

async function handleMcp(request: Request): Promise<Response> {
  if (!(await requireBearer(request))) return unauthorized()

  const server = buildMcpServer()
  // Stateless mode: no sessionIdGenerator → each request is self-contained.
  const transport = new WebStandardStreamableHTTPServerTransport()
  await server.connect(transport)
  return transport.handleRequest(request)
}

export async function POST(request: Request) {
  return handleMcp(request)
}

export async function GET(request: Request) {
  return handleMcp(request)
}

export async function DELETE(request: Request) {
  return handleMcp(request)
}
