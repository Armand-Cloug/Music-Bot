# Dockerfile
FROM node:20-bookworm-slim

# Paquets système (ffmpeg) + binaire yt-dlp à jour
RUN apt-get update \
 && apt-get install -y --no-install-recommends ffmpeg curl ca-certificates \
 && rm -rf /var/lib/apt/lists/* \
 && curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp \
 && chmod a+rx /usr/local/bin/yt-dlp

# Créer un user non-root
RUN useradd -m -u 10001 appuser

WORKDIR /app

# Installer les deps en prod
COPY package*.json ./
RUN npm ci --omit=dev

# Copier le code
COPY . .

# Droits et env
RUN chown -R appuser:appuser /app
USER appuser
ENV NODE_ENV=production

# Dossier data (si tu l’utilises)
VOLUME ["/app/data"]

# Lancer le bot
CMD ["npm", "run", "start"]
