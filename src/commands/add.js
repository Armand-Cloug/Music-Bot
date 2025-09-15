// src/commands/add.js
import { SlashCommandBuilder, MessageFlags } from 'discord.js'
import { normalizeYouTubeUrl } from '../utils/helpers.js'

export const data = new SlashCommandBuilder()
  .setName('add')
  .setDescription("Ajoute une vidéo YouTube à la file d'attente (et lance si rien ne joue).")
  .addStringOption(opt =>
    opt.setName('url')
      .setDescription("Lien d'une vidéo YouTube")
      .setRequired(true)
  )

export async function execute(client, interaction) {
  const raw = interaction.options.getString('url', true)
  const url = normalizeYouTubeUrl(raw)

  if (!url) {
    return interaction.reply({
      content: "❌ Lien YouTube invalide. Envoie un lien **vers une vidéo** (pas une playlist).",
      flags: MessageFlags.Ephemeral
    })
  }

  const member = await interaction.guild.members.fetch(interaction.user.id)
  const voice = member.voice?.channel
  const gm = client.music.get(interaction.guild)

  if (!gm.connection) {
    if (!voice) {
      return interaction.reply({
        content: "Je ne suis pas connecté. Rejoins un salon et fais /join d'abord.",
        flags: MessageFlags.Ephemeral
      })
    }
    await gm.join(voice)
  }

  await interaction.deferReply()
  try {
    const { started, title } = await gm.add(url, interaction.user.username)
    if (started) return interaction.editReply(`▶️ Lecture: **${title}**`)
    return interaction.editReply(`➕ Ajouté à la file: **${title}**`)
  } catch (e) {
    console.error('ADD ERROR:', e)
    const hint = [
      "❌ Impossible de récupérer la vidéo.",
      "• Si le lien vient d'une playlist/\"radio\", j'ai extrait la vidéo — réessaie si besoin.",
      "• Si YouTube bloque, mets `YOUTUBE_COOKIE=\"...\"` dans `.env` puis redémarre."
    ].join('\n')
    return interaction.editReply(hint)
  }
}
