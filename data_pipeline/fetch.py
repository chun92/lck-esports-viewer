from mwrogue.esports_client import EsportsClient # type: ignore
from mwrogue.auth_credentials import AuthCredentials # type: ignore
from datetime import datetime
import argparse
import csv
import time
import requests


from paths import get_raw_file_path, get_last_fetched, set_last_fetched

credentials = AuthCredentials(user_file="me")
site = EsportsClient('lol', credentials=credentials)


# 재시도 대상 패턴: rate limit / 일시적 네트워크 / 서버 오류
_RETRYABLE_KEYWORDS = (
    "ratelimited",
    "timed out", "timeout",
    "connection", "connectionerror",
    "maximum retries", "maximumretriesexceeded",
    "temporarily unavailable",
    "502", "503", "504",
    "remote end closed",
    "broken pipe",
    "incomplete read",
    "ssl",
)


def _classify_retryable(e):
    """(retryable, kind) 반환. kind는 로그용 문자열."""
    if isinstance(e, requests.exceptions.RequestException):
        return True, type(e).__name__
    s = str(e).lower()
    if "ratelimited" in s:
        return True, "rate-limit"
    for kw in _RETRYABLE_KEYWORDS:
        if kw in s:
            return True, kw
    return False, ""


def fetch_with_retry(query_fn, retries=8, backoff=30):
    last_err = None
    for attempt in range(retries):
        try:
            return query_fn()
        except Exception as e:
            retryable, kind = _classify_retryable(e)
            if not retryable:
                raise
            wait = backoff * (attempt + 1)  # 30, 60, 90, ... 240초
            msg = str(e)[:200]
            print(f"[retry {attempt + 1}/{retries}] {kind}: {msg} → {wait}초 대기")
            time.sleep(wait)
            last_err = e

    raise Exception(f"All {retries} attempts failed (last error: {last_err!r})")


def fetch_with_offset(query_fn, table_name):
    all_results = []
    offset = 0
    limit = 500  # 한 번에 가져올 레코드 수
    
    print(f"Fetching {table_name}...")
    while True:
        print(f"Fetching {table_name} with offset {offset}...")
        batch = fetch_with_retry(lambda: query_fn(offset, limit))
        if not batch:
            break
        all_results.extend(batch)
        offset += limit
        print(f"Fetched {len(batch)} records, total so far: {len(all_results)}")
        time.sleep(5)  # 쿼리 사이에 5초 대기

    print(f"Finished fetching {table_name}. Total records: {len(all_results)}")
    return all_results


def fetch_players(filters=None):
    filters = filters or {}
    country = filters.get("country")
    where_clause = f'Country="{country}"' if country else None
    batch_query_fn = lambda offset, limit: site.cargo_client.query(
        tables="Players",
        fields="ID,Player,Name,NativeName,Country,Age,Birthdate,Team,Team2,CurrentTeams,Role,TeamLast,RoleLast,IsRetired",
        where=where_clause,
        limit=limit,
        offset=offset
    )
    return fetch_with_offset(batch_query_fn, "players")


def fetch_tenures(filters=None):
    filters = filters or {}
    country = filters.get("country")
    since_date = filters.get("since_date")
    conditions = []
    if country:
        conditions.append(f'P.Country="{country}"')
    if since_date:
        conditions.append(f'T.DateJoin>="{since_date}"')
    where_clause = " AND ".join(conditions) if conditions else None

    batch_query_fn = lambda offset, limit: site.cargo_client.query(
        tables="Tenures=T, Players=P",
        join_on="T.Player=P.Player",
        fields="T.Player,T.Team,T.DateJoin,T.DateLeave,T.Duration,T.ContractEnd,T.RosterChangeIdJoin,T.RosterChangeIdLeave,T.NameLeave,T.NextTeam,T.NextIsRetired,T.IsCurrent",
        where=where_clause,
        limit=limit,
        offset=offset
    )
    return fetch_with_offset(batch_query_fn, "tenures")

