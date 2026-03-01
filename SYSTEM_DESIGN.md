# 🏗️ QuantumVault — System Design

> A comprehensive system design document covering the full architecture
> of QuantumVault's post-quantum credential vault and AI behavioral security layer.

---

## Table of Contents

- [High-Level Overview](#high-level-overview)
- [Component Architecture](#component-architecture)
- [Data Flow](#data-flow)
- [Cryptographic Layer](#cryptographic-layer)
- [Behavioral Security Layer](#behavioral-security-layer)
- [Database Design](#database-design)
- [API Design](#api-design)
- [Frontend Architecture](#frontend-architecture)
- [Deployment Architecture](#deployment-architecture)
- [Security Considerations](#security-considerations)

---

## High-Level Overview

QuantumVault is a **three-layer** system:

```
┌─────────────────────────────────────────────────────────────────┐
│                        PRESENTATION LAYER                       │
│   React 19 + Vite 7 — SPA with Auth, Dashboard, Security UI    │
└──────────────────────────────┬──────────────────────────────────┘
                               │ HTTP / REST
┌──────────────────────────────▼──────────────────────────────────┐
│                        APPLICATION LAYER                         │
│   FastAPI + ASGI Security Middleware                             │
│   ┌───────────────┐  ┌──────────────┐  ┌────────────────────┐  │
│   │  Vault Router  │  │ Auth Router  │  │ Security Dashboard │  │
│   │  CRUD Ops      │  │ Login/Regist │  │  API (/api/sec/*)  │  │
│   └───────┬───────┘  └──────┬───────┘  └────────┬───────────┘  │
│           │                 │                    │               │
│   ┌───────▼─────────────────▼────────────────────▼───────────┐  │
│   │          Security Monitor Middleware (ASGI)               │  │
│   │  ┌──────────────────┐  ┌──────────────────────────────┐  │  │
│   │  │ Global Agent      │  │ Per-User Baseline Engine     │  │  │
│   │  │ (Isolation Forest) │  │ (Circular Z-Score Drift)     │  │  │
│   │  └──────────────────┘  └──────────────────────────────┘  │  │
│   └──────────────────────────────────────────────────────────┘  │
└──────────────────────────────┬──────────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────────┐
│                         DATA LAYER                               │
│   SQLite (vault_v2.db)                                           │
│   ┌────────────┐  ┌─────────────────────┐  ┌────────────────┐  │
│   │   users     │  │ security_telemetry  │  │ user_security  │  │
│   │   vault     │  │ (append-only log)   │  │ _profiles      │  │
│   └────────────┘  └─────────────────────┘  └────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Component Architecture

### 1. Frontend (React SPA)

| Component | Purpose |
|---|---|
| `LandingPage` | Marketing / introduction page |
| `AuthPage` | Login + Registration with client-side Kyber key generation |
| `DashboardPage` | Vault CRUD — store, retrieve, delete encrypted credentials |
| `SecurityInsightsPage` | Security Command Center — real-time monitoring dashboard |
| `AppContext` | Global state (current user, auth status, crypto keys) |

**Key Design Decisions:**
- Client-side encryption — the server **never** sees plaintext credentials
- All crypto runs in the browser via `vault_Core.js` (Kyber key encapsulation + AES-GCM)
- Inline CSS styling (no CSS framework dependency)
- Framer Motion for micro-animations
- Recharts for data visualization

### 2. Backend (FastAPI)

| Module | File | Responsibility |
|---|---|---|
| **App Core** | `main.py` | Route registration, middleware setup, DB init |
| **Crypto Engine** | `vault_Core.py` | ML-KEM (Kyber-768), AES-256-GCM, Shamir's SS |
| **Security Middleware** | `agent.py` | ASGI request interception, metadata scraping, scoring |
| **Global Agent** | `global_model.py` | System-wide anomaly detection (Isolation Forest) |
| **User Baseline** | `user_baseline.py` | Per-user behavioral drift detection |
| **DB Schemas** | `models.py` | Table definitions, migrations, Pydantic models |
| **Training** | `train_model.py` | Standalone CLI for model training |
| **Data Generator** | `flood_telemetry.py` | Synthetic telemetry for training bootstrapping |

### 3. Security Middleware Pipeline

The middleware operates as a transparent ASGI layer:

```
                    ┌─ Not monitored ──────────────── PASS THROUGH
                    │
  Request ─────────►├─ /api/login ─────────────────── MONITOR + USER SCORE
                    │
                    ├─ /api/register ───────────────── MONITOR ONLY
                    │
                    └─ /api/vault/* ────────────────── MONITOR + USER SCORE

  For monitored requests:
  ┌────────────── SCORING PHASE (synchronous, in response pipeline) ─────┐
  │  1. Extract: IP, User-Agent, Username, Start Time                     │
  │  2. Forward to FastAPI route handler                                  │
  │  3. On response: compute processing_time_ms                          │
  │  4. Score: GlobalSecurityAgent.evaluate_request(features)             │
  │  5. Score: UserBehaviorAnalyzer.calculate_drift_score(user, metadata) │
  │  6. Compute: hybrid = 0.5 × global + 0.5 × user                     │
  │  7. Inject: X-Risk-Score, X-User-Risk-Score, X-Hybrid-Risk-Score     │
  └──────────────────────────────────────────────────────────────────────┘

  ┌────────────── LOGGING PHASE (async, after response sent) ────────────┐
  │  8. Background: INSERT telemetry record                               │
  │  9. Background: UPDATE user baseline (if successful login)            │
  └──────────────────────────────────────────────────────────────────────┘
```

---

## Data Flow

### Credential Storage Flow

```
  Browser                        Server                        Database
  ═══════                        ══════                        ════════

  1. User types credential
     ↓
  2. Generate Kyber keypair
     (kem_keygen → pk, sk)
     ↓
  3. Encrypt with AES-256-GCM
     (key derived from Kyber)
     ↓
  4. POST /api/vault/{user}/add ──────►  5. Receive ciphertext  ──────► 6. Store in vault table
     { ciphertext, content }             (server sees ONLY              (blob, never decrypted
                                          encrypted bytes)               on server)
```

### Security Monitoring Flow

```
  Request ──► Middleware ──► Extract metadata ──► Score (Global + User)
     │                                                    │
     │                                           Inject headers (X-Risk-Score, etc.)
     │                                                    │
     ▼                                                    ▼
  Response sent ──────────────────────► Background tasks:
                                         • INSERT → security_telemetry
                                         • UPDATE → user_security_profiles
```

### Model Training Flow

```
  1. flood_telemetry.py          2. train_model.py           3. Live Server
  ═══════════════════            ═════════════════           ═══════════════

  Generate 300 records           Read security_telemetry     Load security_model.pkl
  (70% normal, 30% anomaly)     Aggregate per-IP features   Score every new request
       │                         Fit IsolationForest              │
       ▼                              │                           ▼
  INSERT → security_telemetry    SAVE → security_model.pkl   Return AnomalyResult
                                                             (risk_score, is_anomaly)
```

---

## Database Design

### Entity-Relationship Diagram

```
  ┌─────────────┐         ┌──────────────────┐         ┌──────────────────────┐
  │    users     │    1:N  │      vault       │         │  security_telemetry  │
  ├─────────────┤◄────────┤──────────────────┤         ├──────────────────────┤
  │ username PK  │         │ id PK            │         │ id PK (AUTO)         │
  │ salt         │         │ username FK      │         │ timestamp            │
  │ enc_sk       │         │ site             │         │ ip_address           │
  │ pk           │         │ ciphertext       │         │ endpoint_path        │
  └─────────────┘         │ content          │         │ method               │
                          │ category         │         │ processing_time_ms   │
                          └──────────────────┘         │ is_failed_attempt    │
                                                       │ global_risk_score    │
  ┌──────────────────────────┐                          │ user_id              │
  │ user_security_profiles   │                          │ user_agent           │
  ├──────────────────────────┤                          └──────────────────────┘
  │ user_id PK               │
  │ avg_login_hour_sin       │
  │ avg_login_hour_cos       │
  │ login_hour_std_dev       │
  │ trusted_ips (JSON)       │
  │ trusted_user_agents (JSON)│
  │ sample_count             │
  │ last_updated             │
  └──────────────────────────┘
```

### Design Decisions

| Decision | Rationale |
|---|---|
| **SQLite** | Zero-config, single-file database, sufficient for single-server deployment |
| **Append-only telemetry** | No updates/deletes — preserves audit trail integrity |
| **JSON in text columns** | Trusted IPs/UAs are small arrays, JSON-in-text avoids junction tables |
| **No FK from telemetry→users** | Telemetry can track unknown/failed user attempts |
| **Cyclical stats (sin/cos)** | Handles midnight wrap-around for login time analysis |

---

## API Design

### Core Vault Endpoints

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/api/register` | None | Create user with Kyber key material |
| `POST` | `/api/login` | None | Retrieve encrypted key material |
| `GET` | `/api/vault/{user}` | User | List all stored credentials |
| `POST` | `/api/vault/{user}/add` | User | Store encrypted credential |
| `DELETE` | `/api/vault/{user}/delete/{id}` | User | Remove credential |

### Security Dashboard Endpoints

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/api/security/dashboard` | None | 24h traffic, anomaly stats, recent events |
| `GET` | `/api/security/users` | None | All user security profiles |
| `GET` | `/api/security/user/{id}` | None | Single user profile + events |

### Response Headers (injected by middleware)

| Header | Range | Description |
|---|---|---|
| `X-Risk-Score` | 0.0–1.0 | Global Isolation Forest score |
| `X-User-Risk-Score` | 0.0–1.0 | Per-user drift score |
| `X-Hybrid-Risk-Score` | 0.0–1.0 | Weighted combo (0.5g + 0.5u) |
| `X-Is-Anomaly` | True/False | Whether hybrid ≥ 0.60 |

---

## Frontend Architecture

### Page Routing

```
  /             → LandingPage (public)
  /auth         → AuthPage (guest-only)
  /dashboard    → DashboardPage (protected, vault CRUD)
  /security     → SecurityInsightsPage (protected, monitoring)
```

### Security Command Center Layout

```
  ┌──────────────────────────────────────────────────────────┐
  │                   System Health Bar                       │
  │  PQC:Active | Global:Online | Baseline:Online | LIVE     │
  ├──────────────────────────────────────────────────────────┤
  │ SECTION 1: Global System Overview                        │
  │ ┌──────────────────┐  ┌────────────────────────────────┐ │
  │ │  Risk Gauge       │  │  24h Traffic Area Chart        │ │
  │ │  (radial SVG)     │  │  (requests + anomaly markers)  │ │
  │ ├──────────────────┤  │                                │ │
  │ │ Metric Chips      │  │                                │ │
  │ ├──────────────────┤  └────────────────────────────────┘ │
  │ │Active Mitigations│                                     │
  │ └──────────────────┘                                     │
  ├──────────────────────────────────────────────────────────┤
  │ SECTION 2: User Behavioral Analysis                      │
  │ ┌───────────────┐  ┌──────────────┐  ┌─────────────┐   │
  │ │ Trust Score    │  │ Event        │  │ Risk        │   │
  │ │ Baseline      │  │ Timeline     │  │ Breakdown   │   │
  │ │ Profile       │  │ (per-user)   │  │ Session     │   │
  │ │               │  │              │  │ Intel       │   │
  │ └───────────────┘  └──────────────┘  └─────────────┘   │
  └──────────────────────────────────────────────────────────┘
```

### Data Flow (Frontend ↔ Backend)

| Source | Endpoint | Refresh |
|---|---|---|
| System Health Bar | `/api/security/dashboard` | 30s auto-poll |
| Risk Gauge | Avg `global_risk_score` from events | 30s |
| Traffic Chart | 24h hourly aggregation | 30s |
| User Profiles | `/api/security/users` | 30s |
| User Detail | `/api/security/user/{id}` | On selection + 30s |

### Mock Mode Toggle

A toggle button switches between **LIVE DATA** (default) and **MOCK DATA**. Mock mode uses hardcoded sample data for demo/offline use. On API failure, the dashboard gracefully falls back to mock data with a warning banner.

---

## Deployment Architecture

### Development

```
  Terminal 1: Backend
  cd backend
  python -m uvicorn main:app --reload --port 8000

  Terminal 2: Frontend
  cd frontend
  npm run dev        ← Vite dev server (port 5173, proxies /api → 8000)
```

### Production

```
  1. Build frontend:    cd frontend && npm run build
  2. FastAPI serves React dist at /
  3. Run:               uvicorn main:app --host 0.0.0.0 --port 8000
```

---

## Security Considerations

### What IS Protected

| Aspect | Mechanism |
|---|---|
| Credential encryption | ML-KEM (Kyber-768) + AES-256-GCM (client-side) |
| Key storage | Encrypted secret key stored on server, plaintext never transmitted |
| Anomaly detection | Real-time hybrid scoring on every sensitive request |
| Audit trail | Append-only telemetry log of all security events |

### What is NOT in Scope (Yet)

| Aspect | Status |
|---|---|
| Password hashing | Not implemented — login is key-based |
| Rate limiting | Headers injected but not enforced (enforcement layer TODO) |
| JWT/Session tokens | Not implemented — stateless username-based auth |
| Geo-fencing | Flagged as "INACTIVE" in dashboard — placeholder |
| HTTPS | Expected to be handled by reverse proxy (nginx, Cloudflare) |

### Data Isolation Guarantees

- **security_telemetry** — stores only request metadata (IP, path, timing, User-Agent). **Never** stores passwords, keys, request bodies, or response bodies.
- **user_security_profiles** — stores only behavioral statistics (login time patterns, IP/UA frequency). No PII beyond username.
- **vault** — stores only ciphertext blobs. Server has no decryption keys.
