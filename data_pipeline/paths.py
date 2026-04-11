from pathlib import Path
import json

BASE_DIR = Path(__file__).resolve().parent
CONFIG_PATH = BASE_DIR / "config.json"
DATA_DIR = BASE_DIR.parent / "data"

_config = None

def load_config():
    global _config
    if _config is None:
        with open(CONFIG_PATH, "r", encoding="utf-8") as f:
            _config = json.load(f)
    return _config

def get_raw_file_path(key):
    config = load_config()
    data_directory = config["paths"]["raw_data"].get("data_directory", "data/raw")
    path = config["paths"]["raw_data"].get(key)
    if path is None:
        raise KeyError(f"config.json에 '{key}' 경로가 없습니다.")
    return DATA_DIR / data_directory / path


def get_processed_file_path(key):
    config = load_config()
    data_directory = config["paths"]["processed_data"].get("data_directory", "data/processed")
    path = config["paths"]["processed_data"].get(key)
    if path is None:
        raise KeyError(f"config.json에 '{key}' 경로가 없습니다.")
    return DATA_DIR / data_directory / path