def fetch_roster_changes(filters=None):
    filters = filters or {}
    country = filters.get("country")
    since_date = filters.get("since_date")
    conditions = []
    if country:
        conditions.append(f'P.Country="{country}"')
    if since_date:
        conditions.append(f'R.Date_Sort>="{since_date}"')
    where_clause = " AND ".join(conditions) if conditions else None
    
    batch_query_fn = lambda offset, limit: site.cargo_client.query(
        tables="RosterChanges=R, Players=P",
        join_on="R.Player=P.Player",
        fields="R.Player,R.Date_Sort,R.Direction,R.Team,R.Role,R.Status,R.RosterChangeId",
        where=where_clause,
        limit=limit,
        offset=offset
    )
    return fetch_with_offset(batch_query_fn, "roster changes")

def fetch_teams(filters=None):
    batch_query_fn = lambda offset, limit: site.cargo_client.query(
        tables="Teams",
        fields="Name,Short,OverviewPage,Region,Image,IsDisbanded,RenamedTo",
        limit=limit,
        offset=offset
    )
    return fetch_with_offset(batch_query_fn, "teams")


def fetch_team_renames(filters=None):
    batch_query_fn = lambda offset, limit: site.cargo_client.query(
        tables="TeamRenames",
        fields="Date,OriginalName,NewName,Verb,Slot,IsSamePage,NewsId",
        limit=limit,
        offset=offset
    )
    return fetch_with_offset(batch_query_fn, "team_renames")


def fetch_player_images(filters=None):
    filters = filters or {}
    country = filters.get("country")
    conditions = ['PI.IsProfileImage="1"']
    if country:
        conditions.append(f'P.Country="{country}"')
    where_clause = " AND ".join(conditions)

    batch_query_fn = lambda offset, limit: site.cargo_client.query(
        tables="PlayerImages=PI, Players=P",
        join_on="PI.Link=P.Player",
        fields="PI.Link=Link, PI.FileName=FileName, PI.Caption=Caption, PI.Team=Team, PI.Tournament=Tournament, PI.SortDate=SortDate",
        where=where_clause,
        limit=limit,
        offset=offset
    )
    return fetch_with_offset(batch_query_fn, "player_images")


def fetch_leagues(filters=None):
    batch_query_fn = lambda offset, limit: site.cargo_client.query(
        tables="Leagues",
        fields="League,League_Short,Region,Level,IsOfficial",
        limit=limit,
        offset=offset
    )
    return fetch_with_offset(batch_query_fn, "leagues")


def fetch_current_leagues(filters=None):
    batch_query_fn = lambda offset, limit: site.cargo_client.query(
        tables="CurrentLeagues",
        fields="Event,OverviewPage,Priority",
        limit=limit,
        offset=offset
    )
    return fetch_with_offset(batch_query_fn, "current_leagues")


def fetch_league_groups(filters=None):
    batch_query_fn = lambda offset, limit: site.cargo_client.query(
        tables="LeagueGroups",
        fields="LongName,ShortName,Leagues",
        limit=limit,
        offset=offset
    )
    return fetch_with_offset(batch_query_fn, "league_groups")


def fetch_player_league_history(filters=None):
    filters = filters or {}
    country = filters.get("country")
    conditions = []
    if country:
        conditions.append(f'P.Country="{country}"')
    where_clause = " AND ".join(conditions) if conditions else None

    batch_query_fn = lambda offset, limit: site.cargo_client.query(
        tables="PlayerLeagueHistory=PLH, Players=P",
        join_on="PLH.Player=P.Player",
        fields="PLH.Player=Player, PLH.Teams=Teams, PLH.League=League, PLH.LeagueHistory=LeagueHistory, PLH.TotalGames=TotalGames",
        where=where_clause,
        limit=limit,
        offset=offset
    )
    return fetch_with_offset(batch_query_fn, "player_league_history")


