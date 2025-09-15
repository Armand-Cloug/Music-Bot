// src/utils/helpers.js
export function parseAdminIds() {
  const raw = process.env.ADMIN_IDS || ''
  return raw.split(',').map(s => s.trim()).filter(Boolean)
}

/** Renvoie l'ID vidéo si trouvée, sinon null */
export function extractYouTubeId(raw) {
  if (!raw || typeof raw !== 'string') return null
  try {
    const u = new URL(raw)

    // youtu.be/<id>
    if (u.hostname.includes('youtu.be')) {
      const id = u.pathname.split('/').filter(Boolean)[0]
      return id || null
    }

    // youtube.com/shorts/<id>
    if (u.hostname.includes('youtube.com') && u.pathname.startsWith('/shorts/')) {
      const id = u.pathname.split('/').filter(Boolean)[1]
      return id || null
    }

    // youtube.com/embed/<id>
    if (u.hostname.includes('youtube.com') && u.pathname.startsWith('/embed/')) {
      const id = u.pathname.split('/').filter(Boolean)[1]
      return id || null
    }

    // youtube.com/watch?v=<id> (inclut music.youtube.com)
    if ((u.hostname.includes('youtube.com') || u.hostname.includes('music.youtube.com'))) {
      const id = u.searchParams.get('v')
      return id || null
    }

    return null
  } catch {
    return null
  }
}

/** Transforme n’importe quel lien YouTube (watch, youtu.be, shorts, embed, music) en URL canonique */
export function normalizeYouTubeUrl(raw) {
  const id = extractYouTubeId(raw)
  return id ? `https://www.youtube.com/watch?v=${id}` : null
}

