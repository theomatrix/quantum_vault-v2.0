# 🛡️ Modals & Scrapper Agent — Behavioral Security Module

> **QuantumVault's AI-powered security layer** that detects distributed brute-force attacks,
> API probing, and Account Takeovers (ATO) in real time — without ever touching passwords or cryptographic keys.

---

## 📁 Folder Structure

```
backend/modals & scrapper agent/
├── __init__.py          → Package exports & public API
├── models.py            → Database schemas + Pydantic models
├── global_model.py      → System-wide anomaly detection (Isolation Forest)
├── user_baseline.py     → Per-user behavioral drift engine (Z-scores)
└── agent.py             → ASGI middleware — the "scrapper agent" that ties everything together
```

---

## 🔄 How It All Works Together

```
                    ┌──────────────────────────────┐
  Incoming Request  │     agent.py (Middleware)     │
 ──────────────────►│  Scrapes: IP, UA, User, Time  │
                    │                              │
                    │   ┌────────────┐ ┌─────────────────┐
                    │   │global_model│ │ user_baseline.py │
                    │   │    .py     │ │                  │
                    │   │ Isolation  │ │  Cyclical Z-score│
                    │   │  Forest    │ │  IP/UA novelty   │
                    │   └─────┬──────┘ └───────┬──────────┘
                    │         │                │
                    │    global_score     user_score
                    │         │                │
                    │    hybrid_risk_score = 0.5g + 0.5u
                    │                              │
                    │   Headers injected:           │
                    │     X-Risk-Score              │
                    │     X-User-Risk-Score         │
                    │     X-Hybrid-Risk-Score       │
                    │     X-Is-Anomaly              │
                    └──────────────┬────────────────┘
                                  │
                    ┌─────────────▼──────────────┐
                    │  Background Tasks (async)   │
                    │  • INSERT → security_telemetry │
                    │  • UPDATE → user_security_profiles │
                    └─────────────────────────────┘
```

**Key principle:** All scoring happens *inside the response pipeline*. All database writes happen *after the response*, in background tasks, so the API never slows down.

---

## 📄 File-by-File Breakdown

---

### 1. `models.py` — Database Schemas & Data Models

**Purpose:** Defines every database table the security module uses and provides functions to initialise/migrate them on app startup.

#### Tables Created

| Table | Purpose |
|---|---|
| `security_telemetry` | Append-only log of every monitored API request |
| `user_security_profiles` | Cached per-user behavioral baselines |

#### `security_telemetry` Schema

| Column | Type | Description |
|---|---|---|
| `id` | INTEGER PK | Auto-incremented row ID |
| `timestamp` | TEXT | ISO-8601 UTC timestamp |
| `ip_address` | TEXT | Client IP (from X-Forwarded-For or direct connection) |
| `endpoint_path` | TEXT | e.g., `/api/login`, `/api/vault/alice/add` |
| `method` | TEXT | `GET`, `POST`, `DELETE` |
| `processing_time_ms` | REAL | Round-trip latency of the request |
| `is_failed_attempt` | INTEGER | 1 if HTTP status ≥ 400, else 0 |
| `global_risk_score` | REAL | Score assigned by the Isolation Forest |
| `user_id` | TEXT | Username (parsed from body or URL path) |
| `user_agent` | TEXT | Browser/device fingerprint |

> ⚠️ **No passwords, keys, or secrets are ever stored here.** Only request metadata.

#### `user_security_profiles` Schema

| Column | Type | Description |
|---|---|---|
| `user_id` | TEXT PK | Unique username |
| `avg_login_hour_sin` | REAL | Cyclical mean of login time (sin component) |
| `avg_login_hour_cos` | REAL | Cyclical mean of login time (cos component) |
| `login_hour_std_dev` | REAL | Circular standard deviation (in hours) |
| `trusted_ips` | TEXT | JSON array of the user's most-used IPs |
| `trusted_user_agents` | TEXT | JSON array of the user's most-used browsers |
| `sample_count` | INTEGER | How many data points built this baseline |
| `last_updated` | TEXT | When the baseline was last recalculated |

