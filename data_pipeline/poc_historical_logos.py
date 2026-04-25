"""
PoC: Historical team logo resolution.

Resolution order for each historical team name (= name in tenures.csv but not
in teams.csv as a current row):

  1. exact match in teams_map (Name -> Image)
  2. redirect_map[name] resolves to a name in teams_map
  3. case-insensitive match in teams_map
  4. case-insensitive match in redirect_map -> teams_map
  5. forward team_renames chain reaches a name in teams_map
  6. fallback: imageinfo filename guessing (<Name>logo*.png)
  7. drop as "phantom" if NO path (redirect/rename) reaches teams_map at all

Logo URL convention: https://lol.fandom.com/wiki/Special:FilePath/<image filename>
(same as data_pipeline/transform.py:_logo_url)

Outputs (data/processed/):
  historical_logos.json             { name: {image, url, via} }
  historical_logos_phantom.txt      names dropped as phantoms (no chain to current team)
  historical_logos_limitations.json era-mismatch candidates needing manual override
"""
import csv
import json
import time
import urllib.parse
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw"
OUT = ROOT / "data" / "processed"

API = "https://lol.fandom.com/api.php"
SUFFIXES = [
    "logo square.png",
    "logo profile.png",
    "logo std.png",
    "logo.png",
    "_logo.png",
]
HEADERS = {"User-Agent": "lck-viewer-poc/0.2 (chunuiyu@gmail.com)"}
BATCH = 40


def special_filepath_url(image: str) -> str:
    return f"https://lol.fandom.com/wiki/Special:FilePath/{image.replace(' ', '_')}"


def load_tenure_team_names() -> set[str]:
    with open(RAW / "tenures.csv", encoding="utf-8") as f:
        return {row["Team"] for row in csv.DictReader(f) if row["Team"]}


