import 'dotenv/config'
import { REST, Routes } from 'discord.js'
import { readdirSync } from 'node:fs'
import { join } from 'node:path'

const { DISCORD_TOKEN, CLIENT_ID, GUILD_ID } = process.env
if (!DISCORD_TOKEN || !CLIENT_ID) {
  console.error('DISCORD_TOKEN et CLIENT_ID sont requis dans .env')
  process.exit(1)
}

const commandsDir = join(process.cwd(), 'src', 'commands')
const files = readdirSync(commandsDir).filter(f => f.endsWith('.js'))
const commands = []
for (const f of files) {
  const mod = await import(join(commandsDir, f))
  if (mod?.data?.toJSON) commands.push(mod.data.toJSON())
}

const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN)
try {
  if (GUILD_ID) {
    await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands })
    console.log('✅ Commands enregistrées sur la guilde', GUILD_ID)
  } else {
    await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands })
    console.log('✅ Commands enregistrées globalement')
  }
} catch (e) {
  console.error('❌ Echec deploy commands:', e)
}
