import { Client, GatewayIntentBits, Partials, Collection } from 'discord.js'
import { createMusicManager } from './utils/storage.js'

export function createBot() {
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildVoiceStates
    ],
    partials: [Partials.GuildMember]
  })

  // Collections & managers custom
  client.commands = new Collection()
  client.music = createMusicManager() // file d'attente par guilde

  return client
}