#### Key Functions

| Function | What It Does |
|---|---|
| `init_telemetry_db(db_name)` | Creates + migrates `security_telemetry` (adds `user_id`/`user_agent` cols if missing) |
| `init_user_profiles_db(db_name)` | Creates `user_security_profiles` table |
| `insert_telemetry_record(db_name, record)` | Inserts a `TelemetryRecord` into the telemetry table |

#### Pydantic Model: `TelemetryRecord`

A runtime data object mirroring the telemetry table. Used to pass structured data between the middleware and the database insert function. Fields have sensible defaults (e.g., timestamp auto-generates as UTC now).

---

### 2. `global_model.py` — System-Wide Anomaly Detection

**Purpose:** Detects *distributed, system-wide* attacks like brute-force storms or automated API probing using an **Isolation Forest** (unsupervised ML).

#### Class: `GlobalSecurityAgent`

| Method | When It's Called | What It Does |
|---|---|---|
| `train_model(db_name)` | Manually or via cron (offline) | Queries last 24h of telemetry, engineers per-IP features, fits an `IsolationForest`, saves `.pkl` via `joblib` |
| `evaluate_request(feature_vector)` | Every monitored request (real-time) | Loads the `.pkl`, scores the request, returns `AnomalyResult(risk_score, is_anomaly)` |

#### Feature Vector (3 dimensions)

| Feature | How It's Computed | What It Catches |
|---|---|---|
| `requests_per_minute` | Count of requests from this IP in the last 60 seconds | Rapid-fire brute-force |
| `failure_rate` | Fraction of failed attempts (4xx/5xx) | Credential stuffing (many failures) |
| `mean_processing_time_ms` | Average response time | Slow probing or unusual payload sizes |

#### How the Score Works

- **Isolation Forest** assigns a raw `decision_function` score: more negative = more anomalous.
- This is normalised to **0.0 (safe) → 1.0 (highly anomalous)**.
- If no model is trained yet (cold start), the agent returns `0.0` — the app runs normally until enough data accumulates.

#### Training the Model

```python
from security_module import GlobalSecurityAgent

agent = GlobalSecurityAgent()
result = agent.train_model("vault_v2.db")
# {'status': 'trained', 'samples_used': 42, 'model_path': '...security_model.pkl'}
```

> Requires ≥ 10 unique IP aggregates in the last 24 hours.

---

### 3. `user_baseline.py` — Per-User Drift Detection (ATO Prevention)

**Purpose:** Detects *Account Takeover* by comparing each login against the user's historical behavior. If someone logs in from a new country, at 3 AM when the user normally logs in at 9 AM, with a device never seen before — this module will flag it.

#### Class: `UserBehaviorAnalyzer`

| Method | When It's Called | What It Does |
|---|---|---|
| `update_user_baseline(user_id)` | Background task after every **successful** login | Queries last 30 days of the user's activity, computes cyclical time stats + trusted IPs/UAs, upserts into `user_security_profiles` |
| `calculate_drift_score(user_id, metadata)` | Every monitored login request (real-time) | Compares current request against stored profile, returns `DriftResult(user_risk_score, drift_reasons)` |

#### The Three Drift Signals

##### Signal 1: Login Time Drift (40% weight)

The hardest part — **hours wrap around** (23:00 → 01:00 is 2 hours, not 22).

**Solution: Cyclical encoding on a unit circle**

```
angle = 2π × hour / 24

For each historical login:
  sin_component = sin(angle)
  cos_component = cos(angle)

Circular mean = atan2(avg_sin, avg_cos)
Circular std_dev = √(-2 · ln(R))  where R = resultant vector length
```

The incoming login hour gets the same encoding, and a **circular Z-score** measures how far it is from the mean:

```
Z = angular_distance_in_hours / std_dev
```

**Edge cases handled:**
- `std_dev = 0` (user always logs in at the exact same time): any different time → max anomaly, same time → 0
- Midnight wrap: properly uses `atan2(sin_diff, cos_diff)` so 23:00 → 01:00 = 2 hours

##### Signal 2: IP Novelty (35% weight)

