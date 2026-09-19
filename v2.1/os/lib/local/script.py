#!/usr/bin/env python3
"""
RID3 OS — генератор реестра приложений (lib/local/script.py)
==============================================================

Запускается ЛОКАЛЬНО, вручную или в CI, ПЕРЕД деплоем статического сайта.
Ничего не отправляет по сети и не требует зависимостей, кроме стандартной
библиотеки Python 3.

Что делает:
  1. Сканирует директорию `apps/` от корня проекта — каждая непосредственная
     подпапка `apps/<appname>/` считается одним приложением.
  2. В каждой такой подпапке ищет файл конфигурации `config.rnn`
     (формат "ключ: значение", см. ниже) и перечисленные в нём файлы.
  3. Проверяет, что все обязательные поля заполнены, а все файлы,
     указанные в `files`, физически существуют на диске.
  4. Собирает итоговый манифест и сохраняет его в `apps/apps.json` —
     ЕДИНСТВЕННЫЙ файл, который клиентский загрузчик (lib/boot-loader.js)
     запрашивает по сети во время старта Web OS.

Формат config.rnn (RID3 Registry Node):
    # строки, начинающиеся с # — комментарии
    name: Заметки
    icon: 📝
    version: 2.0
    entry: index.html
    files: index.html, style.css
    description: Простой блокнот
    window.width: 420
    window.height: 460
    window.resizable: true
    permissions: storage
    resources.memory: 64

  - строка "ключ: значение" на каждую настройку;
  - ключи с точкой (window.width) группируются во вложенный объект;
  - "files" и "permissions" — список значений через запятую;
  - true/false и числа приводятся к соответствующим типам JSON.

Обязательные поля: name, entry, files.
Приложение без config.rnn или с ошибкой валидации по умолчанию
ПРОПУСКАЕТСЯ (с предупреждением в консоль) и не попадает в apps.json —
это гарантирует, что клиентский загрузчик никогда не наткнётся на
битую ссылку из реестра. Флаг --strict превращает такие ситуации
в ошибку сборки (ненулевой код выхода), что удобно для CI.

Использование:
    python3 lib/local/script.py
    python3 lib/local/script.py --root /path/to/project
    python3 lib/local/script.py --strict
    python3 lib/local/script.py --quiet
"""

from __future__ import annotations

import argparse
import json
import sys
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

CONFIG_FILENAME = "config.rnn"
APPS_JSON_FILENAME = "apps.json"
REQUIRED_KEYS = ("name", "entry", "files")


class ConfigError(Exception):
    """Ошибка парсинга или валидации config.rnn одного приложения."""


@dataclass
class AppResult:
    app_id: str
    ok: bool
    manifest: dict[str, Any] | None = None
    error: str | None = None
    warnings: list[str] = field(default_factory=list)


# --------------------------------------------------------------------------
# Парсинг .rnn (формат "ключ: значение", вложенность через точку в ключе)
# --------------------------------------------------------------------------

def parse_rnn(text: str) -> dict[str, Any]:
    data: dict[str, Any] = {}
    for lineno, raw in enumerate(text.splitlines(), start=1):
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        if ":" not in line:
            raise ConfigError(f"строка {lineno} не в формате \"ключ: значение\": {line!r}")
        key, _, value = line.partition(":")
        key = key.strip()
        value = value.strip()
        if not key:
            raise ConfigError(f"пустой ключ на строке {lineno}")

        typed_value: Any = value
        if value == "true":
            typed_value = True
        elif value == "false":
            typed_value = False
        elif value == "":
            typed_value = ""
        elif _looks_numeric(value):
            typed_value = float(value) if "." in value else int(value)

        if "." in key:
            group, sub = key.split(".", 1)
            bucket = data.setdefault(group, {})
            if not isinstance(bucket, dict):
                raise ConfigError(f"ключ {group!r} уже занят не-объектом (строка {lineno})")
            bucket[sub] = typed_value
        else:
            data[key] = typed_value

    if isinstance(data.get("files"), str):
        data["files"] = [s.strip() for s in data["files"].split(",") if s.strip()]
    if isinstance(data.get("permissions"), str):
        data["permissions"] = [s.strip() for s in data["permissions"].split(",") if s.strip()]
    data.setdefault("permissions", [])

    return data


def _looks_numeric(value: str) -> bool:
    try:
        float(value)
        return True
    except ValueError:
        return False


def validate_rnn(data: dict[str, Any]) -> None:
    missing = [k for k in REQUIRED_KEYS if k not in data or data[k] in ("", None)]
    if missing:
        raise ConfigError(f"отсутствуют обязательные поля: {', '.join(missing)}")

    files = data.get("files")
    if not isinstance(files, list) or not files:
        raise ConfigError('поле "files" должно быть непустым списком имён файлов')

    entry = data.get("entry")
    if entry not in files:
        raise ConfigError(f'поле "entry" ({entry!r}) должно быть указано и в списке "files"')

    mem = (data.get("resources") or {}).get("memory")
    if mem is not None and not (isinstance(mem, (int, float)) and mem > 0):
        raise ConfigError('поле "resources.memory" должно быть положительным числом (МБ)')


