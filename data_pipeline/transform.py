import json
import csv
import re
from collections import defaultdict
from datetime import datetime
from pathlib import Path
from urllib.parse import quote

from paths import get_raw_file_path, get_processed_file_path


INGAME_ROLES = {"Top", "Jungle", "Mid", "Bot", "Support"}
COACH_KEYWORDS = ("Coach",)
STAFF_KEYWORDS = (
    "Manager", "Owner", "Director", "Advisor", "Supervisor",
    "CEO", "Scout", "Chief", "Board",
)
MEDIA_KEYWORDS = (
    "Streamer", "Caster", "Broadcast", "Journalist",
    "Content Creator", "Translator",
)
ANALYST_KEYWORDS = ("Analyst",)


def normalize_role(raw):
    if not raw:
        return ""
    # "Mid/Part-Owner", "Assistant Coach;Bot" 같이 복합 역할의 첫 토큰 사용
    first = raw.replace(";", "/").split("/")[0].strip()
    return first


def categorize_role(raw):
    if not raw:
        return ""
    tokens = [t.strip() for t in raw.replace(";", "/").split("/") if t.strip()]
    for t in tokens:
        if t in INGAME_ROLES:
            return t
    blob = raw
    if any(k in blob for k in COACH_KEYWORDS):
        return "Coach"
    if any(k in blob for k in ANALYST_KEYWORDS):
        return "Analyst"
    if any(k in blob for k in STAFF_KEYWORDS):
        return "Staff"
    if any(k in blob for k in MEDIA_KEYWORDS):
        return "Media"
    return "Other"


def debut_year(history):
    years = []
    for t in history:
        start = t.get("StartDate") or ""
        if len(start) >= 4 and start[:4].isdigit():
            years.append(int(start[:4]))
    return min(years) if years else ""

def parse_date(s):
    if not s:
        return None
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d"):
        try:
            return datetime.strptime(s, fmt)
        except ValueError:
            continue
    return None


