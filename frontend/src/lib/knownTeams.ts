import { fetchTeams } from './api'

export interface TeamLinkInfo {
  OverviewPage: string
  LogoUrl: string
}

export type TeamLinkMap = Map<string, TeamLinkInfo>

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
        const info: TeamLinkInfo = {
          OverviewPage: t.OverviewPage,
          LogoUrl: t.LogoUrl || '',
        }
        map.set(t.OverviewPage.toLowerCase(), info)
        if (t.Name) map.set(t.Name.toLowerCase(), info)
        for (const n of t.FormerNames || []) {
          map.set(n.toLowerCase(), info)
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

export function resolveTeamInfo(
  teams: TeamLinkMap | null | undefined,
  name: string | undefined | null
): TeamLinkInfo | null {
  if (!(teams instanceof Map) || !name) return null
  return teams.get(name.toLowerCase()) ?? null
}

export function resolveTeamLink(
  teams: TeamLinkMap | null | undefined,
  name: string | undefined | null
): string | null {
  return resolveTeamInfo(teams, name)?.OverviewPage ?? null
}
