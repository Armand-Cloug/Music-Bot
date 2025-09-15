module.exports = {
  apps: [
    {
      name: 'music-bot',
      script: 'src/index.js',
      env: { NODE_ENV: 'production' },
      watch: false,
      autorestart: true,
      max_restarts: 10,
      time: true
    }
  ]
}
