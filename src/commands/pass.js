import { SlashCommandBuilder } from 'discord.js'

export const data = new SlashCommandBuilder().setName('pass').setDescription('Passe à la musique suivante.')

export async function execute(client, interaction) {
  const gm = client.music.get(interaction.guild)
  gm.skip()
  await interaction.reply('⏭️ Musique suivante...')
}
