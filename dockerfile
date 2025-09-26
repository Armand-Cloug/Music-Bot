FROM node:20-bookworm-slim

# ffmpeg + curl + python3 (requis par le binaire yt-dlp que l'on télécharge)
RUN apt-get update \
 && apt-get install -y --no-install-recommends ffmpeg curl ca-certificates python3 \
 && rm -rf /var/lib/apt/lists/* \
 && curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp \
 && chmod a+rx /usr/local/bin/yt-dlp

# user non-root
RUN useradd -m -u 10001 appuser
WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .
RUN chown -R appuser:appuser /app
USER appuser

ENV NODE_ENV=production
VOLUME ["/app/data"]

CMD ["npm", "run", "start"]