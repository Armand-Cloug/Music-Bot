// src/utils/storage.js
import {
  AudioPlayerStatus,
  NoSubscriberBehavior,
  createAudioPlayer,
  createAudioResource,
  joinVoiceChannel,
  VoiceConnectionStatus,
  entersState,
  getVoiceConnection,
  demuxProbe
} from '@discordjs/voice'
import { ChannelType } from 'discord.js'
import { extractYouTubeId } from './helpers.js'
import { spawn } from 'node:child_process'
import { promises as fsp } from 'node:fs'
import os from 'node:os'
import { join as pathJoin } from 'node:path'

/* -------------------- Résolution du binaire yt-dlp -------------------- */
async function resolveYtDlpPath() {
  const candidates = ['/usr/local/bin/yt-dlp', '/usr/bin/yt-dlp', 'yt-dlp']
  for (const p of candidates) {
    try { await fsp.access(p); return p } catch {}
  }
  return 'yt-dlp'
}

/* -------------------- Helpers cookies & titre (yt-dlp) -------------------- */

async function makeCookiesTxtFromEnv() {
  const raw = process.env.YOUTUBE_COOKIE || ''
  if (!raw) return null

  const far = 2147483647
  const pairs = raw.split(';').map(s => s.trim()).filter(Boolean).map(kv => {
    const i = kv.indexOf('=')
    const name = i === -1 ? kv : kv.slice(0, i)
    const value = i === -1 ? '' : kv.slice(i + 1)
    return { name, value }
  })

  const toLine = (domain, name, value) =>
    `${domain}\tTRUE\t/\tTRUE\t${far}\t${name}\t${value}\n`

  let netscape = '# Netscape HTTP Cookie File\n'
  for (const { name, value } of pairs) {
    if (!name) continue
    netscape += toLine('.youtube.com', name, value)
    netscape += toLine('.google.com', name, value)
  }

  const tmpdir = await fsp.mkdtemp(pathJoin(os.tmpdir(), 'ytcookie-'))
  const cookieFile = pathJoin(tmpdir, 'cookies.txt')
  await fsp.writeFile(cookieFile, netscape, 'utf8')
  return { cookieFile, tmpdir }
}

async function fetchTitleWithYtDlp(url) {
  // On tente tv_embedded (souvent + permissif), puis web
  const bin = await resolveYtDlpPath()
  const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome Safari'
  const tryOnce = async (client, cookieFile) => {
    const args = [
      '--dump-single-json',
      '--no-playlist',
      '--no-warnings',
      '--ignore-config',
      '--no-progress',
      '--force-ipv4',
      '--user-agent', ua,
      '--extractor-args', `youtube:player_client=${client}`
    ]
    if (cookieFile) args.push('--cookies', cookieFile)
    args.push(url)

    return await new Promise((res) => {
      const y = spawn(bin, args, { stdio: ['ignore', 'pipe', 'pipe'] })
      let out = '', err = ''
      y.stdout.on('data', d => (out += d.toString()))
      y.stderr.on('data', d => (err += d.toString()))
      y.on('close', code => {
        if (code === 0) {
          try { const json = JSON.parse(out || '{}'); res(json?.title || null) }
          catch { res(null) }
        } else {
          console.warn(`[yt-dlp:title ${client}] exit ${code}\n${err || '(stderr empty)'}`)
          res(null)
        }
      })
    })
  }

  const made = await makeCookiesTxtFromEnv()
  try {
    // A) tv_embedded (sans cookies)
    let title = await tryOnce('tv_embedded', null)
    if (title) return title
    // B) web (avec cookies)
    title = await tryOnce('web', made?.cookieFile || null)
    return title
  } finally {
    if (made?.cookieFile) try { await fsp.rm(made.cookieFile, { force: true }) } catch {}
    if (made?.tmpdir) try { await fsp.rm(made.tmpdir, { recursive: true, force: true }) } catch {}
  }
}