- Score = `0.0` if the IP is in the user's top-10 trusted IPs
- Score = `1.0` if it's a brand-new IP never seen before

##### Signal 3: User-Agent Novelty (25% weight)

- Score = `0.0` if the browser/device is in the user's top-10 trusted User-Agents
- Score = `1.0` if it's a completely new device signature

#### Composite User Risk Score

```
user_risk_score = (0.40 × time_score + 0.35 × ip_score + 0.25 × ua_score)
```

**Safety mechanisms:**
- **No profile yet** (first-time user) → returns `0.0` so new users aren't penalised
- **Immature baseline** (< 3 data points) → time weight halved to reduce false positives
- Score clamped to `[0.0, 1.0]`

#### Drift Reasons (human-readable)

The `DriftResult` includes a `drift_reasons` list with explanations:

```python
drift_reasons = [
    "Unusual login time (Z=+3.14)",
    "New IP address: 203.0.113.42",
    "New device / browser (User-Agent)"
]
```

---

### 4. `agent.py` — The Monitoring Middleware (Scrapper Agent)

**Purpose:** The central orchestrator — a pure ASGI middleware that intercepts every request to sensitive endpoints, scrapes metadata, calls both scoring engines, injects response headers, and fires async background tasks.

#### What It Monitors

| Endpoint Prefix | Monitoring | User Scoring |
|---|---|---|
| `/api/login` | ✅ | ✅ (username from JSON body) |
| `/api/register` | ✅ | ❌ |
| `/api/vault/*` | ✅ | ✅ (username from URL path) |

#### Request Processing Pipeline

```
1. REQUEST ARRIVES
   ↓
2. Extract metadata:
   • IP address (from X-Forwarded-For or direct connection)
   • User-Agent header
   • Username (from JSON body for login, URL path for vault)
   • Start timestamp
   ↓
3. FORWARD to FastAPI route handler
   ↓
4. RESPONSE ready — inside send_wrapper():
   • Calculate processing time
   • Score with GlobalSecurityAgent → global_score
   • Score with UserBehaviorAnalyzer → user_score
   • Compute hybrid = 0.5 × global + 0.5 × user
   • Inject 4 response headers
   ↓
5. BACKGROUND TASKS (non-blocking):
   • Insert telemetry record into security_telemetry
   • If successful login: update user baseline in user_security_profiles
```

#### Username Extraction Logic

- **`POST /api/login`**: The middleware reads the raw request body, parses `{"username": "..."}` from JSON, then **replays the body** to the downstream route handler so no data is lost.
- **`/api/vault/{username}/...`**: Extracted from the URL path via regex `^/api/vault/([^/]+)`.

#### Hybrid Risk Score

```
hybrid_risk_score = 0.50 × global_score + 0.50 × user_score
is_anomaly = hybrid_risk_score ≥ 0.60
```

These weights and threshold are tunable constants at the top of the file.

#### Response Headers Injected

| Header | Value | Meaning |
|---|---|---|
| `X-Risk-Score` | `0.0` – `1.0` | Global anomaly score (system-wide) |
| `X-User-Risk-Score` | `0.0` – `1.0` | Per-user behavioral drift score |
| `X-Hybrid-Risk-Score` | `0.0` – `1.0` | Weighted combination of both |
| `X-Is-Anomaly` | `True` / `False` | Whether the hybrid score exceeds threshold |

#### Why Pure ASGI (Not BaseHTTPMiddleware)?

Starlette's `BaseHTTPMiddleware` has a [known deadlock](https://github.com/encode/starlette/issues/1012) when used with synchronous route handlers. The pure ASGI approach (`__call__` with `send_wrapper`) avoids this entirely and is compatible with both `def` and `async def` endpoints.

---

### 5. `__init__.py` — Package Exports

**Purpose:** Re-exports the public API so consumers can write:

```python
from security_module import (
    SecurityMonitorMiddleware,
    init_telemetry_db,
    init_user_profiles_db,
    GlobalSecurityAgent,
    UserBehaviorAnalyzer,
)
```