SCOREBOARD_PLAYERS_FIELDS = ",".join([
    "SP.OverviewPage=OverviewPage",
    "SP.Name=Name",
    "SP.Link=Link",
    "SP.Champion=Champion",
    "SP.Kills=Kills",
    "SP.Deaths=Deaths",
    "SP.Assists=Assists",
    "SP.SummonerSpells=SummonerSpells",
    "SP.Gold=Gold",
    "SP.CS=CS",
    "SP.DamageToChampions=DamageToChampions",
    "SP.VisionScore=VisionScore",
    "SP.Items=Items",
    "SP.RoleBoundItem=RoleBoundItem",
    "SP.Trinket=Trinket",
    "SP.Pentakills=Pentakills",
    "SP.KeystoneMastery=KeystoneMastery",
    "SP.KeystoneRune=KeystoneRune",
    "SP.PrimaryTree=PrimaryTree",
    "SP.SecondaryTree=SecondaryTree",
    "SP.Runes=Runes",
    "SP.TeamKills=TeamKills",
    "SP.TeamGold=TeamGold",
    "SP.Team=Team",
    "SP.TeamVs=TeamVs",
    "SP.Time=Time",
    "SP.PlayerWin=PlayerWin",
    "SP.DateTime_UTC=DateTime_UTC",
    "SP.DST=DST",
    "SP.Tournament=Tournament",
    "SP.Role=Role",
    "SP.Role_Number=Role_Number",
    "SP.IngameRole=IngameRole",
    "SP.Side=Side",
    "SP.UniqueLine=UniqueLine",
    "SP.UniqueLineVs=UniqueLineVs",
    "SP.UniqueRole=UniqueRole",
    "SP.UniqueRoleVs=UniqueRoleVs",
    "SP.GameId=GameId",
    "SP.MatchId=MatchId",
    "SP.GameTeamId=GameTeamId",
    "SP.GameRoleId=GameRoleId",
    "SP.GameRoleIdVs=GameRoleIdVs",
    "SP.StatsPage=StatsPage",
])


def fetch_scoreboard_players(filters=None):
    """ScoreboardPlayers: 게임 단위 선수 스탯. 한국 선수만 필터링하더라도 수십만 건 단위.
    DateTime_UTC ASC 정렬로 페이지네이션 안정성 확보, since_date로 증분 fetch 지원."""
    filters = filters or {}
    country = filters.get("country")
    since_date = filters.get("since_date")
    conditions = []
    if country:
        conditions.append(f'P.Country="{country}"')
    if since_date:
        conditions.append(f'SP.DateTime_UTC>="{since_date}"')
    where_clause = " AND ".join(conditions) if conditions else None

    batch_query_fn = lambda offset, limit: site.cargo_client.query(
        tables="ScoreboardPlayers=SP, Players=P",
        join_on="SP.Link=P.Player",
        fields=SCOREBOARD_PLAYERS_FIELDS,
        where=where_clause,
        order_by="SP.DateTime_UTC ASC, SP.GameRoleId ASC",
        limit=limit,
        offset=offset,
    )
    return fetch_with_offset(batch_query_fn, "scoreboard_players")


TOURNAMENTS_FIELDS = ",".join([
    "T.Name=Name",
    "T.OverviewPage=OverviewPage",
    "T.DateStart=DateStart",
    "T.Date=Date",
    "T.DateStartFuzzy=DateStartFuzzy",
    "T.League=League",
    "T.Region=Region",
    "T.Prizepool=Prizepool",
    "T.Currency=Currency",
    "T.Country=Country",
    "T.ClosestTimezone=ClosestTimezone",
    "T.Rulebook=Rulebook",
    "T.EventType=EventType",
    "T.Links=Links",
    "T.Sponsors=Sponsors",
    "T.Organizer=Organizer",
    "T.Organizers=Organizers",
    "T.StandardName=StandardName",
    "T.StandardName_Redirect=StandardName_Redirect",
    "T.BasePage=BasePage",
    "T.Split=Split",
    "T.SplitNumber=SplitNumber",
    "T.SplitMainPage=SplitMainPage",
    "T.TournamentLevel=TournamentLevel",
    "T.IsQualifier=IsQualifier",
    "T.IsPlayoffs=IsPlayoffs",
    "T.IsOfficial=IsOfficial",
    "T.Year=Year",
    "T.LeagueIconKey=LeagueIconKey",
    "T.AlternativeNames=AlternativeNames",
    "T.ScrapeLink=ScrapeLink",
    "T.Tags=Tags",
    "T.SuppressTopSchedule=SuppressTopSchedule",
])


