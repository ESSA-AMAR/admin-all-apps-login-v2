/** Recently opened targets (stores/brands/holdings) per user, so the picker can offer them first. */
const key = (userId: string) => `cm:recent-targets:${userId}`

export function recentTargets(userId: string): string[] {
  try {
    return JSON.parse(localStorage.getItem(key(userId)) ?? '[]')
  } catch {
    return []
  }
}

export function rememberTarget(userId: string, target: string) {
  try {
    const next = [target, ...recentTargets(userId).filter((t) => t !== target)].slice(0, 4)
    localStorage.setItem(key(userId), JSON.stringify(next))
  } catch {
    // storage unavailable (private mode): recents are a convenience only
  }
}
