import { fetchHistoricalLogos, fetchTeams } from './api'

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
  inflight = Promise.all([fetchTeams(), fetchHistoricalLogos()])
    .then(([teams, historical]) => {
      const historicalByKey = new Map<string, string>()
      for (const [name, info] of Object.entries(historical)) {
        if (info.LogoUrl) historicalByKey.set(name.toLowerCase(), info.LogoUrl)
      }

      const map: TeamLinkMap = new Map()
      for (const t of teams) {
        const canonical: TeamLinkInfo = {
          OverviewPage: t.OverviewPage,
          LogoUrl: t.LogoUrl || '',
        }
        map.set(t.OverviewPage.toLowerCase(), canonical)
        if (t.Name) map.set(t.Name.toLowerCase(), canonical)
        for (const n of t.FormerNames || []) {
          const key = n.toLowerCase()
          map.set(key, {
            OverviewPage: t.OverviewPage,
            LogoUrl: historicalByKey.get(key) ?? canonical.LogoUrl,
          })
        }
      }
      for (const [key, logoUrl] of historicalByKey.entries()) {
        if (!map.has(key)) {
          map.set(key, { OverviewPage: '', LogoUrl: logoUrl })
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
