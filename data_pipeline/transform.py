import json
import csv
from collections import defaultdict
from datetime import datetime

from paths import get_raw_file_path, get_processed_file_path

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


def build_player_histories():
    players = read_csv(get_raw_file_path("players"))
    tenures = read_csv(get_raw_file_path("tenures"))
    roster_changes = read_csv(get_raw_file_path("roster_changes"))

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
        player_info = {
            'Player': player,
            'History': player_history
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

    return player_history

if __name__ == "__main__":
    player_infos = build_player_histories()
    # 결과를 processed_data 디렉토리에 JSON 파일로 저장
    output_path = get_processed_file_path("players_info")
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(player_infos, f, ensure_ascii=False, indent=4)
