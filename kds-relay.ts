import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Plugin } from 'vite'

// Live relay for the POS <-> KDS link (public/kds/link.js).
//
// Without it the two screens only see each other inside one browser (localStorage + BroadcastChannel). With it, every
// browser, tablet or screen that opens the app from this server shares one list of kitchen tickets, and a ticket sent
// from the POS shows on the KDS the moment it is sent (Server-Sent Events, no polling).
//
//   GET  /api/kds          the current tickets: { epoch, rev, list }
//   GET  /api/kds/events   a live stream: one `snapshot` on connect, then a `state` event after every change
//   POST /api/kds          a change: { from, why, op, ... }
//                            merge    { list, drop }    adds or updates the given tickets (the newest `_u` wins per ticket), `drop` removes ids
//                            replace  { list }          swaps the whole list (a fresh shift)
//                            out      { add, remove }   the sold-out dishes: names added to or taken off one shared list
//                            catalog  { value }         the POS menu, published for the kitchen's Availability screen
//
// The tickets live in memory: restarting the dev server empties the relay, and the screens that are open put theirs back.

type Ticket = { id: string; at?: number; _u?: number } & Record<string, unknown>
type Body = { from?: string; why?: string; op?: string; list?: unknown; drop?: unknown; add?: unknown; remove?: unknown; value?: unknown }
type Mountable = {
  middlewares: { use: (path: string, fn: (req: IncomingMessage, res: ServerResponse, next: () => void) => void) => unknown }
  httpServer: { once: (event: 'close', fn: () => void) => unknown } | null
}

const KEEP = 12 * 3600e3
const MAX_BODY = 4 * 1024 * 1024

const isTicket = (t: unknown): t is Ticket => typeof t === 'object' && t !== null && typeof (t as Ticket).id === 'string'

export function kdsRelay(): Plugin {
  const epoch = Math.random().toString(36).slice(2)
  let rev = 0
  let list: Ticket[] = []
  let out: Set<string> | null = null   // sold-out dishes (null until a screen has said anything about them)
  let catalog: string | null = null    // the POS menu, as the POS published it
  const clients = new Set<ServerResponse>()

  const state = (withCatalog = true) => {
    const now = Date.now()
    list = list.filter(t => now - (t.at ?? now) < KEEP)
    return { epoch, rev, list, out: out ? [...out] : null, ...(withCatalog && catalog !== null ? { catalog } : {}) }
  }
  const emit = (event: string, data: unknown) => {
    const chunk = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
    clients.forEach(res => res.write(chunk))
  }
  const reply = (res: ServerResponse, code: number, data: unknown) => {
    res.statusCode = code
    res.setHeader('Content-Type', 'application/json')
    res.setHeader('Cache-Control', 'no-store')
    res.end(JSON.stringify(data))
  }
  const readBody = (req: IncomingMessage) => new Promise<string>((resolve, reject) => {
    const parts: Buffer[] = []
    let size = 0
    req.on('data', (chunk: Buffer) => {
      size += chunk.length
      if (size > MAX_BODY) { reject(new Error('too large')); return }
      parts.push(chunk)
    })
    req.on('end', () => resolve(Buffer.concat(parts).toString('utf8')))
    req.on('error', reject)
  })

  const names = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [])

  const apply = (b: Body) => {
    const incoming = Array.isArray(b.list) ? b.list.filter(isTicket) : []
    if (b.op === 'replace') {
      list = incoming
    } else if (b.op === 'out') {
      const set = out ?? new Set<string>()
      names(b.add).forEach(n => set.add(n))
      names(b.remove).forEach(n => set.delete(n))
      out = set
    } else if (b.op === 'catalog') {
      if (typeof b.value === 'string' && b.value.length < MAX_BODY / 2) catalog = b.value
    } else {
      const at = new Map(list.map((t, i) => [t.id, i]))
      for (const t of incoming) {
        const i = at.get(t.id)
        if (i === undefined) { at.set(t.id, list.length); list.push(t) }
        else if ((t._u ?? 0) >= (list[i]._u ?? 0)) list[i] = t
      }
      if (Array.isArray(b.drop) && b.drop.length) {
        const gone = new Set(b.drop.filter((x): x is string => typeof x === 'string'))
        list = list.filter(t => !gone.has(t.id))
      }
    }
    rev++
    emit('state', { ...state(b.op === 'catalog'), why: typeof b.why === 'string' ? b.why : 'sync', from: typeof b.from === 'string' ? b.from : '' })
  }

  const handle = (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    const path = (req.url ?? '/').split('?')[0]
    if (path === '/events' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' })
      res.write('retry: 2000\n\n')
      res.write(`event: snapshot\ndata: ${JSON.stringify(state())}\n\n`)
      clients.add(res)
      req.on('close', () => { clients.delete(res) })
      return
    }
    if (path === '/' || path === '') {
      if (req.method === 'GET') return reply(res, 200, state())
      if (req.method === 'POST') {
        readBody(req)
          .then(text => { apply(JSON.parse(text) as Body); reply(res, 200, { ok: true, rev }) })
          .catch(() => reply(res, 400, { ok: false }))
        return
      }
    }
    next()
  }

  const mount = (server: Mountable) => {
    server.middlewares.use('/api/kds', handle)
    const beat = setInterval(() => clients.forEach(res => res.write(': ping\n\n')), 15000)
    server.httpServer?.once('close', () => { clearInterval(beat); clients.forEach(res => res.end()); clients.clear() })
  }

  return {
    name: 'kds-relay',
    configureServer(server) { mount(server) },
    configurePreviewServer(server) { mount(server) },
  }
}
