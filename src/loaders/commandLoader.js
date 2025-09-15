import { readdirSync } from 'node:fs'
import { join } from 'node:path'

export async function loadCommands(client) {
  const commandsPath = join(process.cwd(), 'src', 'commands')
  const files = readdirSync(commandsPath).filter(f => f.endsWith('.js'))
  for (const f of files) {
    const cmd = await import(join(commandsPath, f))
    if (cmd?.data && cmd?.execute) {
      client.commands.set(cmd.data.name, cmd)
    }
  }
}
