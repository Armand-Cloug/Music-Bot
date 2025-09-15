import 'dotenv/config'

// --- Polyfill Node 18 pour undici (File/Blob/FormData) ---
try {
  const undici = await import('undici')
  if (undici?.File && !globalThis.File) globalThis.File = undici.File
  if (undici?.Blob && !globalThis.Blob) globalThis.Blob = undici.Blob
  if (undici?.FormData && !globalThis.FormData) globalThis.FormData = undici.FormData
} catch { /* ignore */ }

import { createBot } from './bot.js'
import { loadCommands } from './loaders/commandLoader.js'
import { loadEvents } from './loaders/eventLoader.js'
import { scheduleReminders } from './schedulers/reminder.js'
import { generateDependencyReport } from '@discordjs/voice'

const client = createBot()
await loadCommands(client)
await loadEvents(client)
await scheduleReminders(client)

console.log(generateDependencyReport())

client.login(process.env.DISCORD_TOKEN)
