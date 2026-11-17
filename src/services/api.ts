/**
 * Mock API. Every function is async and shaped like the real backend calls,
 * so swapping in fetch() later is a local change.
 */
import { ROLES } from '../data/apps'
import { HOLDINGS, POS_PIN, USERS } from '../data/mock'
import type { Session, User } from '../data/types'
import { appAccess, routeFor, scopeHoldings } from './access'

const latency = (ms: number) => new Promise((r) => setTimeout(r, ms))

export class AuthError extends Error {}

function sessionFor(match: (typeof USERS)[number]): Session {
  const { password: _pw, pin: _pin, ...user } = match
  void _pw
  void _pin
  const holdings = scopeHoldings(HOLDINGS, user.assignment)
  const apps = appAccess(user as User, holdings)
  return {
    user,
    role: ROLES[user.role],
    holdings,
    apps,
    route: routeFor(user as User, holdings, apps),
    token: crypto.randomUUID(),
  }
}

export async function login(email: string, password: string): Promise<Session> {
  await latency(500)
  const match = USERS.find((u) => u.email.toLowerCase() === email.trim().toLowerCase())
  if (!match || !match.password || match.password !== password) throw new AuthError('Invalid credentials')
  return sessionFor(match)
}

/**
 * Staff PIN sign-in. With `userId` (a profile picked on the carousel) the PIN is checked for that person,
 * as on the POS. Without it (a badge or NFC card typed by a reader) the PIN alone identifies them.
 */
export async function loginWithPin(pin: string, userId?: string): Promise<Session> {
  await latency(350)
  const match = userId ? USERS.find((u) => u.id === userId && u.pin === pin) : USERS.find((u) => u.pin === pin && u.pin !== POS_PIN)
  if (!match) throw new AuthError('Unknown PIN')
  return sessionFor(match)
}