def fetch_tournaments(filters=None):
    """Tournaments: 토너먼트 메타(이름, 일정, 리그, 상금, 공식 여부 등). 별도 player 필터 없이 전역 fetch.
    since_date가 있으면 T.Date(종료일) 이후만 가져와 메타 업데이트 증분."""
    filters = filters or {}
    since_date = filters.get("since_date")
    where_clause = f'T.Date>="{since_date}"' if since_date else None

    batch_query_fn = lambda offset, limit: site.cargo_client.query(
        tables="Tournaments=T",
        fields=TOURNAMENTS_FIELDS,
        where=where_clause,
        order_by="T.DateStart ASC, T.OverviewPage ASC",
        limit=limit,
        offset=offset,
    )
    return fetch_with_offset(batch_query_fn, "tournaments")


def fetch_tournament_players(filters=None):
    """TournamentPlayers: 토너먼트 페이지 단위 선수 로스터 등록. 한국 선수만 필터링하더라도 수만 건.
    PLH가 잡지 못하는 미출전(예정) 등록과 단발성 이벤트(쇼매치/올스타/Cup)까지 포함."""
    filters = filters or {}
    country = filters.get("country")
    where_clause = f'P.Country="{country}"' if country else None
    batch_query_fn = lambda offset, limit: site.cargo_client.query(
        tables="TournamentPlayers=TP, Players=P",
        join_on="TP.Link=P.Player",
        fields="TP.Team=Team, TP.N_PlayerInTeam=N_PlayerInTeam, TP.TeamOrder=TeamOrder, "
               "TP.Link=Link, TP.Player=Player, TP.Role=Role, TP.Flag=Flag, "
               "TP.Footnote=Footnote, TP.OverviewPage=OverviewPage, "
               "TP.PageAndTeam=PageAndTeam, TP.IsDistribution=IsDistribution",
        where=where_clause,
        order_by="TP.OverviewPage ASC, TP.TeamOrder ASC, TP.N_PlayerInTeam ASC",
        limit=limit,
        offset=offset,
    )
    return fetch_with_offset(batch_query_fn, "tournament_players")


def fetch_tournament_groups(filters=None):
    """TournamentGroups: 토너먼트 내 그룹(조) 정보. Team x Tournament(=OverviewPage) 단위."""
    batch_query_fn = lambda offset, limit: site.cargo_client.query(
        tables="TournamentGroups",
        fields="Team,OverviewPage,GroupName,GroupDisplay,GroupN,PageAndTeam",
        order_by="OverviewPage ASC, GroupN ASC, Team ASC",
        limit=limit,
        offset=offset,
    )
    return fetch_with_offset(batch_query_fn, "tournament_groups")


def fetch_team_redirects(filters=None):
    batch_query_fn = lambda offset, limit: site.cargo_client.query(
        tables="TeamRedirects",
        fields="_pageName=PageName,AllName,OtherName",
        limit=limit,
        offset=offset
    )
    return fetch_with_offset(batch_query_fn, "team_redirects")