Uses `sys.modules` lookups instead of relative imports because the directory name `modals & scrapper agent` contains spaces and `&`, which are not valid in Python package names. The dynamic `importlib` loader in `main.py` registers each sub-module before this file runs.

---

## 🔌 Integration with `main.py`

The module is wired into the FastAPI app in three places:

```python
# 1. Dynamic import (handles the non-standard directory name)
for _sub in ("models", "global_model", "user_baseline", "agent"):
    # ... importlib loads each sub-module ...

# 2. Middleware registration (after app creation)
app.add_middleware(SecurityMonitorMiddleware, db_name="vault_v2.db")

# 3. Database init (on startup)
@app.on_event("startup")
def on_startup():
    init_db()
    init_telemetry_db(DB_NAME)
    init_user_profiles_db(DB_NAME)
```

---

## 🧪 Use Cases

### Use Case 1: Distributed Brute-Force Detection

> An attacker uses a botnet to try thousands of passwords across many IPs.

**How it's caught:**
- `global_model.py` sees elevated `requests_per_minute` and `failure_rate` across multiple IPs → high `global_score` → `X-Is-Anomaly: True`

### Use Case 2: Account Takeover (ATO)

> An attacker obtains a user's credentials and logs in from a different country at an unusual hour.

**How it's caught:**
- `user_baseline.py` detects: new IP (score +0.35), unusual time Z-score > 2 (score +0.40), possibly new User-Agent (score +0.25) → high `user_risk_score`
- `drift_reasons`: `["Unusual login time (Z=+3.14)", "New IP address: 203.0.113.42"]`

### Use Case 3: API Probing / Reconnaissance

> An attacker systematically probes vault endpoints to enumerate users.

**How it's caught:**
- `global_model.py` flags unusual request patterns (rapid sequential vault access, high failure rates)
- `agent.py` logs every probe to `security_telemetry` for forensic analysis

### Use Case 4: Credential Stuffing

> Automated tool testing leaked username/password combos against the login endpoint.

**How it's caught:**
- High `failure_rate` from specific IPs → `global_score` spikes
- Each failed attempt is logged with `is_failed_attempt = 1` for trend analysis

---

## 📊 Monitoring & Forensics

All telemetry is queryable with standard SQL:

```sql
-- Top 10 most active IPs in the last hour
SELECT ip_address, COUNT(*) AS hits
FROM security_telemetry
WHERE timestamp >= datetime('now', '-1 hour')
GROUP BY ip_address
ORDER BY hits DESC
LIMIT 10;

-- Users with the highest risk scores
SELECT user_id, AVG(global_risk_score) AS avg_risk
FROM security_telemetry
WHERE user_id IS NOT NULL
GROUP BY user_id
ORDER BY avg_risk DESC;

-- Recent anomalies
SELECT * FROM security_telemetry
WHERE global_risk_score > 0.5
ORDER BY timestamp DESC
LIMIT 20;
```

---

## ⚙️ Configuration (Tunable Constants)

| Constant | File | Default | Description |
|---|---|---|---|
| `GLOBAL_WEIGHT` | `agent.py` | `0.50` | Weight of global score in hybrid |
| `USER_WEIGHT` | `agent.py` | `0.50` | Weight of user score in hybrid |
| `ANOMALY_THRESHOLD` | `agent.py` | `0.60` | Hybrid score above this = anomaly |
| `WEIGHT_TIME` | `user_baseline.py` | `0.40` | Time drift weight in user score |
| `WEIGHT_IP` | `user_baseline.py` | `0.35` | IP novelty weight |
| `WEIGHT_UA` | `user_baseline.py` | `0.25` | User-Agent novelty weight |
| `Z_SCORE_THRESHOLD` | `user_baseline.py` | `2.0` | Z-score above this = "unusual time" |
| `BASELINE_WINDOW_DAYS` | `user_baseline.py` | `30` | Days of history for baseline |
| `TRAINING_WINDOW_HOURS` | `global_model.py` | `24` | Hours of data for Isolation Forest |
| `MIN_TRAINING_SAMPLES` | `global_model.py` | `10` | Minimum IPs needed to train |
