import { MessageFlags } from 'discord.js'

export const name = 'interactionCreate'
export async function execute(client, interaction) {
  if (!interaction.isChatInputCommand()) return
  const cmd = client.commands.get(interaction.commandName)
  if (!cmd) return
  try {
    await cmd.execute(client, interaction)
  } catch (e) {
    console.error(e)
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply('❌ Erreur')
    } else {
      await interaction.reply({ content: '❌ Erreur', flags: MessageFlags.Ephemeral })
    }
  }
}