def read_csv(file_path):
    with open(file_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        return list(reader)


_PLH_YEAR_RE = re.compile(r"(\d{4})")
# 카탈로그/페이지 이름에 4자리 연도가 없는 케이스 대응 — Worlds Season 2/3 표기.
_PLH_SEASON_TO_YEAR = {"Season 2": 2012, "Season 3": 2013}
# 추가 수동 매핑은 league_year_overrides.csv 참조 (prefix 매칭, longest-match 우선).
_PLH_OVERRIDES_FILE = Path(__file__).resolve().parent / "league_year_overrides.csv"


def _load_year_overrides():
    if not _PLH_OVERRIDES_FILE.exists():
        return []
    with open(_PLH_OVERRIDES_FILE, "r", encoding="utf-8") as f:
        rows = list(csv.DictReader(f))
    pairs = []
    for r in rows:
        prefix = (r.get("league") or "").strip()
        year_str = (r.get("year") or "").strip()
        if not prefix or not year_str:
            continue
        try:
            pairs.append((prefix, int(year_str)))
        except ValueError:
            continue
    pairs.sort(key=lambda p: -len(p[0]))  # longest-prefix first
    return pairs


_PLH_OVERRIDE_PAIRS = _load_year_overrides()


def _league_history_year(overview_page):
    m = _PLH_YEAR_RE.search(overview_page)
    if m:
        return int(m.group(1))
    for k, y in _PLH_SEASON_TO_YEAR.items():
        if overview_page.startswith(k):
            return y
    for prefix, year in _PLH_OVERRIDE_PAIRS:
        if overview_page.startswith(prefix):
            return year
    return None


def _league_history_split(overview_page):
    """OverviewPage에서 표시용 split 라벨 추출. 마지막 '/' 뒷부분, 없으면 페이지 전체."""
    parts = overview_page.split("/")
    return parts[-1] if len(parts) > 1 else overview_page


# PlayerLeagueHistory에 등장하지만 leagues.csv/LeagueGroups에서 안 잡히는 국제전 보강
_INTERNATIONAL_FALLBACK = {
    "World Championship", "Mid-Season Invitational", "Esports World Cup",
    "Rift Rivals", "All-Star", "First Stand",
}


def build_league_meta_map():
    """PlayerLeagueHistory.League 이름 → {Short, Region, Level, IsOfficial, IsInternational}.
    PLH의 League는 LeagueGroups.LongName과 매칭되므로 그쪽을 우선 조회하고,
    멤버 League 중 하나라도 Region=International이면 그룹을 International로 표기."""
    try:
        leagues_rows = read_csv(get_raw_file_path("leagues"))
    except FileNotFoundError:
        leagues_rows = []
    leagues_by_name = {}
    for r in leagues_rows:
        name = (r.get("League") or "").strip()
        if name:
            leagues_by_name[name] = {
                "Short": (r.get("League Short") or "").strip(),
                "Region": (r.get("Region") or "").strip(),
                "Level": (r.get("Level") or "").strip(),
                "IsOfficial": (r.get("IsOfficial") or "").strip() == "Yes",
            }

    try:
        group_rows = read_csv(get_raw_file_path("league_groups"))
    except FileNotFoundError:
        group_rows = []

    out = {}
    for r in group_rows:
        long_name = (r.get("LongName") or "").strip()
        if not long_name:
            continue
        members = [m.strip() for m in (r.get("Leagues") or "").split(",") if m.strip()]
        member_metas = [leagues_by_name[m] for m in members if m in leagues_by_name]
        regions = {m["Region"] for m in member_metas if m["Region"]}
        levels = {m["Level"] for m in member_metas if m["Level"]}
        primary_member = next((m for m in member_metas if m["Level"] == "Primary"),
                              member_metas[0] if member_metas else None)
        out[long_name] = {
            "Short": (r.get("ShortName") or "").strip()
                     or (primary_member["Short"] if primary_member else ""),
            "Region": (primary_member["Region"] if primary_member else ""),
            "Level": (primary_member["Level"] if primary_member else ""),
            "IsOfficial": primary_member["IsOfficial"] if primary_member else False,
            "IsInternational": ("International" in regions)
                               or long_name in _INTERNATIONAL_FALLBACK,
        }

    # leagues.csv에는 있고 group에는 없는 리그도 같은 이름으로 노출
    for name, meta in leagues_by_name.items():
        if name in out:
            continue
        out[name] = {**meta, "IsInternational": meta["Region"] == "International"
                                                 or name in _INTERNATIONAL_FALLBACK}

    # 그래도 못 잡힌 PLH 전용 이름은 fallback set으로만 international 여부 결정
    return out


def build_league_timeline_map():
    """player_id -> {timeline: [...cells...], totals: {league: TotalGames}}.
    국제 대회는 split을 분리하지 않음 (단기적 이벤트라 의미 없음)."""
    try:
        rows = read_csv(get_raw_file_path("player_league_history"))
    except FileNotFoundError:
        return {}

    league_meta = build_league_meta_map()
    by_player_cells = defaultdict(lambda: defaultdict(lambda: {"Splits": []}))
    by_player_totals = defaultdict(dict)
    skipped_no_year = 0

    def _is_international(league):
        meta = league_meta.get(league)
        if meta is None:
            return league in _INTERNATIONAL_FALLBACK
        return meta["IsInternational"]

    for r in rows:
        player = r.get("Player") or ""
        league = r.get("League") or ""
        history = r.get("LeagueHistory") or ""
        if not player or not league or not history:
            continue
        try:
            total_games = int(r.get("TotalGames") or 0)
        except ValueError:
            total_games = 0
        if total_games > 0:
            by_player_totals[player][league] = total_games

        intl = _is_international(league)
        for chunk in history.split(";;;"):
            if "::" not in chunk:
                continue
            page, team = chunk.split("::", 1)
            page = page.strip()
            team = team.strip()
            year = _league_history_year(page)
            if year is None:
                skipped_no_year += 1
                continue
            cell_key = (year, league, team)
            cell = by_player_cells[player][cell_key]
            cell["Year"] = year
            cell["League"] = league
            cell["Team"] = team
            if not intl:
                cell["Splits"].append(_league_history_split(page))

    if skipped_no_year:
        print(f"PlayerLeagueHistory: skipped {skipped_no_year} entries without parseable year.")

    result = {}
    for player, cells in by_player_cells.items():
        emitted = []
        for (_, league, _), cell in cells.items():
            meta = league_meta.get(league)
            if meta is None:
                meta = {
                    "Short": "",
                    "Region": "",
                    "Level": "",
                    "IsOfficial": False,
                    "IsInternational": league in _INTERNATIONAL_FALLBACK,
                }
            emitted.append({
                "Year": cell["Year"],
                "League": league,
                "LeagueShort": meta["Short"],
                "Region": meta["Region"],
                "Level": meta["Level"],
                "IsInternational": meta["IsInternational"],
                "Team": cell["Team"],
                "Splits": cell["Splits"],
            })
        emitted.sort(key=lambda c: (
            0 if c["IsInternational"] else 1,
            c["League"],
            c["Year"],
        ))
        result[player] = {
            "timeline": emitted,
            "totals": by_player_totals.get(player, {}),
        }
    return result


def build_player_histories():
    players = read_csv(get_raw_file_path("players"))
    tenures = read_csv(get_raw_file_path("tenures"))
    roster_changes = read_csv(get_raw_file_path("roster_changes"))
    photo_by_player = build_latest_photo_map()
    league_timeline_by_player = build_league_timeline_map()

    # player_id를 키로 하는 딕셔너리로 tenures와 roster_changes를 그룹화
    print("Grouping tenures and roster changes by player...")
    tenures_by_player = defaultdict(list)
    for tenure in tenures:
        tenures_by_player[tenure['Player']].append(tenure)
    print("Grouping completed.")
    
    # DateJoin의 오름차순으로 정렬
    print("Sorting tenures by DateJoin...")
    for player_id in tenures_by_player:
        tenures_by_player[player_id].sort(key=lambda x: x['DateJoin'] or x['DateLeave'] or "")
    print("Sorting completed.")

    print("Grouping roster changes by player...")
    roster_changes_by_player = defaultdict(list)
    for change in roster_changes:
        roster_changes_by_player[change['Player']].append(change)
    print("Grouping completed.")

    # Date Sort의 오름차순으로 정렬
    print("Sorting roster changes by Date Sort...")
    for player_id in roster_changes_by_player:
        roster_changes_by_player[player_id].sort(key=lambda x: x['Date Sort'] or "")
    print("Sorting completed.")

    player_infos = []
    for player in players:
        player_id = player['Player']
        print(f"Building history for player: {player_id}")
        
        tenures_for_player = tenures_by_player.get(player_id, [])
        roster_changes_for_player = roster_changes_by_player.get(player_id, [])
        player_history = build_player_history(tenures_for_player, roster_changes_for_player)
        player['LatestPhotoUrl'] = photo_by_player.get(player_id, '')
        league_data = league_timeline_by_player.get(player_id) or {}
        player_info = {
            'Player': player,
            'History': player_history,
            'LeagueTimeline': league_data.get('timeline', []),
            'LeagueTotals': league_data.get('totals', {}),
        }
        player_infos.append(player_info)
        print(f"History built for player: {player_id}")

    return player_infos


def build_player_history(tenures, roster_changes):
    player_history = []

    previous_position = None

    for tenure in tenures:
        tenure_start = tenure['DateJoin']
        tenure_start_id = tenure['RosterChangeIdJoin']
        tenure_end = tenure['DateLeave']
        tenure_end_id = tenure['RosterChangeIdLeave']
        team = tenure['Team']
        is_current = tenure['IsCurrent']
        duration = tenure['Duration']
        tenure_start_time = parse_date(tenure_start)
        tenure_end_time = parse_date(tenure_end) if tenure_end else datetime.now()
        approximate_duration = (tenure_end_time - tenure_start_time).days if tenure_end_time and tenure_start_time else None
        position = None
        
        if tenure_start_id:
            for change in roster_changes:
                if change['RosterChangeId'] == tenure_start_id:
                    position = change['Role']
                    break
        
        if not position and tenure_end_id:
            for change in roster_changes:
                if change['RosterChangeId'] == tenure_end_id:
                    position = change['Role']
                    break

        if not position:
            print(f"Warning: Roster change not found for tenure starting at {tenure_start} and ending at {tenure_end}.")
            # 해당 기간에 roster change가 있는지 확인
            if tenure_start_time is None:
                print(f"Warning: Invalid DateJoin '{tenure_start}' for tenure with team {team}. Skipping this tenure.")
                continue
            for change in roster_changes:
                change_date = change['Date Sort']
                change_time = parse_date(change_date)
                if change_time is None:
                    print(f"Warning: Invalid Date Sort '{change_date}' in roster change for player. Skipping this change.")
                    continue
                if tenure_start_time <= change_time <= tenure_end_time:
                    position = change['Role']  # 예시로 Role을 position으로 사용
                    break
        
        if not position:
            print(f"Warning: Position not found for tenure starting at {tenure_start} and ending at {tenure_end}. Using previous position {previous_position}.")
            position = previous_position  # 이전 포지션 유지

        previous_position = position  # 다음 반복을 위해 현재 포지션 저장
        
        player_history.append({
            'StartDate': tenure_start,
            'EndDate': tenure_end,
            'Team': team,
            'Position': position,
            'Duration': duration,
            'ApproximateDuration': approximate_duration,
            'IsCurrent': is_current
        })

    return merge_contiguous_tenures(player_history)


def _days_to_duration(days):
    if days is None:
        return ""
    years, rem = divmod(days, 365)
    months = rem // 30
    parts = []
    if years:
        parts.append(f"{years} Year{'s' if years != 1 else ''}")
    if months:
        parts.append(f"{months} Month{'s' if months != 1 else ''}")
    return ", ".join(parts) if parts else f"{days} Day{'s' if days != 1 else ''}"


def merge_contiguous_tenures(history):
    """같은 팀/포지션이고 기간이 정확히 맞닿는(앞 EndDate == 뒤 StartDate) tenure들을 하나로 합침."""
    if not history:
        return history
    merged = [dict(history[0])]
    for cur in history[1:]:
        prev = merged[-1]
        if (
            cur.get('Team') == prev.get('Team')
            and cur.get('Position') == prev.get('Position')
            and prev.get('EndDate')
            and cur.get('StartDate')
            and prev['EndDate'] == cur['StartDate']
        ):
            prev['EndDate'] = cur.get('EndDate', '')
            prev['IsCurrent'] = cur.get('IsCurrent', prev.get('IsCurrent'))
            start_t = parse_date(prev.get('StartDate'))
            end_t = parse_date(prev['EndDate']) if prev['EndDate'] else datetime.now()
            if start_t and end_t:
                approx = (end_t - start_t).days
                prev['ApproximateDuration'] = approx
                prev['Duration'] = _days_to_duration(approx)
            continue
        merged.append(dict(cur))
    return merged

POSITION_SORT_ORDER = ["Top", "Jungle", "Mid", "Bot", "Support"]


def _roster_sort_key(entry):
    cat = entry.get("PositionCategory", "")
    if cat in POSITION_SORT_ORDER:
        return (0, POSITION_SORT_ORDER.index(cat))
    if cat == "Coach":
        return (1, 0)
    return (2, 0)


def _logo_url(image):
    if not image:
        return ""
    return f"https://lol.fandom.com/wiki/Special:FilePath/{image.replace(' ', '_')}"


def _file_url(filename):
    if not filename:
        return ""
    return f"https://lol.fandom.com/wiki/Special:FilePath/{quote(filename.replace(' ', '_'))}"


_YEAR_RE = re.compile(r"(\d{4})")


def _image_recency_key(row):
    """Largest = most recent. (year, FileName) — FileName 'Split 2' > 'Split 1' lex order.
    Year extracted from Tournament path (e.g. 'LCK/2026 Season/Cup' -> 2026)."""
    tournament = row.get("Tournament") or ""
    m = _YEAR_RE.search(tournament)
    year = int(m.group(1)) if m else 0
    return (year, row.get("FileName") or "")


def build_latest_photo_map():
    """Player -> latest profile image URL. Returns {} if file missing."""
    try:
        rows = read_csv(get_raw_file_path("player_images"))
    except FileNotFoundError:
        return {}
    by_player = defaultdict(list)
    for r in rows:
        link = (r.get("Link") or "").strip()
        if not link:
            continue
        by_player[link].append(r)
    latest = {}
    for player, imgs in by_player.items():
        best = max(imgs, key=_image_recency_key)
        filename = best.get("FileName") or ""
        if filename:
            latest[player] = _file_url(filename)
    return latest


def build_name_resolution(teams_by_op, teams_raw, extra_names=()):
    """name -> OverviewPage 맵.
    해석 순서:
      1) OverviewPage 정확 일치
      2) TeamRenames + teams.csv RenamedTo 체인 따라가기
      3) Name 필드 정확 일치
      4) 대소문자 무시 일치 (OverviewPage/Name)
    """
    rename_rows = read_csv(get_raw_file_path("team_renames"))
    rename_rows.sort(key=lambda r: r.get("Date", ""))
    next_name = {}  # lowercase key -> next name
    for r in rename_rows:
        orig = (r.get("OriginalName") or "").strip()
        new = (r.get("NewName") or "").strip()
        if orig and new and orig.lower() != new.lower():
            next_name[orig.lower()] = new
    for op, team in teams_by_op.items():
        rt = team.get("RenamedTo")
        if rt and op.lower() not in next_name:
            next_name[op.lower()] = rt

    # 보조 lookup
    by_name = {}
    by_op_lower = {op.lower(): op for op in teams_by_op}
    by_name_lower = {}
    for t in teams_raw:
        op = t.get("OverviewPage", "")
        name = (t.get("Name") or "").strip()
        if op and name:
            by_name.setdefault(name, op)
            by_name_lower.setdefault(name.lower(), op)

    def canonicalize(name):
        if name in teams_by_op:
            return name
        if name in by_name:
            return by_name[name]
        low = name.lower()
        if low in by_op_lower:
            return by_op_lower[low]
        if low in by_name_lower:
            return by_name_lower[low]
        return None

    resolution = {}
    def resolve(name):
        if name in resolution:
            return resolution[name]
        visited = [name]
        cur = name
        seen = {name.lower()}
        final = canonicalize(cur)
        while final is None:
            nxt = next_name.get(cur.lower())
            if not nxt or nxt.lower() in seen:
                break
            cur = nxt
            seen.add(cur.lower())
            visited.append(cur)
            final = canonicalize(cur)
        for v in visited:
            resolution[v] = final
        return final

    for name in list(teams_by_op.keys()):
        resolve(name)
    for name in extra_names:
        if name and name not in resolution:
            resolve(name)
    return resolution


def _duration_days(start, end):
    if not start:
        return 0
    st = parse_date(start)
    if st is None:
        return 0
    et = parse_date(end) if end else datetime.now()
    if et is None:
        return 0
    return max((et - st).days, 0)


def category_group(cat):
    """병합 판단용 상위 계열. InGame(Top/Jungle/Mid/Bot/Support) / Coach / Other."""
    if cat in INGAME_ROLES:
        return "InGame"
    if cat == "Coach":
        return "Coach"
    return "Other"


def _merge_team_history_entries(entries):
    """같은 선수/팀 이력을 상위 계열 + 연속 구간 기준으로 병합."""
    if not entries:
        return []
    entries = sorted(entries, key=lambda e: (e["StartDate"] or "", e["EndDate"] or ""))
    merged = []
    current = None
    for e in entries:
        if current is None:
            current = _start_group(e)
            continue
        same_group = category_group(e["PositionCategory"]) == category_group(current["PositionCategory"])
        contiguous = (
            current["EndDate"]
            and e["StartDate"]
            and current["EndDate"] == e["StartDate"]
        )
        if same_group and contiguous:
            _extend_group(current, e)
        else:
            merged.append(_finalize_group(current))
            current = _start_group(e)
    if current:
        merged.append(_finalize_group(current))
    return merged


def _start_group(e):
    days = _duration_days(e["StartDate"], e["EndDate"])
    return {
        "Player": e["Player"],
        "ID": e["ID"],
        "PositionCategory": e["PositionCategory"],
        "TeamAtTime": e.get("TeamAtTime", ""),
        "StartDate": e["StartDate"],
        "EndDate": e["EndDate"],
        "IsCurrent": bool(e.get("IsCurrent")),
        "_positions": [(e["Position"], e["PositionCategory"], days)],
    }


def _extend_group(g, e):
    g["EndDate"] = e["EndDate"]
    g["IsCurrent"] = bool(e.get("IsCurrent"))
    days = _duration_days(e["StartDate"], e["EndDate"])
    g["_positions"].append((e["Position"], e["PositionCategory"], days))


def _finalize_group(g):
    # Position: 기간 내림차순으로 slash 병기. 등장 순서를 안정적 tiebreak로 사용.
    pos_agg = defaultdict(int)
    pos_order = []
    for pos, _cat, days in g["_positions"]:
        if not pos:
            continue
        if pos not in pos_agg:
            pos_order.append(pos)
        pos_agg[pos] += days
    ordered = sorted(pos_agg.items(), key=lambda kv: (-kv[1], pos_order.index(kv[0])))
    g["Position"] = " / ".join(p for p, _ in ordered)
    # 대표 PositionCategory: 가장 오래 머문 세부 카테고리 (같은 그룹 내 비교용)
    cat_agg = defaultdict(int)
    for _pos, cat, days in g["_positions"]:
        if cat:
            cat_agg[cat] += days
    if cat_agg:
        g["PositionCategory"] = max(cat_agg.items(), key=lambda kv: kv[1])[0]
    approx = _duration_days(g["StartDate"], g["EndDate"])
    g["ApproximateDuration"] = approx
    g["Duration"] = _days_to_duration(approx)
    del g["_positions"]
    return g


def build_teams(player_infos):
    teams_raw = read_csv(get_raw_file_path("teams"))
    teams_by_op = {}
    for t in teams_raw:
        op = t.get("OverviewPage", "")
        if not op:
            continue
        teams_by_op[op] = {
            "OverviewPage": op,
            "Name": t.get("Name", ""),
            "Short": t.get("Short", ""),
            "Region": t.get("Region", ""),
            "Image": t.get("Image", ""),
            "LogoUrl": _logo_url(t.get("Image", "")),
            "IsDisbanded": t.get("IsDisbanded", "") == "1",
            "RenamedTo": t.get("RenamedTo", "") or None,
            "Predecessors": [],
            "FormerNames": [],
            "CurrentRoster": [],
            "PlayerHistory": [],
        }

    # Collect all team names referenced by player histories so they can be resolved.
    history_names = set()
    for p in player_infos:
        for tenure in p["History"]:
            name = tenure.get("Team")
            if name:
                history_names.add(name)
        meta_team = p["Player"].get("Team")
        if meta_team:
            history_names.add(meta_team)

    resolution = build_name_resolution(teams_by_op, teams_raw, extra_names=history_names)

    # Predecessors: reverse-map RenamedTo (teams.csv 내부 관계만)
    for op, team in teams_by_op.items():
        rt = team["RenamedTo"]
        if rt and rt in teams_by_op:
            teams_by_op[rt]["Predecessors"].append(op)

    # FormerNames: teams.csv에 엔트리가 없지만 이 팀으로 귀결되는 구 이름들
    for name, final in resolution.items():
        if final and name != final and name not in teams_by_op:
            teams_by_op[final]["FormerNames"].append(name)

    # Collect per-team per-player tenure entries; detect orphans.
    tenures_per_team_player = defaultdict(lambda: defaultdict(list))
    orphan_counts = defaultdict(lambda: {"TenureCount": 0, "SamplePlayers": []})
    for p in player_infos:
        meta = p["Player"]
        player_key = meta.get("Player", "")
        player_id = meta.get("ID", "")
        for tenure in p["History"]:
            team_name = tenure.get("Team", "")
            if not team_name:
                continue
            position_raw = tenure.get("Position") or ""
            resolved = resolution.get(team_name) or (team_name if team_name in teams_by_op else None)
            entry = {
                "Player": player_key,
                "ID": player_id,
                "Position": normalize_role(position_raw),
                "PositionCategory": categorize_role(position_raw),
                "TeamAtTime": team_name,
                "StartDate": tenure.get("StartDate", ""),
                "EndDate": tenure.get("EndDate", ""),
                "IsCurrent": tenure.get("IsCurrent") == "1",
            }
            if resolved:
                tenures_per_team_player[resolved][player_key].append(entry)
            else:
                o = orphan_counts[team_name]
                o["TenureCount"] += 1
                if player_id and player_id not in o["SamplePlayers"] and len(o["SamplePlayers"]) < 5:
                    o["SamplePlayers"].append(player_id)

    meta_by_player = {p["Player"].get("Player", ""): p["Player"] for p in player_infos}
    for resolved, by_player in tenures_per_team_player.items():
        for player_key, entries in by_player.items():
            merged = _merge_team_history_entries(entries)
            is_retired = meta_by_player.get(player_key, {}).get("IsRetired") == "1"
            for g in merged:
                if g["IsCurrent"]:
                    if is_retired:
                        continue
                    teams_by_op[resolved]["CurrentRoster"].append({
                        "Player": g["Player"],
                        "ID": g["ID"],
                        "Position": g["Position"],
                        "PositionCategory": g["PositionCategory"],
                        "JoinDate": g["StartDate"],
                    })
                elif g["EndDate"]:
                    teams_by_op[resolved]["PlayerHistory"].append(g)

    # Sort
    for team in teams_by_op.values():
        team["CurrentRoster"].sort(key=lambda r: (_roster_sort_key(r), r["JoinDate"] or "", r["ID"].lower()))
        team["PlayerHistory"].sort(key=lambda e: (e["StartDate"] or "", e["ID"].lower()))
        team["Predecessors"].sort()
        team["FormerNames"].sort()

    teams_list = sorted(teams_by_op.values(), key=lambda t: t["OverviewPage"].lower())

    orphan_list = sorted(
        (
            {"TeamName": name, "TenureCount": v["TenureCount"], "SamplePlayers": v["SamplePlayers"]}
            for name, v in orphan_counts.items()
        ),
        key=lambda o: (-o["TenureCount"], o["TeamName"].lower()),
    )
    return teams_list, orphan_list


def build_player_list(player_infos):
    rows = []
    for p in player_infos:
        meta = p["Player"]
        history = p["History"]
        team = meta.get("Team") or meta.get("TeamLast") or ""
        role_raw = meta.get("Role") or meta.get("RoleLast") or ""
        position = normalize_role(role_raw)
        category = categorize_role(role_raw)
        is_active = 1 if (meta.get("Team") and meta.get("IsRetired") != "1") else 0
        rows.append({
            "Player": meta.get("Player", ""),
            "ID": meta.get("ID", ""),
            "Name": meta.get("Name", ""),
            "NativeName": meta.get("NativeName", ""),
            "Country": meta.get("Country", ""),
            "DebutYear": debut_year(history),
            "Team": team,
            "Role": role_raw,
            "Position": position,
            "PositionCategory": category,
            "IsActive": is_active,
            "Age": meta.get("Age", ""),
        })
    rows.sort(key=lambda r: r["Player"].lower())
    return rows


def write_player_list_csv(rows, output_path):
    fieldnames = [
        "Player", "ID", "Name", "NativeName", "Country", "DebutYear",
        "Team", "Role", "Position", "PositionCategory", "IsActive", "Age",
    ]
    with open(output_path, "w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)


if __name__ == "__main__":
    player_infos = build_player_histories()
    # 결과를 processed_data 디렉토리에 JSON 파일로 저장
    output_path = get_processed_file_path("players_info")
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(player_infos, f, ensure_ascii=False, indent=4)
    list_rows = build_player_list(player_infos)
    list_path = get_processed_file_path("players_list")
    write_player_list_csv(list_rows, list_path)
    print(f"Wrote {len(list_rows)} rows to {list_path}")

    teams_list, orphan_list = build_teams(player_infos)
    teams_path = get_processed_file_path("teams_info")
    with open(teams_path, "w", encoding="utf-8") as f:
        json.dump(teams_list, f, ensure_ascii=False, indent=2)
    print(f"Wrote {len(teams_list)} teams to {teams_path}")
    orphan_path = get_processed_file_path("teams_orphan")
    with open(orphan_path, "w", encoding="utf-8") as f:
        json.dump(orphan_list, f, ensure_ascii=False, indent=2)
    print(f"Wrote {len(orphan_list)} orphan teams to {orphan_path}")
