import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// Mini scheduler maison (interval 60s) — simple démo.
export async function scheduleReminders(client) {
  try {
    const raw = readFileSync(join(process.cwd(), 'data', 'events.json'), 'utf8')
    const conf = JSON.parse(raw)
    const items = conf.reminders || []
    if (!items.length) return

    setInterval(async () => {
      const now = new Date()
      for (const it of items) {
        // Démo: envoie à 12:00 (cron simplifiée). Dans la vraie vie, utiliser node-cron.
        if (now.getHours() === 12 && now.getMinutes() === 0) {
          const ch = await client.channels.fetch(it.channelId).catch(() => null)
          if (ch) ch.send(it.message).catch(() => null)
        }
      }
    }, 60_000)
  } catch {}
}
