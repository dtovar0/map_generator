#!/usr/bin/env python3
"""Collect only RRD data sources referenced by saved Map Generator maps."""

from __future__ import annotations

import argparse
import fcntl
import json
import math
import os
from pathlib import Path
import subprocess
import sys
from datetime import datetime

try:
    import pymysql
except ImportError:
    print("Falta PyMySQL: pip install PyMySQL", file=sys.stderr)
    raise SystemExit(2)


BASE_DIR = Path(__file__).resolve().parent.parent


def load_env_file(filename: Path) -> None:
    if not filename.is_file():
        return
    for raw_line in filename.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip("\"'"))


def env(name: str, default: str = "") -> str:
    return os.environ.get(name, default)


def database_connection():
    options = {
        "user": env("CACTI_DB_USER", "cacti_map_reader"),
        "password": env("CACTI_DB_PASSWORD"),
        "database": env("CACTI_DB_NAME", "cacti"),
        "charset": "utf8mb4",
        "autocommit": False,
    }
    socket = env("CACTI_DB_SOCKET")
    if socket:
        options["unix_socket"] = socket
    else:
        options["host"] = env("CACTI_DB_HOST", "127.0.0.1")
        options["port"] = int(env("CACTI_DB_PORT", "3306"))
    return pymysql.connect(**options)


def required_bindings(maps_dir: Path) -> dict[int, set[str]]:
    required: dict[int, set[str]] = {}
    for filename in maps_dir.glob("*.json"):
        try:
            record = json.loads(filename.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as error:
            print(f"Aviso: se omitió {filename.name}: {error}", file=sys.stderr)
            continue
        days = record.get("days") or {}
        snapshot = days.get(max(days)) if days else None
        for link in (snapshot or {}).get("links", []):
            source = link.get("dataSource") or {}
            if source.get("provider") != "cacti":
                continue
            try:
                local_data_id = int(source["localDataId"])
            except (KeyError, TypeError, ValueError):
                continue
            names = {str(source.get("inDs") or ""), str(source.get("outDs") or "")}
            required.setdefault(local_data_id, set()).update(name for name in names if name)
    return required


def source_paths(connection, ids: list[int]) -> dict[int, str]:
    if not ids:
        return {}
    placeholders = ",".join(["%s"] * len(ids))
    sql = f"""
        SELECT dl.id, dtd.data_source_path
          FROM data_local dl
          JOIN data_template_data dtd ON dtd.local_data_id = dl.id
         WHERE dl.id IN ({placeholders})
    """
    with connection.cursor() as cursor:
        cursor.execute(sql, ids)
        return {int(local_id): str(rrd_path) for local_id, rrd_path in cursor.fetchall() if rrd_path}


def resolve_rrd_path(stored_path: str, roots: list[Path]) -> Path:
    expanded = stored_path.replace("<path_rra>", str(roots[0])).replace("<path_cacti>", str(roots[0].parent))
    candidate = Path(expanded)
    if not candidate.is_absolute():
        candidate = roots[0] / candidate
    actual = candidate.resolve(strict=True)
    if actual.suffix.lower() != ".rrd" or not any(actual == root or root in actual.parents for root in roots):
        raise ValueError("ruta RRD fuera de los directorios permitidos")
    return actual


def fetch_latest(rrdtool: str, filename: Path, wanted: set[str]) -> list[tuple[str, datetime, float]]:
    process = subprocess.run(
        [rrdtool, "fetch", str(filename), "AVERAGE", "--start", "now-20m", "--end", "now"],
        check=True, capture_output=True, text=True, timeout=15,
    )
    lines = [line.strip() for line in process.stdout.splitlines() if line.strip()]
    if not lines:
        return []
    names = lines[0].split()
    indexes = {name: index for index, name in enumerate(names) if name in wanted}
    latest: dict[str, tuple[datetime, float]] = {}
    for line in lines[1:]:
        if ":" not in line:
            continue
        raw_timestamp, raw_values = line.split(":", 1)
        try:
            timestamp = datetime.fromtimestamp(int(raw_timestamp))
        except ValueError:
            continue
        values = raw_values.split()
        for name, index in indexes.items():
            if index >= len(values):
                continue
            try:
                value = float(values[index])
            except ValueError:
                continue
            if math.isfinite(value):
                latest[name] = (timestamp, max(0.0, value))
    return [(name, timestamp, value) for name, (timestamp, value) in latest.items()]


def save_samples(connection, samples: list[tuple[int, str, datetime, float]], retention_days: int) -> None:
    with connection.cursor() as cursor:
        if samples:
            cursor.executemany(
                """INSERT INTO mapgen_rrd_samples (local_data_id, ds_name, sample_time, value_raw)
                   VALUES (%s, %s, %s, %s)
                   ON DUPLICATE KEY UPDATE value_raw = VALUES(value_raw), collected_at = CURRENT_TIMESTAMP""",
                samples,
            )
        cursor.execute(
            "DELETE FROM mapgen_rrd_samples WHERE sample_time < NOW() - INTERVAL %s DAY",
            (retention_days,),
        )
    connection.commit()


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--env", type=Path, default=BASE_DIR / ".env.local")
    parser.add_argument("--maps-dir", type=Path)
    parser.add_argument("--init-schema", action="store_true")
    args = parser.parse_args()
    load_env_file(args.env)

    lock_path = Path(env("MAPGEN_COLLECTOR_LOCK", "/tmp/mapgen-cacti-collector.lock"))
    lock_file = lock_path.open("w", encoding="utf-8")
    try:
        fcntl.flock(lock_file.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
    except BlockingIOError:
        print("MapGen: ya hay un colector en ejecución; se omite este ciclo")
        return 0

    maps_dir = (args.maps_dir or Path(env("MAPGEN_MAPS_DIR", str(BASE_DIR / "data" / "maps")))).resolve()
    roots = [Path(item).resolve() for item in env("CACTI_RRD_ROOTS", "/var/lib/cacti/rra").split(os.pathsep) if item]
    rrdtool = env("CACTI_RRDTOOL", "/usr/bin/rrdtool")
    retention_days = max(1, int(env("MAPGEN_METRICS_RETENTION_DAYS", "400")))

    connection = database_connection()
    try:
        if args.init_schema:
            schema = (Path(__file__).parent / "schema.mysql.sql").read_text(encoding="utf-8")
            with connection.cursor() as cursor:
                cursor.execute(schema)
            connection.commit()

        required = required_bindings(maps_dir)
        paths = source_paths(connection, list(required))
        samples: list[tuple[int, str, datetime, float]] = []
        failures = 0
        for local_data_id, ds_names in required.items():
            try:
                stored_path = paths.get(local_data_id)
                if not stored_path:
                    raise ValueError("Cacti no devolvió una ruta RRD")
                filename = resolve_rrd_path(stored_path, roots)
                samples.extend((local_data_id, name, timestamp, value) for name, timestamp, value in fetch_latest(rrdtool, filename, ds_names))
            except (OSError, ValueError, subprocess.SubprocessError) as error:
                failures += 1
                print(f"Error local_data_id={local_data_id}: {error}", file=sys.stderr)
        save_samples(connection, samples, retention_days)
        print(f"MapGen: {len(required)} RRD requeridos, {len(samples)} muestras guardadas, {failures} errores")
        return 1 if failures else 0
    finally:
        connection.close()


if __name__ == "__main__":
    raise SystemExit(main())