# --------------------------------------------------------------------------
# Обработка одного приложения
# --------------------------------------------------------------------------

def process_app(app_dir: Path, apps_root: Path, project_root: Path) -> AppResult:
    app_id = app_dir.name
    config_path = app_dir / CONFIG_FILENAME

    if not config_path.is_file():
        return AppResult(app_id, ok=False, error=f"файл {CONFIG_FILENAME} не найден")

    try:
        raw = config_path.read_text(encoding="utf-8")
        data = parse_rnn(raw)
        validate_rnn(data)
    except ConfigError as e:
        return AppResult(app_id, ok=False, error=str(e))
    except UnicodeDecodeError as e:
        return AppResult(app_id, ok=False, error=f"файл {CONFIG_FILENAME} не в UTF-8: {e}")

    warnings: list[str] = []
    missing_files = []
    rel_files = []
    for name in data["files"]:
        f_path = app_dir / name
        if not f_path.is_file():
            missing_files.append(name)
        else:
            rel_files.append(_rel_posix(f_path, project_root))

    if missing_files:
        return AppResult(
            app_id, ok=False,
            error=f"в {CONFIG_FILENAME} перечислены отсутствующие на диске файлы: {', '.join(missing_files)}",
        )

    icon = data.get("icon") or "📦"
    version = str(data.get("version", "1.0"))
    description = data.get("description", "")

    manifest: dict[str, Any] = {
        "id": app_id,
        "name": data["name"],
        "icon": icon,
        "version": version,
        "description": description,
        "path": _rel_posix(app_dir, project_root),
        "entry": _rel_posix(app_dir / data["entry"], project_root),
        "config": _rel_posix(config_path, project_root),
        "files": rel_files,
        "permissions": data.get("permissions", []),
    }
    if "window" in data:
        manifest["window"] = data["window"]
    if "resources" in data:
        manifest["resources"] = data["resources"]

    return AppResult(app_id, ok=True, manifest=manifest, warnings=warnings)


def _rel_posix(path: Path, project_root: Path) -> str:
    return path.resolve().relative_to(project_root.resolve()).as_posix()


# --------------------------------------------------------------------------
# Основной сценарий
# --------------------------------------------------------------------------

def discover_app_dirs(apps_root: Path) -> list[Path]:
    if not apps_root.is_dir():
        return []
    return sorted(
        p for p in apps_root.iterdir()
        if p.is_dir() and not p.name.startswith(".")
    )


def build_registry(project_root: Path, strict: bool, quiet: bool) -> int:
    apps_root = project_root / "apps"
    out_path = apps_root / APPS_JSON_FILENAME

    app_dirs = discover_app_dirs(apps_root)
    if not app_dirs:
        _log(quiet, f"[!] Директория {apps_root} пуста или не найдена — apps.json не будет создан.")
        return 1

    results = [process_app(d, apps_root, project_root) for d in app_dirs]
    ok_results = [r for r in results if r.ok]
    bad_results = [r for r in results if not r.ok]

    for r in ok_results:
        _log(quiet, f"[OK]   {r.app_id}")
        for w in r.warnings:
            _log(quiet, f"       ! {w}")
    for r in bad_results:
        _log(quiet, f"[SKIP] {r.app_id}: {r.error}")

    registry = {
        "generatedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "count": len(ok_results),
        "apps": [r.manifest for r in ok_results],
    }

    apps_root.mkdir(parents=True, exist_ok=True)
    out_path.write_text(
        json.dumps(registry, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    _log(quiet, "")
    _log(quiet, f"Готово: {len(ok_results)} прил. записано в {_rel_posix(out_path, project_root)}, "
                f"{len(bad_results)} пропущено.")

    if strict and bad_results:
        _log(quiet, "[FAIL] --strict: сборка прервана из-за некорректных приложений выше.")
        return 2

    return 0


def _log(quiet: bool, message: str) -> None:
    if not quiet:
        print(message)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Генератор реестра приложений RID3 OS (apps/apps.json)")
    parser.add_argument(
        "--root", type=Path, default=None,
        help="Корень проекта (по умолчанию — на два уровня выше lib/local/script.py)",
    )
    parser.add_argument(
        "--strict", action="store_true",
        help="Завершить с ошибкой (код 2), если хотя бы одно приложение не прошло валидацию",
    )
    parser.add_argument("--quiet", action="store_true", help="Не печатать прогресс, только итог/ошибки")
    args = parser.parse_args(argv)

    project_root = args.root.resolve() if args.root else Path(__file__).resolve().parents[2]
    return build_registry(project_root, strict=args.strict, quiet=args.quiet)


if __name__ == "__main__":
    sys.exit(main())
