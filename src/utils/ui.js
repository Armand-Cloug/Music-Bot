import { EmbedBuilder } from 'discord.js'
import { COLORS, EMOJI } from './constants.js'

export function queueEmbed(queue) {
  const embed = new EmbedBuilder().setTitle('🎶 File d\'attente').setColor(COLORS.primary)
  if (!queue || queue.length === 0) return embed.setDescription('La file est vide.')
  const lines = queue.map((t, i) => `${i === 0 ? EMOJI.play : `${i}.`} **${t.title}** \`[${t.durationText}]\` — demandé par ${t.requestedBy}`)
  return embed.setDescription(lines.join('\n'))
}
