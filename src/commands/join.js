import { SlashCommandBuilder, MessageFlags } from 'discord.js'

export const data = new SlashCommandBuilder()
  .setName('join')
  .setDescription('Fait venir le bot dans ton salon vocal.')

export async function execute(client, interaction) {
  const member = await interaction.guild.members.fetch(interaction.user.id)
  const voice = member.voice?.channel
  if (!voice) {
    return interaction.reply({ content: "Rejoins d'abord un salon vocal.", flags: MessageFlags.Ephemeral })
  }
  const gm = client.music.get(interaction.guild)
  await gm.join(voice)
  await interaction.reply(`Connecté à **${voice.name}**.`)
}
