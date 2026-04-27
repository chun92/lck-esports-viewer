import json
import csv
import re
from collections import Counter, defaultdict
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


def _load_tournaments_meta():
    """OverviewPage -> {Year, Split, IsPlayoffs, IsOfficial, TournamentLevel, Region, League}.
    페이지 단위 메타. 빈 필드는 빈 문자열/False."""
    try:
        rows = read_csv(get_raw_file_path("tournaments"))
    except FileNotFoundError:
        return {}
    out = {}
    for r in rows:
        op = (r.get("OverviewPage") or "").strip()
        if not op:
            continue
        out[op] = {
            "Year": (r.get("Year") or "").strip(),
            "Split": (r.get("Split") or "").strip(),
            # IsPlayoffs/IsOfficial: "1"=true, "0"=false. IsOfficial 빈값은 official로 간주.
            "IsPlayoffs": (r.get("IsPlayoffs") or "").strip() == "1",
            "IsOfficial": (r.get("IsOfficial") or "").strip() != "0",
            "TournamentLevel": (r.get("TournamentLevel") or "").strip(),
            "Region": (r.get("Region") or "").strip(),
            "League": (r.get("League") or "").strip(),
        }
    return out


def _league_history_year_heuristic(overview_page):
    """레거시 fallback: page 문자열에서 연도 추출 (Tournaments.Year가 비었을 때만 사용)."""
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


def _resolve_year(page, tour_meta):
    """Tournaments.Year 우선, 빈값일 때만 휴리스틱+manual override fallback."""
    t = tour_meta.get(page)
    if t and t["Year"].isdigit():
        return int(t["Year"])
    return _league_history_year_heuristic(page)


def _build_intl_leagues_from_tour(plh_rows, tour_meta):
    """PLH.League별로 매칭되는 Tournaments.Region에 'International'이 하나라도 있으면 international 리그로 간주.
    World Championship/MSI/Rift Rivals/EWC/First Stand 등 자동 감지."""
    intl = set()
    for r in plh_rows:
        league = (r.get("League") or "").strip()
        if not league or league in intl:
            continue
        history = r.get("LeagueHistory") or ""
        for chunk in history.split(";;;"):
            if "::" not in chunk:
                continue
            page = chunk.split("::", 1)[0].strip()
            t = tour_meta.get(page)
            if t and t["Region"] == "International":
                intl.add(league)
                break
    return intl


def build_league_meta_map(extra_intl_leagues=None):
    """PlayerLeagueHistory.League 이름 → {Short, Region, Level, IsOfficial, IsInternational}.
    PLH의 League는 LeagueGroups.LongName과 매칭되므로 그쪽을 우선 조회하고,
    멤버 League 중 하나라도 Region=International이거나 extra_intl_leagues에 포함되면 international 표기."""
    extra_intl = set(extra_intl_leagues or ())
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
        primary_member = next((m for m in member_metas if m["Level"] == "Primary"),
                              member_metas[0] if member_metas else None)
        out[long_name] = {
            "Short": (r.get("ShortName") or "").strip()
                     or (primary_member["Short"] if primary_member else ""),
            "Region": (primary_member["Region"] if primary_member else ""),
            "Level": (primary_member["Level"] if primary_member else ""),
            "IsOfficial": primary_member["IsOfficial"] if primary_member else False,
            "IsInternational": ("International" in regions) or long_name in extra_intl,
        }

    # leagues.csv에는 있고 group에는 없는 리그도 같은 이름으로 노출
    for name, meta in leagues_by_name.items():
        if name in out:
            continue
        out[name] = {
            **meta,
            "IsInternational": meta["Region"] == "International" or name in extra_intl,
        }

    return out


_SHOWMATCH_TEAM_RE = re.compile(
    r"\(.*(?:All-?Star|All Star|Season Opening|Showmatch|AS\s|Exhibit|Charity).*\)",
    re.IGNORECASE,
)
_PSEUDO_LEAGUE_YEAR_RE = re.compile(r"\b(?:20\d{2}|Season \d+)\b")


