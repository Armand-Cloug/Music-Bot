import { SlashCommandBuilder } from 'discord.js'

export const data = new SlashCommandBuilder().setName('leave').setDescription('Fait quitter le salon vocal au bot.')

export async function execute(client, interaction) {
  const gm = client.music.get(interaction.guild)
  gm.leave()
  await interaction.reply('👋 Déconnecté du salon vocal.')
}