def load_teams_map() -> dict[str, str]:
    """Name -> Image (filename) from teams.csv."""
    m: dict[str, str] = {}
    with open(RAW / "teams.csv", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            name = (row.get("Name") or "").strip()
            image = (row.get("Image") or "").strip()
            if name and image:
                m[name] = image
    return m


def load_redirect_map() -> dict[str, str]:
    """AllName -> PageName from team_redirects.csv."""
    m: dict[str, str] = {}
    with open(RAW / "team_redirects.csv", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            alias = (row.get("AllName") or "").strip()
            page = (row.get("PageName") or "").strip()
            if alias and page:
                m[alias] = page
    return m


def load_rename_forward() -> dict[str, list[str]]:
    """OriginalName -> [NewName, ...] from team_renames.csv (rebrand/rename only)."""
    m: dict[str, list[str]] = {}
    with open(RAW / "team_renames.csv", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            verb = (row.get("Verb") or "").strip()
            if verb not in ("rebrand", "rename"):
                continue
            o = (row.get("OriginalName") or "").strip()
            n = (row.get("NewName") or "").strip()
            if o and n and o != n:
                m.setdefault(o, []).append(n)
    return m


def walk_rename_chain(
    start: str, rename_forward: dict[str, list[str]], teams_map: dict[str, str]
) -> str | None:
    """Follow forward renames; return the first name found in teams_map, else None."""
    seen = {start}
    frontier = [start]
    while frontier:
        cur = frontier.pop(0)
        for nxt in rename_forward.get(cur, []):
            if nxt in seen:
                continue
            seen.add(nxt)
            if nxt in teams_map:
                return nxt
            frontier.append(nxt)
    return None


def reaches_any_team(
    name: str,
    teams_map: dict[str, str],
    teams_map_ci: dict[str, str],
    redirect_map: dict[str, str],
    redirect_map_ci: dict[str, str],
    rename_forward: dict[str, list[str]],
) -> bool:
    """Does this name connect to any team in teams_map via redirect or rename chain?"""
    if name in teams_map:
        return True
    if name.lower() in teams_map_ci:
        return True
    if name in redirect_map and redirect_map[name] in teams_map:
        return True
    if name.lower() in redirect_map_ci and redirect_map_ci[name.lower()] in teams_map:
        return True
    if walk_rename_chain(name, rename_forward, teams_map) is not None:
        return True
    return False


def candidate_filenames(name: str) -> list[str]:
    return [f"{name}{s}" for s in SUFFIXES]


def probe_batch(filenames: list[str]) -> dict[str, str | None]:
    """Return {filename: url-or-None} for a batch of File:<name> titles."""
    titles = "|".join(f"File:{fn}" for fn in filenames)
    params = {
        "action": "query",
        "titles": titles,
        "prop": "imageinfo",
        "iiprop": "url",
        "format": "json",
        "redirects": 1,
    }
    r = requests.get(API, params=params, headers=HEADERS, timeout=30)
    r.raise_for_status()
    data = r.json()
    pages = data.get("query", {}).get("pages", {})
    norm = {n["from"]: n["to"] for n in data.get("query", {}).get("normalized", [])}

    title_to_filename = {}
    for fn in filenames:
        req = f"File:{fn}"
        resolved = norm.get(req, req)
        title_to_filename[resolved] = fn

    out = {fn: None for fn in filenames}
    for p in pages.values():
        title = p.get("title")
        fn = title_to_filename.get(title)
        if not fn:
            continue
        if "missing" in p:
            continue
        ii = p.get("imageinfo")
        if ii and ii[0].get("url"):
            out[fn] = ii[0]["url"]
    return out


def chunk(seq, n):
    for i in range(0, len(seq), n):
        yield seq[i : i + n]


def guess_logo_via_imageinfo(names: list[str]) -> dict[str, dict]:
    """Probe candidate filenames for each name; return {name: {image, url}}."""
    unique_filenames: list[str] = []
    seen = set()
    for name in names:
        for fn in candidate_filenames(name):
            if fn not in seen:
                seen.add(fn)
                unique_filenames.append(fn)

    results: dict[str, str | None] = {}
    total = (len(unique_filenames) + BATCH - 1) // BATCH
    for i, batch_fns in enumerate(chunk(unique_filenames, BATCH), start=1):
        print(f"  imageinfo batch {i}/{total} ({len(batch_fns)} filenames)")
        try:
            results.update(probe_batch(batch_fns))
        except Exception as e:
            print(f"    error: {e}; sleeping 10s and retrying once")
            time.sleep(10)
            results.update(probe_batch(batch_fns))
        time.sleep(0.5)

    found: dict[str, dict] = {}
    for name in names:
        for fn in candidate_filenames(name):
            url = results.get(fn)
            if url:
                found[name] = {"image": fn, "url": url}
                break
    return found


def main():
    tenure_names = load_tenure_team_names()
    teams_map = load_teams_map()
    redirect_map = load_redirect_map()
    rename_forward = load_rename_forward()

    teams_map_ci: dict[str, str] = {}
    for name, image in teams_map.items():
        teams_map_ci.setdefault(name.lower(), name)  # first-wins

    redirect_map_ci: dict[str, str] = {}
    for alias, page in redirect_map.items():
        redirect_map_ci.setdefault(alias.lower(), page)  # first-wins

    historical = sorted(tenure_names - set(teams_map.keys()))
    print(f"Historical names (tenure - teams.csv): {len(historical)}")

    # Priority: own-name imageinfo FIRST (catches historical names that have
    # their own File: page like DAMWON Gaminglogo square.png), THEN redirect /
    # case-insensitive / rename fallbacks (which collapse to current team's logo).
    print(f"Step 1: imageinfo for own-name logos across {len(historical)} names")
    own_logo = guess_logo_via_imageinfo(historical)
    print(f"  own-name hits: {len(own_logo)}")

    found: dict[str, dict] = {}
    phantoms: list[str] = []

    for name in historical:
        # Step 1: own-name imageinfo
        if name in own_logo:
            info = own_logo[name]
            found[name] = {
                "image": info["image"],
                "url": info["url"],
                "via": "self_guess",
            }
            continue

        # Step 2: exact redirect → teams_map
        if name in redirect_map and redirect_map[name] in teams_map:
            tgt = redirect_map[name]
            img = teams_map[tgt]
            found[name] = {
                "image": img,
                "url": special_filepath_url(img),
                "via": f"redirect:{tgt}",
            }
            continue

        # Step 3: case-insensitive match in teams_map
        ci = teams_map_ci.get(name.lower())
        if ci is not None:
            img = teams_map[ci]
            found[name] = {
                "image": img,
                "url": special_filepath_url(img),
                "via": f"self_ci:{ci}",
            }
            continue

        # Step 4: case-insensitive redirect → teams_map
        ci_target = redirect_map_ci.get(name.lower())
        if ci_target is not None and ci_target in teams_map:
            img = teams_map[ci_target]
            found[name] = {
                "image": img,
                "url": special_filepath_url(img),
                "via": f"redirect_ci:{ci_target}",
            }
            continue

        # Step 5: forward rename chain → teams_map
        chain_target = walk_rename_chain(name, rename_forward, teams_map)
        if chain_target is not None:
            img = teams_map[chain_target]
            found[name] = {
                "image": img,
                "url": special_filepath_url(img),
                "via": f"rename:{chain_target}",
            }
            continue

    # Step 7: anything still unresolved → phantom (no chain) or missing (chain exists)
    missing: list[str] = []
    for name in historical:
        if name in found:
            continue
        if reaches_any_team(
            name, teams_map, teams_map_ci, redirect_map, redirect_map_ci, rename_forward
        ):
            missing.append(name)
        else:
            phantoms.append(name)
    # Sanity: the new algorithm always resolves real teams either via own-name
    # imageinfo or via redirect/rename chains, so missing should be empty.
    assert not missing, f"unexpected unresolved real teams: {missing}"

    # --- Limitation analysis: detect entries resolved via redirect/rename
    # whose actual era logo is likely a parent-prefix file we didn't try.
    print()
    print("Step 8: parent-prefix probe for redirect/rename-resolved entries")
    candidate_names: list[str] = []
    for name, info in found.items():
        if info["via"].startswith(("redirect", "rename", "self_ci")):
            candidate_names.append(name)

    # Build parent-prefix candidates: every prefix of the words in the name
    parent_prefix_candidates: dict[str, list[str]] = {}
    all_prefix_filenames = set()
    for name in candidate_names:
        words = name.split()
        prefixes: list[str] = []
        for k in range(1, len(words)):
            prefixes.append(" ".join(words[:k]))
            prefixes.append(" ".join(words[k:]))
        prefixes = list(dict.fromkeys(prefixes))  # de-dupe, preserve order
        parent_prefix_candidates[name] = prefixes
        for p in prefixes:
            for fn in candidate_filenames(p):
                all_prefix_filenames.add(fn)

    prefix_results: dict[str, str | None] = {}
    unique_list = sorted(all_prefix_filenames)
    total = (len(unique_list) + BATCH - 1) // BATCH
    for i, batch_fns in enumerate(chunk(unique_list, BATCH), start=1):
        if i % 10 == 1 or i == total:
            print(f"  prefix batch {i}/{total} ({len(batch_fns)} filenames)")
        try:
            prefix_results.update(probe_batch(batch_fns))
        except Exception as e:
            print(f"    error: {e}; sleeping 10s and retrying once")
            time.sleep(10)
            prefix_results.update(probe_batch(batch_fns))
        time.sleep(0.5)

    limitations: list[dict] = []
    for name in candidate_names:
        prefixes = parent_prefix_candidates.get(name, [])
        for p in prefixes:
            for fn in candidate_filenames(p):
                if prefix_results.get(fn):
                    limitations.append(
                        {
                            "name": name,
                            "current_via": found[name]["via"],
                            "current_image": found[name]["image"],
                            "parent_prefix": p,
                            "parent_image": fn,
                            "parent_url": prefix_results[fn],
                        }
                    )
                    break
            else:
                continue
            break

    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "historical_logos.json").write_text(
        json.dumps(found, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    (OUT / "historical_logos_phantom.txt").write_text(
        "\n".join(phantoms) + ("\n" if phantoms else ""), encoding="utf-8"
    )

    via_counts: dict[str, int] = {}
    for v in found.values():
        via = v["via"].split(":")[0]
        via_counts[via] = via_counts.get(via, 0) + 1

    (OUT / "historical_logos_limitations.json").write_text(
        json.dumps(limitations, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    print()
    print(f"FOUND   : {len(found)} / {len(historical)}  ({via_counts})")
    print(f"PHANTOM : {len(phantoms)} / {len(historical)}   (no chain to current team)")
    print(f"LIMIT   : {len(limitations)}   (parent-prefix logo candidates exist)")
    print(f"-> {OUT/'historical_logos.json'}")
    print(f"-> {OUT/'historical_logos_phantom.txt'}")
    print(f"-> {OUT/'historical_logos_limitations.json'}")


if __name__ == "__main__":
    main()
