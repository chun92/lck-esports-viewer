import { fetchTeams } from './api'

export type TeamLinkMap = Map<string, string>

let cache: TeamLinkMap | null = null
let inflight: Promise<TeamLinkMap> | null = null

export function loadKnownTeams(): Promise<TeamLinkMap> {
  if (cache instanceof Map) return Promise.resolve(cache)
  cache = null
  if (inflight) return inflight
  inflight = fetchTeams()
    .then((teams) => {
      const map: TeamLinkMap = new Map()
      for (const t of teams) {
        map.set(t.OverviewPage.toLowerCase(), t.OverviewPage)
        if (t.Name) map.set(t.Name.toLowerCase(), t.OverviewPage)
        for (const n of t.FormerNames || []) {
          map.set(n.toLowerCase(), t.OverviewPage)
        }
      }
      cache = map
      return cache
    })
    .finally(() => {
      inflight = null
    })
  return inflight
}

export function resolveTeamLink(
  teams: TeamLinkMap | null | undefined,
  name: string | undefined | null
): string | null {
  if (!(teams instanceof Map) || !name) return null
  return teams.get(name.toLowerCase()) ?? null
}
