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
  try {
    const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome Safari'
    const made = await makeCookiesTxtFromEnv()
    const bin = await resolveYtDlpPath()

    const args = [
      '--dump-single-json',
      '--no-playlist',
      '--no-warnings',
      '--ignore-config',
      '--no-progress',
      '--force-ipv4',
      '--user-agent', ua,
      '--extractor-args', 'youtube:player_client=web'
    ]
    if (made?.cookieFile) {
      args.push('--cookies', made.cookieFile)
    }
    args.push(url)

    const y = spawn(bin, args, { stdio: ['ignore', 'pipe', 'pipe'] })

    let out = ''
    let err = ''
    y.stdout.on('data', d => (out += d.toString()))
    y.stderr.on('data', d => (err += d.toString()))

    const code = await new Promise(res => y.on('close', res))

    if (made?.cookieFile) {
      try { await fsp.rm(made.cookieFile, { force: true }) } catch {}
      try { await fsp.rm(made.tmpdir, { recursive: true, force: true }) } catch {}
    }

    if (code !== 0) {
      console.warn('[yt-dlp:title] exit', code, '\n', err || '(stderr empty)')
      return null
    }

    const json = JSON.parse(out || '{}')
    return json?.title || null
  } catch {
    return null
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

    // ✅ validation simple sans play-dl
    const id = extractYouTubeId(url)
    if (!id) throw new Error('Lien YouTube invalide (pas une vidéo).')

    // Titre provisoire
    let title = 'Vidéo YouTube'
    let durationText = '—'

    // Mise à jour asynchrone du titre via yt-dlp (si dispo)
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

    // 1) Fallback @distube/ytdl-core (cookies au nouveau format)
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

    // 2) Fallback final : yt-dlp CLI (2 essais : web+cookies puis tv_embedded sans cookies)
    try {
      const bin = await resolveYtDlpPath()
      const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome Safari'

      // ----- Essai A : client web + cookies -----
      let made = await makeCookiesTxtFromEnv()
      let args = [
        '-f', 'bestaudio[ext=webm]/bestaudio/best',
        '--no-playlist',
        '--no-check-certificate',
        '--ignore-config',
        '--no-progress',
        '--force-ipv4',
        '--user-agent', ua,
        '--extractor-args', 'youtube:player_client=web'
      ]
      if (made?.cookieFile) {
        args.push('--cookies', made.cookieFile)
      }
      args.push('-o', '-')
      args.push(current.url)

      console.log('[yt-dlp] spawn (web):', [bin, ...args].join(' '))
      let ytdlp = spawn(bin, args, { stdio: ['ignore', 'pipe', 'pipe'] })

      let stderrBuf = ''
      ytdlp.stderr.on('data', d => { stderrBuf += d.toString() })
      ytdlp.on('error', err => { console.error('yt-dlp spawn error:', err) })

      try {
        const { stream, type } = await demuxProbe(ytdlp.stdout)
        const resource = createAudioResource(stream, { inputType: type })
        this.player.play(resource)
        ytdlp.on('close', async code => {
          if (code && code !== 0) {
            console.warn('yt-dlp exited with code', code, '\nlast stderr:\n', stderrBuf || '(empty)')
          }
          try { await fsp.rm(made?.cookieFile ?? '', { force: true }) } catch {}
          try { await fsp.rm(made?.tmpdir ?? '', { force: true, recursive: true }) } catch {}
        })
        return
      } catch (probeErr) {
        // stoppe le process web et nettoie
        try { ytdlp.kill('SIGKILL') } catch {}
        try { await fsp.rm(made?.cookieFile ?? '', { force: true }) } catch {}
        try { await fsp.rm(made?.tmpdir ?? '', { force: true, recursive: true }) } catch {}
        console.warn('[yt-dlp] web attempt failed, stderr:', stderrBuf || '(empty)')
      }

      // ----- Essai B : client tv_embedded (souvent plus permissif), SANS cookies -----
      args = [
        '-f', 'bestaudio[ext=webm]/bestaudio/best',
        '--no-playlist',
        '--no-check-certificate',
        '--ignore-config',
        '--no-progress',
        '--force-ipv4',
        '--user-agent', ua,
        '--extractor-args', 'youtube:player_client=tv_embedded',
        '-o', '-',
        current.url
      ]

      console.log('[yt-dlp] spawn (tv_embedded):', [bin, ...args].join(' '))
      ytdlp = spawn(bin, args, { stdio: ['ignore', 'pipe', 'pipe'] })

      stderrBuf = ''
      ytdlp.stderr.on('data', d => { stderrBuf += d.toString() })
      ytdlp.on('error', err => { console.error('yt-dlp spawn error:', err) })

      const { stream, type } = await demuxProbe(ytdlp.stdout)
      const resource = createAudioResource(stream, { inputType: type })
      this.player.play(resource)
      ytdlp.on('close', async code => {
        if (code && code !== 0) {
          console.warn('yt-dlp exited with code', code, '\nlast stderr:\n', stderrBuf || '(empty)')
        }
      })
      return
    } catch (e) {
      console.error('yt-dlp fallback failed, skipping:', e, '\nURL =', current.url)
      this.queue.shift()
      if (this.queue.length > 0) return this.playNext()
      this.player.stop(true)
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
