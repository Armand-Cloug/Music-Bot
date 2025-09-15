import { SlashCommandBuilder } from 'discord.js'

export const data = new SlashCommandBuilder().setName('pause').setDescription('Met en pause / reprend la lecture.')

export async function execute(client, interaction) {
  const gm = client.music.get(interaction.guild)
  const state = gm.togglePause()
  if (state === 'paused') return interaction.reply('⏸️ Pause.')
  if (state === 'resumed') return interaction.reply('▶️ Reprise.')
  return interaction.reply('Rien en lecture pour l\'instant.')
}
