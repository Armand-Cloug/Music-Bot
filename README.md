# 🎧 Music-Bot (Discord)

Un bot Discord minimaliste façon « Rythm » qui lit l’audio YouTube dans un salon vocal, avec file d’attente et commandes slash modernes.

> Pipeline audio robuste : **@distube/ytdl-core** ➜ **yt-dlp** (avec vos cookies YouTube si fournis) pour contourner les limites / anti‑bot.

---

## ✨ Fonctionnalités

* Lecture audio YouTube dans un salon vocal
* File d’attente (ajout, lecture continue, saut, pause/reprise)
* Commandes slash :

  * `/join` — fait venir le bot dans votre salon vocal
  * `/leave` — fait quitter le salon
  * `/add <url>` — ajoute une vidéo YouTube (et lance si rien ne joue)
  * `/queue` — affiche la file d’attente
  * `/pass` — passe au titre suivant
  * `/pause` — met en pause / reprend
  * `/reboot` — (optionnel) redémarrage via PM2 si vous l’utilisez hors Docker

---

## 📁 Arborescence (exemple)

```
.
├── data/
├── ecosystem.config.cjs          # (optionnel) PM2
├── package.json
└── src/
    ├── index.js                  # bootstrap
    ├── bot.js                    # client Discord
    ├── deploy-commands.js        # déploiement des slash-commands
    ├── commands/                 # /join, /leave, /add, /queue, /pass, /pause, /reboot
    ├── events/                   # clientReady, interactionCreate, etc.
    ├── loaders/                  # chargeurs de commandes & événements
    ├── schedulers/               # (ex.) reminder
    └── utils/
        ├── storage.js            # logique audio & file d’attente
        └── helpers.js            # helpers URL, UI, etc.
```

---

## 🔧 Prérequis

* **Discord Bot Token** ([https://discord.com/developers](https://discord.com/developers)) avec intents par défaut
* **Node.js 20+**
* **FFmpeg** (avec `libopus`)
* **yt-dlp** (binaire récent)
* **tweetnacl** (installé via npm) — chiffrement voix pour `@discordjs/voice`
* (Recommandé) **Cookies YouTube** pour éviter les vérifications/captchas

> Le code ne dépend **pas** de `play-dl` pour la lecture (seulement `ytdl-core` + `yt-dlp`).

---

## 🔑 Configuration

Créez un fichier `.env` à la racine en suivant le modèle .env.example

**À propos du cookie :** collez la valeur complète de l’en‑tête `Cookie` depuis un navigateur connecté à YouTube. Une seule ligne. Le code convertit automatiquement ce format pour `ytdl-core` et génère un `cookies.txt` Netscape pour `yt-dlp`.

---

## 🧪 Installation & exécution locale

```bash
# 1) Installer les dépendances Node
npm ci

# 2) Installer ffmpeg + yt-dlp sur votre machine (exemples)
# macOS (Homebrew) :
#   brew install ffmpeg yt-dlp
# Debian/Ubuntu :
#   sudo apt update && sudo apt install -y ffmpeg
#   sudo wget -O /usr/local/bin/yt-dlp \
#     https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp
#   sudo chmod a+rx /usr/local/bin/yt-dlp

# 3) Déployer les slash-commands (guilde de test)
npm run deploy:cmd

# 4) Démarrer le bot
npm run start
# (ou) npm run dev
```

---

## 🐳 Déploiement avec Docker

### Dockerfile

L’image inclut **Node 20**, **ffmpeg** et **yt-dlp** (binaire standalone). 

### Démarrage

```bash
# Build
docker compose build

# Déployer les slash-commands (profile tools)
docker compose --profile tools run --rm deploy-commands

# Lancer le bot
docker compose up -d

# Logs
docker compose logs -f bot
```

> Si vous modifiez `.env` (nouveau cookie par ex.), un `docker compose up -d` relance le conteneur avec les nouvelles variables.

---

## 🛠️ Déploiement des slash-commands

* **Dans une guilde de test** (rapide) : renseignez `GUILD_ID` dans `.env` puis

  ```bash
  npm run deploy:cmd
  # ou via docker :
  docker compose --profile tools run --rm deploy-commands
  ```
* **Global** (visible partout) : ajustez `deploy-commands.js` pour publier globalement.

---

## 🚑 Dépannage (FAQ)

**1) `@discordjs/voice` ➜ "Cannot play audio as no valid encryption package is installed"**

* Installez `tweetnacl` (ou `libsodium-wrappers`).

  ```bash
  npm i tweetnacl
  ```
* Vérifiez :

  ```js
  import { generateDependencyReport } from '@discordjs/voice'
  console.log(generateDependencyReport())
  ```

**2) Erreurs YouTube (429 / "Sign in to confirm you’re not a bot")**

* Mettez un cookie frais dans `YOUTUBE_COOKIE` (une seule ligne).
* `yt-dlp` doit être **à jour** :

  ```bash
  yt-dlp --version
  # si besoin :
  sudo wget -O /usr/local/bin/yt-dlp \
    https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp
  sudo chmod a+rx /usr/local/bin/yt-dlp
  ```

**3) Dans Docker :**

* `python3: not found` ➜ utilisez le binaire autonome (`yt-dlp_linux`) **ou** installez `python3` dans l’image.
* Vérifications utiles :

  ```bash
  docker exec -it music-bot which yt-dlp
  docker exec -it music-bot yt-dlp --version
  docker exec -it music-bot ffmpeg -version
  ```

**4) Rien ne joue malgré l’ajout**

* Assurez-vous que le bot est **dans** le salon (`/join`).
* `ffmpeg` présent et `libopus: yes` (voir rapport de dépendances au démarrage).

**5) Les titres affichés sont "Vidéo YouTube"**

* Ils seront complétés par `yt-dlp` à la volée. Si YouTube est capricieux, vérifiez votre `YOUTUBE_COOKIE`.

---

## 🔐 Bonnes pratiques

* Ne commitez jamais votre `DISCORD_TOKEN` ou votre cookie.
* Mettez `YOUTUBE_COOKIE` à jour régulièrement.
* Limitez les permissions du bot (pas besoin d’admin).

---

## 📝 Licence

MIT — faites‑en bon usage 🎶
