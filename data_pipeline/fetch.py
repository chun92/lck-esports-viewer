from mwrogue.esports_client import EsportsClient # type: ignore
from mwrogue.auth_credentials import AuthCredentials # type: ignore
import csv
import time
from paths import get_raw_file_path

credentials = AuthCredentials(user_file="me")
site = EsportsClient('lol', credentials=credentials)


def fetch_with_retry(query_fn, retries=5, backoff=60):
    for attempt in range(retries):
        try:
            return query_fn()
        except Exception as e:
            error_str = str(e)
            if "ratelimited" in error_str:
                wait = backoff * (attempt + 1)  # 60, 120, 180, 240, 300초
                print(f"Rate limited. {wait}초 대기 후 재시도...")
                time.sleep(wait)
            else:
                raise

    raise Exception("All attempts failed")


def fetch_with_offset(query_fn, table_name, country=None):
    all_results = []
    offset = 0
    limit = 500  # 한 번에 가져올 레코드 수
    
    print(f"Fetching {table_name} for country: {country if country else 'All'}...")
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


def fetch_players(country=None):
    where_clause = f'Country="{country}"' if country else None
    batch_query_fn = lambda offset, limit: site.cargo_client.query(
        tables="Players",
        fields="ID,Player,Name,NativeName,Country,Age,Birthdate,Team,Team2,CurrentTeams,Role,TeamLast,RoleLast,IsRetired",
        where=where_clause,
        limit=limit,
        offset=offset
    )
    return fetch_with_offset(batch_query_fn, "players", country)


def fetch_tenures(country=None):
    where_clause = f'P.Country="{country}"' if country else None
    batch_query_fn = lambda offset, limit: site.cargo_client.query(
        tables="Tenures=T, Players=P",
        join_on="T.Player=P.Player",
        fields="T.Player,T.Team,T.DateJoin,T.DateLeave,T.Duration,T.ContractEnd,T.RosterChangeIdJoin,T.RosterChangeIdLeave,T.NameLeave,T.NextTeam,T.NextIsRetired,T.IsCurrent",
        where=where_clause,
        limit=limit,
        offset=offset
    )
    return fetch_with_offset(batch_query_fn, "tenures", country)


def fetch_roster_changes(country=None):
    where_clause = f'P.Country="{country}"' if country else None
    batch_query_fn = lambda offset, limit: site.cargo_client.query(
        tables="RosterChanges=R, Players=P",
        join_on="R.Player=P.Player",
        fields="R.Player,R.Date_Sort,R.Direction,R.Team,R.Role,R.Status,R.RosterChangeId",
        where=where_clause,
        limit=limit,
        offset=offset
    )
    return fetch_with_offset(batch_query_fn, "roster changes", country)


def fetch_player_redirects(country=None):
    where_clause = f'P.Country="{country}"' if country else None
    batch_query_fn = lambda offset, limit: site.cargo_client.query(
        tables="PlayerRedirects=PR, Players=P",
        join_on="PR.ID=P.ID",
        fields="PR.AllName,PR.ID",
        where=where_clause,
        limit=limit,
        offset=offset
    )
    return fetch_with_offset(batch_query_fn, "player redirects", country)


def fetch_teams():
    batch_query_fn = lambda offset, limit: site.cargo_client.query(
        tables="Teams",
        fields="Name,Short,Region,Image,IsDisbanded,RenamedTo",
        limit=limit,
        offset=offset
    )
    return fetch_with_offset(batch_query_fn, "teams")

def save_csv(data, file_path):
    if not data:
        print(f"Warning: No data to save for {file_path}")
        return
    with open(file_path, 'w', newline='', encoding='utf-8') as csvfile:
        writer = csv.DictWriter(csvfile, fieldnames=data[0].keys())
        writer.writeheader()
        writer.writerows(data)


if __name__ == "__main__":
    raw_players_file_path = get_raw_file_path("players")
    raw_tenures_file_path = get_raw_file_path("tenures")
    raw_roster_changes_file_path = get_raw_file_path("roster_changes")
    raw_player_redirects_file_path = get_raw_file_path("player_redirects")
    raw_teams_file_path = get_raw_file_path("teams")

    country = "South Korea"
    players = fetch_players(country)
    save_csv(players, raw_players_file_path)

    tenures = fetch_tenures(country)
    save_csv(tenures, raw_tenures_file_path)

    roster_changes = fetch_roster_changes(country)
    save_csv(roster_changes, raw_roster_changes_file_path)

    player_redirects = fetch_player_redirects()
    save_csv(player_redirects, raw_player_redirects_file_path)

    teams = fetch_teams()
    save_csv(teams, raw_teams_file_path)