def _classify_tournament(meta, team_name):
    """Tournaments meta + team 이름으로 International/Domestic/Events 분류.
    - Region=International → International
    - IsOfficial=False(=='0') → Events
    - TournamentLevel in {Showmatch, Minor, Major, Qualifier, Premier} → Events
    - TournamentLevel 빈값 → Events (구버전 exhibition류)
    - 합성 쇼매치 팀명(괄호 + All-Star/Season Opening 등) → Events
    - else → Domestic"""
    if not meta:
        return "Events"
    if meta.get("Region") == "International":
        return "International"
    if not meta.get("IsOfficial", True):
        return "Events"
    level = meta.get("TournamentLevel", "")
    if level in {"Showmatch", "Minor", "Major", "Qualifier", "Premier"}:
        return "Events"
    if level == "":
        return "Events"
    if team_name and _SHOWMATCH_TEAM_RE.search(team_name):
        return "Events"
    return "Domestic"


def _build_tour_to_canonical_league():
    """Tournaments.League raw 값 → LeagueGroups.LongName 캐노니컬 이름.
    OGN/LoL The Champions/LoL Champions Korea → 'LoL Champions Korea'로 통합."""
    try:
        groups = read_csv(get_raw_file_path("league_groups"))
    except FileNotFoundError:
        return {}
    out = {}
    for g in groups:
        long_name = (g.get("LongName") or "").strip()
        if not long_name:
            continue
        for member in (g.get("Leagues") or "").split(","):
            m = member.strip()
            if m:
                out[m] = long_name
    return out


def _league_from_page(page):
    """tour.League가 빈 경우 OverviewPage에서 연도 토큰 제거하여 pseudo-league 명 추출.
    'LCK 2024 Season Opening' → 'LCK Season Opening'."""
    p = _PSEUDO_LEAGUE_YEAR_RE.sub("", page).strip()
    # 연도 제거 후 남는 ' /', '/ ', 다중 공백 정리
    p = re.sub(r"\s*/\s*", "/", p)
    p = re.sub(r"\s+", " ", p)
    p = p.strip(" /")
    return p or page


def _resolve_league_name(page, meta, raw_to_canonical):
    """대회 페이지로부터 표시할 league 이름 결정. tour.League가 비면 page에서 합성."""
    raw_league = (meta or {}).get("League", "") if meta else ""
    if not raw_league and meta is None:
        # Tournaments에 행이 없는 페이지 — page-derived
        return _league_from_page(page)
    if raw_league:
        return raw_to_canonical.get(raw_league, raw_league)
    return _league_from_page(page)


# Worlds/MSI 본선 vs 지역 진출전 구분용. League는 'World Championship'/'MSI'이지만
# Region이 host country라면 진출전(qualifier) — 본선 라인이 아니라 출신 리그 stage로 재배치.
_INTL_QUALIFIER_LEAGUES = {
    "World Championship",
    "Mid-Season Invitational",
    "First Stand",
}


def _is_intl_qualifier(meta):
    if not meta:
        return False
    league = meta.get("League", "")
    region = meta.get("Region", "")
    return league in _INTL_QUALIFIER_LEAGUES and region not in ("", "International")


def _redirect_qualifier_league(page, year, tour_meta, raw_to_canonical):
    """진출전 페이지를 같은 시즌의 출신 리그명으로 재매핑.
    예: 'LCK/2018 Season/Regional Finals' → 'LCK/2018 Season/' 형제 페이지의 League → 'LoL Champions Korea'.
    슬래시 없는 옛 형식('2014 Season Korea Regional Finals')은 year+region 매칭으로 fallback.
    출신 리그를 못 찾으면 None 반환 (이 경우 호출측에서 원래 매핑 유지)."""
    raw_candidates = []
    if "/" in page:
        prefix = page.rsplit("/", 1)[0] + "/"
        for op, m in tour_meta.items():
            if op == page or not op.startswith(prefix):
                continue
            lg = (m.get("League") or "").strip()
            if lg and m.get("Region") != "International" and lg not in _INTL_QUALIFIER_LEAGUES:
                raw_candidates.append(lg)
    if not raw_candidates:
        target = tour_meta.get(page, {})
        region = target.get("Region", "")
        if region:
            for op, m in tour_meta.items():
                if op == page:
                    continue
                if str(m.get("Year", "")) != str(year):
                    continue
                if m.get("Region") != region:
                    continue
                lg = (m.get("League") or "").strip()
                if lg and lg not in _INTL_QUALIFIER_LEAGUES:
                    raw_candidates.append(lg)
    if not raw_candidates:
        return None
    canon_counts = Counter(raw_to_canonical.get(c, c) for c in raw_candidates)
    return canon_counts.most_common(1)[0][0]


