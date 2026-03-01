"""
Flood Telemetry — Synthetic Data Generator
============================================
Generates realistic synthetic telemetry records to populate the
``security_telemetry`` table for Isolation Forest training.

Distribution: 70% NORMAL logins / 30% ANOMALOUS logins.

Usage (from backend/):
    python "modals & scrapper agent/flood_telemetry.py"
    python "modals & scrapper agent/flood_telemetry.py" --count 500

The script inserts records directly into vault_v2.db.
"""

from __future__ import annotations

import os
import sys
import sqlite3
import random
import argparse
import logging
from datetime import datetime, timezone, timedelta

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("flood_telemetry")

# ── Defaults ──────────────────────────────────────────────────────────────

_backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEFAULT_DB = os.path.join(_backend_dir, "vault_v2.db")
DEFAULT_COUNT = 300

# ── Realistic data pools ─────────────────────────────────────────────────

NORMAL_IPS = [
    "192.168.1.42",  "192.168.1.100", "10.0.0.5",     "10.0.0.12",
    "172.16.0.8",    "172.16.0.22",   "192.168.0.10",  "192.168.0.55",
    "10.10.1.1",     "10.10.1.50",    "172.20.0.3",    "192.168.2.7",
]

ANOMALY_IPS = [
    "45.33.32.156",  "89.207.132.1",  "203.0.113.99",  "198.51.100.42",
    "185.220.101.1",  "91.121.87.3",   "77.247.181.165", "104.244.72.115",
    "162.247.74.7",   "23.129.64.100", "5.188.62.214",  "31.13.195.42",
]

NORMAL_USERS = ["alice_q", "bob_pqc", "carol_v", "om12345", "eve_vault"]

ANOMALY_USERS = ["dave_sec", "unknown_bot", "scanner_01", "attacker_x"]

NORMAL_USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/125.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) Safari/605.1.15",
    "Mozilla/5.0 (X11; Linux x86_64; rv:128.0) Gecko/20100101 Firefox/128.0",
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0) AppleWebKit/605.1.15 Mobile",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Edge/125.0.0.0",
]

ANOMALY_USER_AGENTS = [
    "curl/7.81.0",
    "python-requests/2.31.0",
    "Go-http-client/1.1",
    "sqlmap/1.7",
    "Nikto/2.1.6",
    "Mozilla/5.0 (compatible; Googlebot/2.1)",
]

NORMAL_ENDPOINTS = ["/api/login", "/api/vault/{user}", "/api/vault/{user}/add"]
ANOMALY_ENDPOINTS = ["/api/login", "/api/register", "/api/vault/{user}", "/api/vault/{user}/add", "/api/vault/{user}/delete/test"]


# ── Generation logic ─────────────────────────────────────────────────────

def gen_normal_record(base_time: datetime) -> dict:
    """Generate a single 'normal' telemetry record."""
    user = random.choice(NORMAL_USERS)
    ip = random.choice(NORMAL_IPS)
    ua = random.choice(NORMAL_USER_AGENTS)
    ep = random.choice(NORMAL_ENDPOINTS).replace("{user}", user)
    method = "POST" if "login" in ep or "add" in ep else "GET"

    # Normal users login during business hours (8am–10pm), fast responses, mostly success
    hour_offset = random.gauss(14, 3)  # mean 2pm, stddev 3h
    hour_offset = max(6, min(22, hour_offset))
    ts = base_time.replace(hour=int(hour_offset), minute=random.randint(0, 59),
                           second=random.randint(0, 59), microsecond=0)
    ts -= timedelta(days=random.randint(0, 6))  # within last week

    return {
        "timestamp": ts.isoformat(),
        "ip_address": ip,
        "endpoint_path": ep,
        "method": method,
        "processing_time_ms": round(random.gauss(45, 15), 2),  # fast, 45ms avg
        "is_failed_attempt": 1 if random.random() < 0.05 else 0,  # only 5% fail
        "global_risk_score": round(random.uniform(0.0, 0.15), 4),  # low risk
        "user_id": user,
        "user_agent": ua,
    }