def read_csv(file_path):
    with open(file_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        return list(reader)

def upsert_csv(new_data, file_path, key_fn):
    if not new_data:
        return
    
    existing = read_csv(file_path) if file_path.exists() else []
    existing_dict = {key_fn(row): row for row in existing}
    for row in new_data:
        existing_dict[key_fn(row)] = row  # 중복 제거 및 업데이트

    with open(file_path, 'w', newline='', encoding='utf-8') as csvfile:
        all_rows = list(existing_dict.values())
        writer = csv.DictWriter(csvfile, fieldnames=all_rows[0].keys())
        writer.writeheader()
        writer.writerows(all_rows)

ALL_TABLES = [
    "players", "tenures", "roster_changes",
    "teams", "team_renames", "team_redirects",
    "player_images",
    "leagues", "current_leagues", "league_groups",
    "player_league_history",
    "scoreboard_players",
    "tournaments",
    "tournament_groups",
    "tournament_players",
]

# 기본 fetch 묶음에서는 제외(수십만~수백만 행 단위라 명시적으로 --only로 호출).
HEAVY_TABLES = {"scoreboard_players", "tournament_players"}


def run_fetch(only=None, update_last_fetched=True, full=False):
    selected = set(only) if only else (set(ALL_TABLES) - HEAVY_TABLES)
    unknown = selected - set(ALL_TABLES)
    if unknown:
        raise SystemExit(f"Unknown tables: {sorted(unknown)}. Valid: {ALL_TABLES}")

    fetched_time = None if full else get_last_fetched()
    print(f"Last fetched time: {fetched_time}{' (full backfill)' if full else ''}")
    country = "South Korea"
    filters = {"country": country, "since_date": fetched_time}
    start_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    if "players" in selected:
        players = fetch_players(filters)
        upsert_csv(players, get_raw_file_path("players"), key_fn=lambda r: r['Player'])

    if "tenures" in selected:
        tenures = fetch_tenures(filters)
        upsert_csv(tenures, get_raw_file_path("tenures"),
                   key_fn=lambda r: f"{r['Player']}_{r['Team']}_{r['DateJoin'] or r['DateLeave']}")

    if "roster_changes" in selected:
        roster_changes = fetch_roster_changes(filters)
        upsert_csv(roster_changes, get_raw_file_path("roster_changes"),
                   key_fn=lambda r: r['RosterChangeId'])

    if "teams" in selected:
        teams = fetch_teams()
        upsert_csv(teams, get_raw_file_path("teams"), key_fn=lambda r: r['OverviewPage'])

    if "team_renames" in selected:
        renames = fetch_team_renames()
        upsert_csv(renames, get_raw_file_path("team_renames"),
                   key_fn=lambda r: f"{r.get('Date','')}_{r.get('OriginalName','')}_{r.get('NewName','')}")

    if "team_redirects" in selected:
        redirects = fetch_team_redirects()
        upsert_csv(redirects, get_raw_file_path("team_redirects"),
                   key_fn=lambda r: f"{r.get('PageName','')}_{r.get('AllName','')}")

    if "player_images" in selected:
        images = fetch_player_images(filters)
        upsert_csv(images, get_raw_file_path("player_images"),
                   key_fn=lambda r: f"{r.get('Link','')}_{r.get('FileName','')}")

    if "leagues" in selected:
        leagues = fetch_leagues()
        upsert_csv(leagues, get_raw_file_path("leagues"), key_fn=lambda r: r['League'])

    if "current_leagues" in selected:
        cur = fetch_current_leagues()
        upsert_csv(cur, get_raw_file_path("current_leagues"),
                   key_fn=lambda r: f"{r.get('Event','')}_{r.get('OverviewPage','')}")

    if "league_groups" in selected:
        groups = fetch_league_groups()
        upsert_csv(groups, get_raw_file_path("league_groups"),
                   key_fn=lambda r: r.get('LongName','') or r.get('ShortName',''))

    if "player_league_history" in selected:
        plh = fetch_player_league_history(filters)
        upsert_csv(plh, get_raw_file_path("player_league_history"),
                   key_fn=lambda r: f"{r.get('Player','')}_{r.get('League','')}")

    if "scoreboard_players" in selected:
        sb = fetch_scoreboard_players(filters)
        upsert_csv(sb, get_raw_file_path("scoreboard_players"),
                   key_fn=lambda r: r.get('GameRoleId','')
                                    or f"{r.get('GameId','')}_{r.get('Link','')}")

    if "tournaments" in selected:
        tours = fetch_tournaments(filters)
        upsert_csv(tours, get_raw_file_path("tournaments"),
                   key_fn=lambda r: r.get('OverviewPage','') or r.get('Name',''))

    if "tournament_groups" in selected:
        groups = fetch_tournament_groups()
        upsert_csv(groups, get_raw_file_path("tournament_groups"),
                   key_fn=lambda r: r.get('PageAndTeam','')
                                    or f"{r.get('OverviewPage','')}_{r.get('GroupN','')}_{r.get('Team','')}")

    if "tournament_players" in selected:
        tps = fetch_tournament_players(filters)
        upsert_csv(tps, get_raw_file_path("tournament_players"),
                   key_fn=lambda r: f"{r.get('PageAndTeam','')}_{r.get('Link','')}_{r.get('Role','')}"
                                    or f"{r.get('OverviewPage','')}_{r.get('Team','')}_{r.get('Link','')}")

    if update_last_fetched and not only:
        set_last_fetched(start_time)
    print(f"Data fetched at: {get_last_fetched()}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Fetch Leaguepedia data")
    parser.add_argument("--only", nargs="+", choices=ALL_TABLES,
                        help="Fetch only specified tables (default: all)")
    parser.add_argument("--full", action="store_true",
                        help="Ignore last_fetched and pull full history (for first-time backfill)")
    args = parser.parse_args()
    run_fetch(only=args.only, full=args.full)
