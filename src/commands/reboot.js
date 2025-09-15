import { SlashCommandBuilder, MessageFlags } from 'discord.js'
import { isAdmin } from '../utils/permissions.js'
import { exec as execCb } from 'node:child_process'
import { promisify } from 'node:util'
const exec = promisify(execCb)

export const data = new SlashCommandBuilder()
  .setName('reboot')
  .setDescription('Redémarre le bot (PM2). Commande réservée aux admins configurés.')

export async function execute(client, interaction) {
  if (!isAdmin(interaction.user.id)) {
    return interaction.reply({ content: "⛔ Tu n'es pas autorisé à utiliser cette commande.", flags: MessageFlags.Ephemeral })
  }
  const app = process.env.PM2_APP_NAME || 'raid-music-bot'
  await interaction.reply('♻️ Redémarrage du bot…')
  try {
    await exec(`pm2 restart ${app}`)
  } catch (e) {
    return interaction.followUp({ content: '❌ Echec du redémarrage : ' + (e?.message || e), flags: MessageFlags.Ephemeral })
  }
}