/* ----------------------------- Music Manager ------------------------------ */

class GuildMusic {
  constructor(guild) {
    this.guild = guild
    this.queue = [] // { url, title, durationText, requestedBy }
    this.player = createAudioPlayer({ behaviors: { noSubscriber: NoSubscriberBehavior.Pause } })

    this.player.on('error', (e) => console.error('Player error:', e))
    this.player.on(AudioPlayerStatus.Idle, () => {
      this.queue.shift()
      this.playNext()
    })
  }

  get connection() { return getVoiceConnection(this.guild.id) }

  async join(channel) {
    if (!channel || channel.type !== ChannelType.GuildVoice) throw new Error('Salon vocal invalide.')
    const conn = joinVoiceChannel({
      channelId: channel.id,
      guildId: channel.guild.id,
      adapterCreator: channel.guild.voiceAdapterCreator,
      selfDeaf: true,
    })
    try {
      await entersState(conn, VoiceConnectionStatus.Ready, 20_000)
      conn.subscribe(this.player)
      return conn
    } catch (e) {
      conn.destroy()
      throw e
    }
  }

  leave() {
    const conn = this.connection
    if (conn) conn.destroy()
  }

  // url doit être canonique (https://www.youtube.com/watch?v=ID)
  async add(url, requestedBy) {
    if (!url || typeof url !== 'string') throw new Error('URL manquante.')

    const id = extractYouTubeId(url)
    if (!id) throw new Error('Lien YouTube invalide (pas une vidéo).')

    let title = 'Vidéo YouTube'
    let durationText = '—'

    fetchTitleWithYtDlp(url).then(t => {
      if (t) {
        const entry = this.queue.find(q => q.url === url && q.requestedBy === requestedBy)
        if (entry) entry.title = t
      }
    }).catch(() => {})

    this.queue.push({ url, title, durationText, requestedBy })

    if (this.player.state.status !== AudioPlayerStatus.Playing && this.queue.length === 1) {
      await this.playNext()
      return { started: true, title }
    }
    return { started: false, title }
  }

  async playNext() {
    if (this.queue.length === 0) {
      this.player.stop(true)
      return
    }

    const current = this.queue[0]
    if (!current || !current.url || typeof current.url !== 'string') {
      console.error('Queue entry invalide, on skip:', current)
      this.queue.shift()
      if (this.queue.length > 0) return this.playNext()
      this.player.stop(true)
      return
    }

    // 1) @distube/ytdl-core (avec cookies) — peut échouer sur 429 : on ignore et on file sur yt-dlp
    try {
      const undici = await import('undici')
      if (undici?.File && !globalThis.File) globalThis.File = undici.File
      if (undici?.Blob && !globalThis.Blob) globalThis.Blob = undici.Blob
      if (undici?.FormData && !globalThis.FormData) globalThis.FormData = undici.FormData

      const { default: ytdl } = await import('@distube/ytdl-core')

      const raw = process.env.YOUTUBE_COOKIE || ''
      const cookies = raw
        .split(';')
        .map(s => s.trim())
        .filter(Boolean)
        .map(kv => {
          const i = kv.indexOf('=')
          const name = i === -1 ? kv : kv.slice(0, i)
          const value = i === -1 ? '' : kv.slice(i + 1)
          return {
            name, value,
            domain: '.youtube.com',
            path: '/',
            hostOnly: false,
            creation: new Date().toISOString(),
            lastAccessed: new Date().toISOString()
          }
        })

      const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome Safari'
      const ytdlStream = ytdl(current.url, {
        filter: 'audioonly',
        quality: 'highestaudio',
        highWaterMark: 1 << 25,
        requestOptions: { headers: { 'user-agent': ua, referer: 'https://www.youtube.com/' } },
        cookies: cookies.length ? cookies : undefined
      })

      const { stream, type } = await demuxProbe(ytdlStream)
      const resource = createAudioResource(stream, { inputType: type })
      this.player.play(resource)
      return
    } catch (e) {
      console.error('@distube/ytdl-core failed, trying yt-dlp:', e, '\nURL =', current.url)
    }

    // 2) yt-dlp — Essai A: tv_embedded (SANS cookies), formats relaxés
    try {
      await this._playWithYtDlp(current.url, {
        client: 'tv_embedded',
        useCookies: false
      })
      return
    } catch (e) {
      console.warn('[yt-dlp] tv_embedded failed:', e?.message || e)
    }

    // 3) yt-dlp — Essai B: web (AVEC cookies), formats relaxés
    try {
      await this._playWithYtDlp(current.url, {
        client: 'web',
        useCookies: true
      })
      return
    } catch (e) {
      console.warn('[yt-dlp] web failed:', e?.message || e)
    }

    // 4) yt-dlp — Essai C: ios (AVEC cookies), formats relaxés
    try {
      await this._playWithYtDlp(current.url, {
        client: 'ios',
        useCookies: true
      })
      return
    } catch (e) {
      console.warn('[yt-dlp] ios failed:', e?.message || e)
    }

    // Échec total : on skip
    console.error('yt-dlp fallback failed, skipping:', '\nURL =', current.url)
    this.queue.shift()
    if (this.queue.length > 0) return this.playNext()
    this.player.stop(true)
  }