def gen_anomaly_record(base_time: datetime) -> dict:
    """Generate a single 'anomalous' telemetry record."""
    attack_type = random.choice(["brute_force", "scanning", "unusual_time", "credential_stuffing"])

    if attack_type == "brute_force":
        user = random.choice(NORMAL_USERS)   # targeting real users
        ip = random.choice(ANOMALY_IPS)
        ua = random.choice(ANOMALY_USER_AGENTS)
        ep = "/api/login"
        method = "POST"
        proc_time = round(random.gauss(12, 5), 2)  # very fast (automated)
        failed = 1  # always fails
        risk = round(random.uniform(0.55, 0.95), 4)
    elif attack_type == "scanning":
        user = random.choice(ANOMALY_USERS)
        ip = random.choice(ANOMALY_IPS)
        ua = random.choice(ANOMALY_USER_AGENTS[:4])
        ep = random.choice(["/api/vault/admin", "/api/vault/root/add", "/api/register", "/api/vault/test/delete/x"])
        method = random.choice(["GET", "POST", "DELETE"])
        proc_time = round(random.gauss(8, 3), 2)  # rapid-fire
        failed = 1 if random.random() < 0.85 else 0
        risk = round(random.uniform(0.45, 0.85), 4)
    elif attack_type == "unusual_time":
        user = random.choice(NORMAL_USERS)
        ip = random.choice(ANOMALY_IPS)
        ua = random.choice(NORMAL_USER_AGENTS)  # looks legitimate
        ep = "/api/login"
        method = "POST"
        proc_time = round(random.gauss(50, 20), 2)
        failed = 0  # succeeds (credential compromise)
        risk = round(random.uniform(0.30, 0.65), 4)
    else:  # credential_stuffing
        user = f"user_{random.randint(1000,9999)}"  # random nonexistent users
        ip = random.choice(ANOMALY_IPS)
        ua = random.choice(ANOMALY_USER_AGENTS)
        ep = "/api/login"
        method = "POST"
        proc_time = round(random.gauss(15, 8), 2)
        failed = 1
        risk = round(random.uniform(0.60, 0.98), 4)

    # Anomalies happen at odd hours (1am–5am)
    hour_offset = random.gauss(3, 1.5)
    hour_offset = max(0, min(5, hour_offset))
    ts = base_time.replace(hour=int(hour_offset), minute=random.randint(0, 59),
                           second=random.randint(0, 59), microsecond=0)
    ts -= timedelta(days=random.randint(0, 6))

    return {
        "timestamp": ts.isoformat(),
        "ip_address": ip,
        "endpoint_path": ep,
        "method": method,
        "processing_time_ms": max(1.0, proc_time),
        "is_failed_attempt": failed,
        "global_risk_score": risk,
        "user_id": user,
        "user_agent": ua,
    }


def flood(db_path: str, count: int):
    """Insert `count` synthetic records into security_telemetry."""

    normal_count = int(count * 0.70)
    anomaly_count = count - normal_count

    logger.info("Generating %d records (%d normal / %d anomalous)...",
                count, normal_count, anomaly_count)

    base = datetime.now(timezone.utc)
    records = []

    for _ in range(normal_count):
        records.append(gen_normal_record(base))
    for _ in range(anomaly_count):
        records.append(gen_anomaly_record(base))

    # Shuffle so the order is realistic
    random.shuffle(records)

    # Insert into DB
    with sqlite3.connect(db_path) as conn:
        c = conn.cursor()
        for r in records:
            c.execute("""
                INSERT INTO security_telemetry
                    (timestamp, ip_address, endpoint_path, method,
                     processing_time_ms, is_failed_attempt, global_risk_score,
                     user_id, user_agent)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                r["timestamp"], r["ip_address"], r["endpoint_path"], r["method"],
                r["processing_time_ms"], r["is_failed_attempt"], r["global_risk_score"],
                r["user_id"], r["user_agent"],
            ))
        conn.commit()

    logger.info("✅  Inserted %d records into %s", count, db_path)

    # ── Summary ────────────────────────────────────────────
    with sqlite3.connect(db_path) as conn:
        c = conn.cursor()
        c.execute("SELECT COUNT(*) FROM security_telemetry")
        total = c.fetchone()[0]
        c.execute("SELECT COUNT(DISTINCT ip_address) FROM security_telemetry")
        ips = c.fetchone()[0]
        c.execute("SELECT SUM(is_failed_attempt), COUNT(*) FROM security_telemetry")
        row = c.fetchone()
        fail_pct = (row[0] / row[1] * 100) if row[1] else 0

    logger.info("-" * 50)
    logger.info("Database now has:")
    logger.info("    Total records  : %d", total)
    logger.info("    Unique IPs     : %d", ips)
    logger.info("    Failure rate   : %.1f%%", fail_pct)
    logger.info("-" * 50)
    logger.info("You can now train the model:")
    logger.info('    python "modals & scrapper agent/train_model.py"')


def main():
    parser = argparse.ArgumentParser(
        description="Flood security_telemetry with synthetic data for model training."
    )
    parser.add_argument(
        "--db",
        default=DEFAULT_DB,
        help=f"Path to SQLite database (default: {DEFAULT_DB})",
    )
    parser.add_argument(
        "--count", "-n",
        type=int,
        default=DEFAULT_COUNT,
        help=f"Number of records to generate (default: {DEFAULT_COUNT})",
    )
    args = parser.parse_args()

    db_path = os.path.abspath(args.db)
    if not os.path.isfile(db_path):
        logger.error("Database not found: %s", db_path)
        sys.exit(1)

    logger.info("=" * 50)
    logger.info("QuantumVault — Synthetic Telemetry Generator")
    logger.info("=" * 50)
    logger.info("Database : %s", db_path)
    logger.info("Records  : %d (70%% normal / 30%% anomaly)", args.count)
    logger.info("=" * 50)

    flood(db_path, args.count)


if __name__ == "__main__":
    main()
