# 🧠 QuantumVault — ML Models Documentation

> Deep-dive into the machine learning models used in QuantumVault's
> behavioral security layer: how they work, why they were chosen,
> their mathematical foundations, and how they're implemented.

---

## Table of Contents

- [What is Random Forest?](#what-is-random-forest)
- [What is Z-Score?](#what-is-z-score)
- [Model Overview](#model-overview)
- [Model 1: Isolation Forest (Global Anomaly Detection)](#model-1-isolation-forest-global-anomaly-detection)
- [Model 2: Circular Z-Score Drift (Per-User Baseline)](#model-2-circular-z-score-drift-per-user-baseline)
- [Hybrid Risk Scoring](#hybrid-risk-scoring)
- [Training Pipeline](#training-pipeline)
- [Synthetic Data Generator](#synthetic-data-generator)
- [Evaluation & Metrics](#evaluation--metrics)
- [Limitations & Future Work](#limitations--future-work)

---

## What is Random Forest?

**Random Forest** is one of the most popular **supervised machine learning** algorithms. Understanding it helps explain why we chose its cousin — **Isolation Forest** — instead.

### Core Concept: Ensemble of Decision Trees

A Random Forest is built from many **decision trees**, each trained on a random subset of the data. The final prediction is made by **majority vote** (classification) or **averaging** (regression).

```
  Training Data (with labels: "normal" or "attack")
       │
       ├──► Tree 1 (random subset) ──► Predicts: normal
       ├──► Tree 2 (random subset) ──► Predicts: attack
       ├──► Tree 3 (random subset) ──► Predicts: normal
       ├──► Tree 4 (random subset) ──► Predicts: normal
       └──► Tree 5 (random subset) ──► Predicts: attack
                                            │
                                       Majority Vote
                                            │
                                    Final: "normal" (3 vs 2)
```

### How a Single Decision Tree Works

Each decision tree splits data based on feature thresholds:

```
                    ┌──────────────────────┐
                    │ requests_per_min > 50?│
                    └──────────┬───────────┘
                         Yes / \ No
                            /   \
               ┌────────────┐   ┌────────────┐
               │failure_rate │   │   NORMAL    │
               │   > 0.8?   │   │  (leaf)     │
               └──────┬─────┘   └─────────────┘
                 Yes / \ No
                    /   \
            ┌──────┐   ┌──────┐
            │ATTACK│   │NORMAL│
            │(leaf)│   │(leaf)│
            └──────┘   └──────┘
```

### Key Properties

| Property | Description |
|---|---|
| **Supervised** | Requires **labeled training data** (each sample must be tagged as "normal" or "attack") |
| **Classification** | Predicts discrete categories (normal vs attack) |
| **Ensemble** | Combines 100–500 trees for robustness |
| **Feature importance** | Can tell you which features matter most |
| **Overfitting resistance** | Random subsets + majority vote reduce overfitting |

### Why We Didn't Use Random Forest

| Requirement | Random Forest | Our Situation |
|---|---|---|
| Labeled data needed? | ✅ Yes — every training sample must be labeled | ❌ We don't have labeled attack data |
| Works with unknown attacks? | ❌ Only detects patterns it was trained on | ✅ We need to detect novel attacks |
| Cold start behavior? | ❌ Cannot train without labels | ✅ Need to work with organic data |

**Bottom line:** Random Forest is excellent when you have thousands of labeled examples (e.g., spam filtering, image classification). For **anomaly detection** where attacks are rare and unknown, **Isolation Forest** (unsupervised) is the right choice.

### Random Forest vs Isolation Forest — Side by Side

| Aspect | Random Forest | Isolation Forest |
|---|---|---|
| **Type** | Supervised classification | Unsupervised anomaly detection |
| **Training data** | Needs labels (normal/attack) | No labels needed |
| **Question answered** | "Is this normal or attack?" | "Is this different from everything else?" |
| **Tree purpose** | Each tree classifies → majority vote | Each tree **isolates** → shorter path = anomaly |
| **Output** | Class label + probability | Anomaly score (0.0–1.0) |
| **Scikit-learn class** | `RandomForestClassifier` | `IsolationForest` |
| **Best for** | Known categories | Unknown/emerging threats |

---

## What is Z-Score?

**Z-Score** (also called **standard score**) is a statistical measure that tells you **how far a data point is from the average**, measured in units of standard deviation. It's fundamental to our per-user drift detection.

### The Formula

```
         value - mean
Z  =  ─────────────────
       standard_deviation

Where:
  value              = the data point you're testing
  mean (μ)           = the average of all historical data
  standard_deviation (σ) = how spread out the data is
```

### Intuitive Explanation

Imagine a user who always logs in between **9 AM and 11 AM** (mean = 10 AM, std dev = 1 hour):

```
  Z-Score    Meaning                    Example
  ══════════════════════════════════════════════════════════
    0.0      Exactly at the mean        Login at 10:00 AM
   +1.0      1 std dev above mean       Login at 11:00 AM
   -1.0      1 std dev below mean       Login at  9:00 AM
   +2.0      2 std devs above mean      Login at 12:00 PM ← unusual
   +3.0      3 std devs above mean      Login at  1:00 PM ← very unusual
   +6.0      6 std devs above mean      Login at  4:00 AM ← highly anomalous
```

### The 68-95-99.7 Rule (Normal Distribution)

For normally distributed data:

```
        ┌────────────────────────────────────────────┐
        │                  99.7%                      │
        │            ┌──────────────────┐             │
        │            │     95%          │             │
        │        ┌───┤─────────────┤───┐│             │
        │        │   │    68%      │   ││             │
        │     ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓        │
   ─────┼──▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓────│
        │        │   │             │   ││             │
      -3σ     -2σ  -1σ     μ     +1σ +2σ           +3σ
```

| Z-Score Range | % of Data in Range | Interpretation |
|---|---|---|
| -1 to +1 | 68.3% | Very common — normal behavior |
| -2 to +2 | 95.4% | Expected — within normal range |
| -3 to +3 | 99.7% | Almost all data falls here |
| Beyond ±3 | 0.3% | **Extremely rare — likely anomalous** |

### Z-Score in QuantumVault

We use Z-Scores to detect **login time drift**:

```python
# Example: User typically logs in at 10 AM (std dev = 1.5 hours)

# Login at 10:30 AM → Z = 0.33 → NORMAL ✅
# Login at  1:00 PM → Z = 2.00 → UNUSUAL ⚠️
# Login at  3:00 AM → Z = 4.67 → ANOMALOUS 🚨
```

### Why "Circular" Z-Score?

Standard Z-Scores don't work for time because **hours wrap around**:

```
  Standard math:  23:00 → 01:00 = |1 - 23| = 22 hours apart  ❌ WRONG
  Circular math:  23:00 → 01:00 = 2 hours apart               ✅ CORRECT
```

That's why we encode hours on a **unit circle** (using sin/cos) before computing Z-Scores. See the [Circular Z-Score section](#signal-1-login-time-drift-40-weight) for the full implementation.

### Z-Score vs Other Methods

| Method | Pros | Cons |
|---|---|---|
| **Z-Score (chosen)** | Simple, interpretable, works with small data | Assumes roughly normal distribution |
| Percentile rank | No distribution assumption | Less intuitive, harder to set thresholds |
| MAD (Median Absolute Deviation) | Robust to outliers | More complex, less common |
| ML classifier | Learns complex patterns | Needs lots of data per user |

---

## Model Overview

QuantumVault uses **two complementary models** that score every sensitive API request:

| Model | Type | Scope | Library | File |
|---|---|---|---|---|
| **Isolation Forest** | Unsupervised ML | System-wide (all users, all IPs) | scikit-learn | `global_model.py` |
| **Circular Z-Score** | Statistical baseline | Per-user behavioral drift | NumPy (pure math) | `user_baseline.py` |

Their scores are combined into a **hybrid risk score**:

```
hybrid_risk_score = 0.5 × isolation_forest_score + 0.5 × user_drift_score
```

---

## Model 1: Isolation Forest (Global Anomaly Detection)

### What is Isolation Forest?

Isolation Forest is an **unsupervised anomaly detection algorithm** introduced by Liu et al. (2008). Unlike most outlier detection methods that try to profile "normal" data, Isolation Forest exploits the key property that **anomalies are few and different** — they are easier to isolate.

### Why Isolation Forest? (Not Random Forest)

| Algorithm | Type | Requires Labels? | Best For |
|---|---|---|---|
| **Random Forest** | Supervised classification | ✅ Yes (labeled data) | Classification with known categories |
| **Isolation Forest** | Unsupervised anomaly detection | ❌ No | Detecting unknown attack patterns |

We chose **Isolation Forest** because:
1. **No labeled data needed** — we don't know what attacks look like in advance
2. **Works with very few anomalies** — designed for the case where anomalies are rare (< 10%)
3. **Fast training and scoring** — O(n log n) training, O(log n) scoring
4. **Low memory** — stores only tree structure, not data points

### How It Works

#### Core Idea: Random Partitioning

The algorithm builds an ensemble of **isolation trees** (iTrees). Each tree randomly partitions the feature space by selecting a random feature and a random split value:

```
                        ┌─────────────────────┐
                        │  Select random       │
                        │  feature + split     │
                        │  value               │
                        └──────────┬──────────┘
                                   │
                    ┌──────────────┼──────────────┐
                    │ Left (≤ split)              │ Right (> split)
                    │                             │
              ┌─────▼─────┐                 ┌─────▼─────┐
              │ Split again │                │ Split again│
              └─────┬─────┘                 └─────┬─────┘
                    │                              │
              ... continues until isolation or max depth ...
```

**Key insight:** Anomalous points require **fewer splits** to be isolated (they live in sparse regions), while normal points require **many splits** (they live in dense clusters).

```
  Anomaly:  isolated at depth 2  ←──── SHORT path = high anomaly score
  Normal:   isolated at depth 8  ←──── LONG path = low anomaly score
```

#### Anomaly Score Calculation

For each data point, the average path length `h(x)` across all trees is computed:

```
Score(x) = 2^(-E(h(x)) / c(n))

Where:
  E(h(x)) = average path length of x across all trees
  c(n)    = normalization factor = 2H(n-1) - 2(n-1)/n
  H(i)    = harmonic number ≈ ln(i) + 0.5772

Score interpretation:
  Score → 1.0   anomaly (short path = easy to isolate)
  Score → 0.5   normal (average path)
  Score → 0.0   extremely normal (very dense region)
```

### Our Implementation

#### Feature Engineering (3 dimensions)

For each unique IP address in the training window (last 24 hours), we compute:

| Feature | Formula | What It Catches |
|---|---|---|
| `requests_per_minute` | total_requests / time_span_minutes | Brute-force rate |
| `failure_rate` | failed_attempts / total_requests | Credential stuffing success rate |
| `mean_processing_ms` | AVG(processing_time_ms) | Slow probing / unusual payloads |

```python
# Feature extraction query (simplified)
SELECT
    ip_address,
    COUNT(*)                   AS total_requests,
    SUM(is_failed_attempt)     AS total_failures,
    AVG(processing_time_ms)    AS avg_proc_time,
    MIN(timestamp)             AS first_ts,
    MAX(timestamp)             AS last_ts
FROM security_telemetry
WHERE timestamp >= (now - 24h)
GROUP BY ip_address
```

#### Why Per-IP Aggregation?

Instead of scoring individual requests, we aggregate by IP address:

| Approach | Pros | Cons |
|---|---|---|
| Per-request | High granularity | Too noisy, single requests lack context |
| **Per-IP (chosen)** | Captures patterns (rate, failure ratio) | Loses per-request timing detail |
| Per-session | Natural grouping | No session concept in stateless REST |

#### Model Configuration

```python
IsolationForest(
    n_estimators=100,      # Number of isolation trees
    contamination=0.1,     # Expected anomaly fraction (10%)
    random_state=42,       # Reproducibility
    n_jobs=-1,             # Parallel training (all CPU cores)
)
```

| Parameter | Value | Rationale |
|---|---|---|
| `n_estimators` | 100 | Standard default, good balance of accuracy vs speed |
| `contamination` | 0.1 | Matches our 70/30 normal/anomaly split after aggregation (~10% anomalous IPs) |
| `random_state` | 42 | Deterministic results for debugging |

#### Score Normalization

scikit-learn's `decision_function` returns raw scores where:
- More negative = more anomalous
- More positive = more normal
- Typical range: [-0.5, +0.5]

We normalize to [0.0, 1.0]:

```python
risk_score = max(0.0, min(1.0, 0.5 - raw_score))

# Examples:
# raw_score = +0.4 (very normal)  → risk = 0.1
# raw_score =  0.0 (borderline)   → risk = 0.5
# raw_score = -0.3 (anomalous)    → risk = 0.8
```

#### Cold Start Handling

Before the model is trained (no `.pkl` file exists):

```python
if not os.path.isfile(self.model_path):
    return AnomalyResult(risk_score=0.0, is_anomaly=False)
```

The system runs normally with zero risk scores until you train the model.

#### Model Persistence

```python
import joblib

# Save after training
joblib.dump(model, "security_model.pkl")

# Load for scoring (lazy-loaded, cached after first call)
model = joblib.load("security_model.pkl")
```

---

## Model 2: Circular Z-Score Drift (Per-User Baseline)

### What Problem Does It Solve?

Account Takeover (ATO) detection. If someone steals a user's credentials and logs in from a different location, at an unusual time, with a different device — the system should flag it even if the global model sees nothing unusual.

### Why Not Another ML Model?

| Approach | Pros | Cons |
|---|---|---|
| Another ML model | Learns complex patterns | Needs lots of data per user (cold start per user) |
| Rule-based (if/else) | Simple, fast | Rigid, can't adapt to individual patterns |
| **Statistical baseline (chosen)** | Adapts per-user, works with few samples | Less expressive than ML |

Statistical baselines work well here because:
1. **Small data per user** — most users have < 50 logins, not enough for ML
2. **Interpretable** — can explain "why" a login is flagged
3. **Fast** — no model loading, just arithmetic

### The Three Drift Signals

#### Signal 1: Login Time Drift (40% weight)

**The Problem:** Hours wrap around. 23:00 → 01:00 is **2 hours apart**, not 22.

**The Solution: Circular Statistics on a Unit Circle**

Each login hour is encoded as a point on a unit circle:

```
  For hour h (0–23):
    angle = 2π × h / 24

    sin_component = sin(angle)
    cos_component = cos(angle)
```

Visual representation:

```
                    12:00 (noon)
                       ●
                      /|\
                     / | \
            09:00 ●   |   ● 15:00
                  |   |   |
                  |   |   |
            06:00 ●───●───● 18:00
                      |
                      ●
                   00:00 (midnight)
```

**Circular Mean:**

```python
avg_sin = mean(sin(2π × h / 24) for each login hour h)
avg_cos = mean(cos(2π × h / 24) for each login hour h)
circular_mean_angle = atan2(avg_sin, avg_cos)
circular_mean_hour = (circular_mean_angle × 24) / (2π)
```

**Circular Standard Deviation:**

```python
R = sqrt(avg_sin² + avg_cos²)     # Resultant vector length (0 to 1)
circular_std_dev = sqrt(-2 × ln(R))  # In radians
std_dev_hours = circular_std_dev × 24 / (2π)

# R → 1.0: all logins at the same time (low variance)
# R → 0.0: logins spread uniformly around the clock (high variance)
```

**Z-Score Computation:**

```python
current_angle = 2π × current_hour / 24
angular_distance = atan2(sin(current - mean), cos(current - mean))
distance_hours = abs(angular_distance × 24 / (2π))
z_score = distance_hours / std_dev_hours
```

**Edge Cases:**
- `std_dev = 0` (user always logs in at the exact same time):
  - Same time → score 0.0
  - Any other time → score 1.0 (maximum anomaly)
- Midnight wrap: `atan2(sin_diff, cos_diff)` handles this automatically

#### Signal 2: IP Novelty (35% weight)

Simple set membership check:

```python
trusted_ips = ["192.168.1.42", "10.0.0.5", ...]  # Top-10 most used

if current_ip in trusted_ips:
    ip_score = 0.0   # Known IP → safe
else:
    ip_score = 1.0   # New IP → suspicious
```

#### Signal 3: User-Agent Novelty (25% weight)

Same approach as IP:

```python
trusted_user_agents = ["Chrome/Win11", "Safari/iPhone15", ...]

if current_ua in trusted_user_agents:
    ua_score = 0.0
else:
    ua_score = 1.0
```

### Composite User Risk Score

```python
user_risk_score = (0.40 × time_score) + (0.35 × ip_score) + (0.25 × ua_score)
```

### Safety Mechanisms

| Condition | Behavior | Rationale |
|---|---|---|
| No profile exists (new user) | Return 0.0 | Don't penalize first-time users |
| Immature baseline (< 3 samples) | Time weight halved (0.20) | Too few samples = unreliable time stats |
| Score > 1.0 | Clamped to 1.0 | Prevent unbounded scores |

### Baseline Update Trigger

User baselines are recalculated:
- **When:** After every **successful** login (HTTP 200 on `/api/login`)
- **How:** Background async task (doesn't block the response)
- **Window:** Last 30 days of the user's telemetry
- **Storage:** Upserted into `user_security_profiles` table

---

## Hybrid Risk Scoring

The two models are combined into a single score:

```
                    ┌──────────────────┐
                    │  Isolation Forest │──── global_score (0.0–1.0)
                    └────────┬─────────┘
                             │
  hybrid = 0.5 × global  ───┼─── + 0.5 × user
                             │
                    ┌────────┴─────────┐
                    │  User Baseline    │──── user_score (0.0–1.0)
                    └──────────────────┘

  is_anomaly = (hybrid >= 0.60)
```

### Why 50/50?

| Scenario | Global Score | User Score | Hybrid | Flagged? |
|---|---|---|---|---|
| Normal request from known user | 0.05 | 0.00 | 0.025 | ❌ No |
| Known user, new IP at 3 AM | 0.10 | 0.80 | 0.45 | ❌ No |
| Brute-force from botnet + new IP | 0.70 | 0.85 | 0.775 | ✅ Yes |
| Distributed attack, known user | 0.80 | 0.10 | 0.45 | ❌ No |

The 50/50 split ensures that **neither model alone can trigger a flag** — both must agree that something is wrong, reducing false positives. The weights are configurable in `agent.py`.

---

## Training Pipeline

### Step-by-Step

```
  ┌─────────────────────────────────────────────────────────────┐
  │  Step 1: Data Collection (Automatic)                        │
  │  Middleware logs every monitored request to                  │
  │  security_telemetry table                                    │
  └──────────────────────────┬──────────────────────────────────┘
                             │
  ┌──────────────────────────▼──────────────────────────────────┐
  │  Step 2: Feature Engineering (train_model.py)               │
  │  Query: GROUP BY ip_address over last 24h                    │
  │  Compute: requests_per_minute, failure_rate, avg_proc_time   │
  └──────────────────────────┬──────────────────────────────────┘
                             │
  ┌──────────────────────────▼──────────────────────────────────┐
  │  Step 3: Model Fitting                                      │
  │  IsolationForest(n_estimators=100, contamination=0.1)        │
  │  X = numpy array of feature vectors                          │
  │  model.fit(X)                                                │
  └──────────────────────────┬──────────────────────────────────┘
                             │
  ┌──────────────────────────▼──────────────────────────────────┐
  │  Step 4: Serialization                                      │
  │  joblib.dump(model, "security_model.pkl")                    │
  │  ~277 KB file                                                │
  └──────────────────────────┬──────────────────────────────────┘
                             │
  ┌──────────────────────────▼──────────────────────────────────┐
  │  Step 5: Deployment                                         │
  │  Model loaded on next request (lazy-loaded, cached)          │
  │  No server restart needed if using --reload                  │
  └─────────────────────────────────────────────────────────────┘
```

### Commands

```bash
# Generate training data (if no real data available)
python "modals & scrapper agent/flood_telemetry.py" --count 300

# Train the model
python "modals & scrapper agent/train_model.py"

# Verify (check recent scores)
# GET http://localhost:8000/api/security/dashboard → events[].global_risk_score > 0
```

### Minimum Requirements

| Requirement | Value | Reason |
|---|---|---|
| Minimum IP aggregates | 10 | Too few = overfitting |
| Training window | 24 hours | Captures daily patterns |
| Recommended synthetic data | 300+ records | Gives ~21 unique IP aggregates |

---

## Synthetic Data Generator

The `flood_telemetry.py` script creates realistic training data:

### Distribution: 70% Normal / 30% Anomalous

#### Normal Traffic (70%)

| Attribute | Distribution | Values |
|---|---|---|
| Login time | Gaussian(mean=14:00, std=3h) | 6 AM – 10 PM |
| IP addresses | 12 internal/trusted IPs | 192.168.x, 10.x, 172.16.x |
| User-Agents | 5 real browser signatures | Chrome, Safari, Firefox, Edge, Mobile |
| Failure rate | 5% per request | Occasional typos |
| Processing time | Gaussian(mean=45ms, std=15ms) | Normal API latency |
| Risk score (pre-assigned) | Uniform(0.0, 0.15) | Low risk |

#### Anomalous Traffic (30%) — Four Attack Types

| Attack Type | Login Time | IPs | User-Agent | Failure Rate |
|---|---|---|---|---|
| 🔨 Brute-force | 1–5 AM | External/suspicious | curl, python-requests | 100% |
| 🔍 Scanning | 1–5 AM | External/suspicious | sqlmap, Nikto | 85% |
| 🕐 Unusual time | 1–5 AM | External | Legitimate browsers | 0% (stolen creds) |
| 🎯 Credential stuffing | 1–5 AM | External | Automated tools | 100% |

### What the Model Learns

After training on this data, the Isolation Forest learns that:

1. **Normal pattern:** Low request rate, low failure rate, ~45ms processing, from internal IPs
2. **Anomalous pattern:** High request rate, high failure rate, ~12ms processing, from external IPs

The model can then generalize to detect **new** attack patterns it hasn't seen — this is the strength of unsupervised learning.

---

## Evaluation & Metrics

### How to Evaluate Model Performance

Since this is unsupervised learning, traditional accuracy/precision/recall don't directly apply. Instead:

| Metric | How to Measure |
|---|---|
| **True Positive Rate** | Run flood with anomaly-only data, check if scores > 0.5 |
| **False Positive Rate** | Login normally, check if scores stay < 0.2 |
| **Score Separation** | Compare avg score for normal vs anomaly records |
| **Latency Impact** | Measure middleware overhead (should be < 5ms) |

### Expected Score Distributions

```
  Normal traffic:    risk_score ∈ [0.02, 0.20]  — clustered low
  Anomalous traffic: risk_score ∈ [0.45, 0.95]  — scattered high
  
  Clear separation = good model.
  Overlapping ranges = needs more training data or feature engineering.
```

---

## Limitations & Future Work

### Current Limitations

| Limitation | Impact | Potential Fix |
|---|---|---|
| Single-machine SQLite | No horizontal scaling | Migrate to PostgreSQL |
| Batch training (manual) | Model staleness | Scheduled retraining (cron) |
| No IP geolocation | Can't detect country changes | Add GeoIP database |
| Fixed 50/50 weights | Sub-optimal for some scenarios | Learn weights from feedback |
| No rate limiting enforcement | Headers only, no blocking | Add enforcement middleware |

### Roadmap

1. **Auto-retraining** — Retrain the Isolation Forest every N hours via background task
2. **Adaptive thresholds** — Adjust `ANOMALY_THRESHOLD` based on false positive rate
3. **GeoIP integration** — Add country/ASN as features
4. **WebSocket streaming** — Push real-time events to the Security Command Center
5. **xgboost upgrade** — Replace Isolation Forest with gradient-boosted anomaly detection for better accuracy