  async _playWithYtDlp(url, { client, useCookies }) {
    const bin = await resolveYtDlpPath()
    const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome Safari'

    // Formats RELAXÉS : on n’impose plus webm — laisse yt-dlp choisir le meilleur audio dispo
    const baseArgs = [
      '-f', 'bestaudio/best',
      '--no-playlist',
      '--no-check-certificate',
      '--ignore-config',
      '--no-progress',
      '--force-ipv4',
      '--hls-prefer-ffmpeg',
      '--user-agent', ua,
      '--extractor-args', `youtube:player_client=${client}`,
      '-o', '-',
      url
    ]

    // Cookies si demandés
    let made = null
    if (useCookies) {
      made = await makeCookiesTxtFromEnv()
      if (made?.cookieFile) baseArgs.splice(baseArgs.length - 2, 0, '--cookies', made.cookieFile)
    }

    console.log(`[yt-dlp] spawn (${client}):`, [bin, ...baseArgs].join(' '))
    const ytdlp = spawn(bin, baseArgs, { stdio: ['ignore', 'pipe', 'pipe'] })

    let stderrBuf = ''
    ytdlp.stderr.on('data', d => { stderrBuf += d.toString() })
    ytdlp.on('error', err => { console.error('yt-dlp spawn error:', err) })

    try {
      const { stream, type } = await demuxProbe(ytdlp.stdout)
      const resource = createAudioResource(stream, { inputType: type })
      this.player.play(resource)
    } catch (probeErr) {
      try { ytdlp.kill('SIGKILL') } catch {}
      throw new Error(stderrBuf || String(probeErr))
    } finally {
      if (made?.cookieFile) try { await fsp.rm(made.cookieFile, { force: true }) } catch {}
      if (made?.tmpdir) try { await fsp.rm(made.tmpdir, { recursive: true, force: true }) } catch {}
    }
  }

  togglePause() {
    if (this.player.state.status === AudioPlayerStatus.Playing) { this.player.pause(); return 'paused' }
    if (this.player.state.status === AudioPlayerStatus.Paused) { this.player.unpause(); return 'resumed' }
    return 'idle'
  }

  skip() {
    this.player.stop(true)
  }
}

const musicByGuild = new Map()
export function createMusicManager() {
  return {
    get(guild) {
      if (!musicByGuild.has(guild.id)) musicByGuild.set(guild.id, new GuildMusic(guild))
      return musicByGuild.get(guild.id)
    }
  }
}