def build_league_timeline_map():
    """player_id -> {timeline: [...cells...], totals: {league: TotalGames}}.
    소스 = TournamentPlayers (페이지 단위 로스터 등록), Tournaments meta로 join.
    PLH는 TotalGames 집계용으로만 부수적으로 사용."""
    tour_meta = _load_tournaments_meta()
    raw_to_canonical = _build_tour_to_canonical_league()
    try:
        plh_rows = read_csv(get_raw_file_path("player_league_history"))
    except FileNotFoundError:
        plh_rows = []
    intl_dynamic = _build_intl_leagues_from_tour(plh_rows, tour_meta)
    league_meta = build_league_meta_map(extra_intl_leagues=intl_dynamic)

    # PLH로부터 TotalGames만 추출 (League 단위)
    totals_by_player = defaultdict(dict)
    for r in plh_rows:
        player = r.get("Player") or ""
        league = r.get("League") or ""
        if not player or not league:
            continue
        try:
            n = int(r.get("TotalGames") or 0)
        except ValueError:
            n = 0
        if n > 0:
            totals_by_player[player][league] = n

    try:
        tp_rows = read_csv(get_raw_file_path("tournament_players"))
    except FileNotFoundError:
        tp_rows = []

    by_player_cells = defaultdict(lambda: defaultdict(lambda: {"Stages": [], "Classifications": set()}))
    skipped_no_year = 0

    for tp in tp_rows:
        player = (tp.get("Link") or "").strip()
        page = (tp.get("OverviewPage") or "").strip()
        team = (tp.get("Team") or "").strip()
        if not player or not page or not team:
            continue
        meta = tour_meta.get(page)
        year = _resolve_year(page, tour_meta)
        if year is None:
            skipped_no_year += 1
            continue
        league = _resolve_league_name(page, meta, raw_to_canonical)
        # Worlds/MSI 진출전은 본선 라인이 아니라 출신 리그의 stage로 재배치
        if _is_intl_qualifier(meta):
            redirected = _redirect_qualifier_league(page, year, tour_meta, raw_to_canonical)
            if redirected:
                league = redirected
        classification = _classify_tournament(meta, team)
        cell = by_player_cells[player][(year, league, team)]
        cell["Year"] = year
        cell["League"] = league
        cell["Team"] = team
        cell["Classifications"].add(classification)
        m = meta or {}
        cell["Stages"].append({
            "Page": page,
            "Split": m.get("Split", ""),
            "IsPlayoffs": m.get("IsPlayoffs", False),
            "IsOfficial": m.get("IsOfficial", True),
            "TournamentLevel": m.get("TournamentLevel", ""),
            "Role": (tp.get("Role") or "").strip(),
        })

    if skipped_no_year:
        print(f"TournamentPlayers: skipped {skipped_no_year} entries without parseable year.")

    def _cell_classification(classes, league):
        # 리그 메타가 international이면 그쪽이 우선 (regional qualifier가 host 국가 region을 가져도 Worlds로 묶음)
        meta = league_meta.get(league)
        if meta and meta["IsInternational"]:
            return "International"
        if "International" in classes:
            return "International"
        if "Domestic" in classes:
            return "Domestic"
        return "Events"

    result = {}
    for player, cells in by_player_cells.items():
        emitted = []
        for (_, league, _), cell in cells.items():
            cls = _cell_classification(cell["Classifications"], league)
            meta = league_meta.get(league)
            if meta is None:
                meta = {
                    "Short": "",
                    "Region": "",
                    "Level": "",
                    "IsOfficial": False,
                    "IsInternational": cls == "International",
                }
            emitted.append({
                "Year": cell["Year"],
                "League": league,
                "LeagueShort": meta["Short"],
                "Region": meta["Region"],
                "Level": meta["Level"],
                "IsInternational": cls == "International",
                "Classification": cls,
                "Team": cell["Team"],
                "Stages": cell["Stages"],
            })
        # 정렬 우선순위: International > Domestic > Events, 그 안에서는 league 이름, 연도
        cls_order = {"International": 0, "Domestic": 1, "Events": 2}
        emitted.sort(key=lambda c: (cls_order[c["Classification"]], c["League"], c["Year"]))
        result[player] = {
            "timeline": emitted,
            "totals": totals_by_player.get(player, {}),
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
