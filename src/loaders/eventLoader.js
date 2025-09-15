import { readdirSync } from 'node:fs'
import { join } from 'node:path'

export async function loadEvents(client) {
  const eventsPath = join(process.cwd(), 'src', 'events')
  const files = readdirSync(eventsPath).filter(f => f.endsWith('.js'))
  for (const f of files) {
    const ev = await import(join(eventsPath, f))
    if (ev?.name && typeof ev?.execute === 'function') {
      if (ev.once) client.once(ev.name, (...args) => ev.execute(client, ...args))
      else client.on(ev.name, (...args) => ev.execute(client, ...args))
    }
  }
}
