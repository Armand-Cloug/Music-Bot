import { SlashCommandBuilder } from 'discord.js'
import { queueEmbed } from '../utils/ui.js'

export const data = new SlashCommandBuilder().setName('queue').setDescription('Affiche la file d\'attente.')

export async function execute(client, interaction) {
  const gm = client.music.get(interaction.guild)
  const embed = queueEmbed(gm.queue)
  await interaction.reply({ embeds: [embed] })
}
