import { parseAdminIds } from './helpers.js'

const ADMIN = new Set(parseAdminIds())

export function isAdmin(userId) {
  return ADMIN.has(userId)
}
