// src/events/clientReady.js
export const name = 'clientReady'
export const once = true
export function execute(client) {
  console.log(`✅ Connecté en tant que ${client.user.tag}`)
}
