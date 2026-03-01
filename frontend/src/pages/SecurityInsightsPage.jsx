import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer,
} from 'recharts';
import {
    Shield, Activity, AlertTriangle, CheckCircle2, Users,
    Zap, Eye, Lock, TrendingUp, ArrowLeft, Clock, RefreshCw,
    MonitorSmartphone, Globe, Wifi, WifiOff, ChevronDown,
    Fingerprint, UserCheck, Server, ShieldAlert, ShieldCheck,
    Radio, Cpu, BarChart3, Database, ToggleLeft, ToggleRight,
} from 'lucide-react';

/* ═══════════════════════════════════════════════════════════════════════════
   DESIGN TOKENS
   ═══════════════════════════════════════════════════════════════════════════ */

const T = {
    bg: '#020617',
    bgGrad: 'linear-gradient(145deg, #020617 0%, #0a0f1e 50%, #020617 100%)',
    card: 'rgba(15,23,42,0.50)',
    cardBorder: 'rgba(30,41,59,0.6)',
    glass: 'blur(16px)',
    text: '#f1f5f9',
    textSec: '#94a3b8',
    textMuted: '#475569',
    emerald: '#10b981', emeraldBg: 'rgba(16,185,129,0.10)', emeraldBorder: 'rgba(16,185,129,0.25)',
    amber: '#f59e0b', amberBg: 'rgba(245,158,11,0.10)', amberBorder: 'rgba(245,158,11,0.25)',
    rose: '#f43f5e', roseBg: 'rgba(244,63,94,0.10)', roseBorder: 'rgba(244,63,94,0.25)',
    cyan: '#06b6d4', cyanBg: 'rgba(6,182,212,0.10)', cyanBorder: 'rgba(6,182,212,0.25)',
    purple: '#a78bfa',
    fontUI: "'Inter', sans-serif",
    fontMono: "'JetBrains Mono', monospace",
};

/* ═══════════════════════════════════════════════════════════════════════════
   MOCK DATA  (available via toggle for demo / offline use)
   ═══════════════════════════════════════════════════════════════════════════ */

function rnd(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

function genMockTraffic() {
    return Array.from({ length: 24 }, (_, i) => {
        const normal = rnd(80, 220);
        const anomaly = Math.random() < 0.2 ? rnd(8, 35) : rnd(0, 5);
        return { time: `${String(i).padStart(2, '0')}:00`, requests: normal, anomalies: anomaly, flagged: anomaly > 10 };
    });
}

const MOCK_DASHBOARD = {
    traffic: genMockTraffic(),
    total_requests: rnd(800, 2400),
    total_anomalies: rnd(12, 60),
    unique_ips: rnd(5, 20),
    events: [
        { id: 1, timestamp: new Date().toISOString(), ip_address: '127.0.0.1', endpoint_path: '/api/login', method: 'POST', is_failed_attempt: 1, global_risk_score: 0.0, user_id: 'alice_q', user_agent: 'Chrome/Win11' },
        { id: 2, timestamp: new Date().toISOString(), ip_address: '203.0.113.12', endpoint_path: '/api/vault/bob_pqc', method: 'GET', is_failed_attempt: 0, global_risk_score: 0.45, user_id: 'bob_pqc', user_agent: 'Firefox/Ubuntu' },
        { id: 3, timestamp: new Date().toISOString(), ip_address: '45.33.32.156', endpoint_path: '/api/login', method: 'POST', is_failed_attempt: 1, global_risk_score: 0.82, user_id: 'dave_sec', user_agent: 'curl/7.81' },
    ],
};

const MOCK_USERS = [
    { user_id: 'alice_q', avg_login_hour_sin: 0.5, avg_login_hour_cos: 0.87, login_hour_std_dev: 1.2, trusted_ips: ['192.168.1.42', '10.0.0.5'], trusted_user_agents: ['Chrome / Win11', 'Safari / iPhone 15'], sample_count: 47, last_updated: new Date().toISOString() },
    { user_id: 'bob_pqc', avg_login_hour_sin: 0.97, avg_login_hour_cos: -0.26, login_hour_std_dev: 0.8, trusted_ips: ['203.0.113.12'], trusted_user_agents: ['Firefox / Ubuntu'], sample_count: 12, last_updated: new Date().toISOString() },
    { user_id: 'dave_sec', avg_login_hour_sin: -0.87, avg_login_hour_cos: 0.5, login_hour_std_dev: 0.3, trusted_ips: ['45.33.32.156'], trusted_user_agents: ['curl/7.81'], sample_count: 4, last_updated: new Date().toISOString() },
];

const MOCK_USER_EVENTS = {
    alice_q: [
        { id: 1, timestamp: new Date().toISOString(), ip_address: '192.168.1.42', endpoint_path: '/api/login', method: 'POST', is_failed_attempt: 0, global_risk_score: 0.0, user_id: 'alice_q', user_agent: 'Chrome / Win11' },
    ],
    bob_pqc: [
        { id: 2, timestamp: new Date().toISOString(), ip_address: '89.207.132.1', endpoint_path: '/api/login', method: 'POST', is_failed_attempt: 0, global_risk_score: 0.45, user_id: 'bob_pqc', user_agent: 'Firefox / Ubuntu' },
    ],
    dave_sec: [
        { id: 3, timestamp: new Date().toISOString(), ip_address: '45.33.32.156', endpoint_path: '/api/login', method: 'POST', is_failed_attempt: 1, global_risk_score: 0.82, user_id: 'dave_sec', user_agent: 'curl/7.81' },
    ],
};

/* ═══════════════════════════════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════════════════════════════ */

/** Convert circular mean (sin/cos) back to a readable hour range. */
function circularMeanToWindow(sin_val, cos_val, std_dev) {
    const angle = Math.atan2(sin_val, cos_val);
    const meanHour = ((angle * 24) / (2 * Math.PI) + 24) % 24;
    const lo = ((meanHour - std_dev) + 24) % 24;
    const hi = (meanHour + std_dev) % 24;
    const fmt = h => `${String(Math.floor(h)).padStart(2, '0')}:${String(Math.round((h % 1) * 60)).padStart(2, '0')}`;
    return `${fmt(lo)} – ${fmt(hi)}`;
}

/** Compute a simple trust score from a profile. */
function computeTrustScore(profile) {
    if (!profile) return 0;
    const sc = profile.sample_count || 0;
    const maturity = Math.min(sc / 30, 1);
    const diversity = Math.min((profile.trusted_ips?.length || 0) / 3, 1);
    return Math.round(maturity * 0.7 + diversity * 0.3, 2);
}

/** Format an ISO timestamp to HH:MM:SS. */
function fmtTime(ts) {
    try { const d = new Date(ts); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`; }
    catch { return ts?.substring(11, 19) || '??:??:??'; }
}

/* ═══════════════════════════════════════════════════════════════════════════
   REUSABLE COMPONENTS
   ═══════════════════════════════════════════════════════════════════════════ */

function Card({ title, icon: Icon, iconColor = T.cyan, children, style = {}, headerRight }) {
    return (
        <div style={{
            background: T.card, backdropFilter: T.glass, WebkitBackdropFilter: T.glass,
            border: `1px solid ${T.cardBorder}`, borderRadius: '1rem', overflow: 'hidden', ...style,
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.875rem 1.125rem', borderBottom: '1px solid rgba(30,41,59,0.5)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Icon size={14} color={iconColor} />
                    <span style={{ fontSize: '0.6875rem', fontFamily: T.fontMono, fontWeight: 700, color: 'rgba(255,255,255,0.7)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>{title}</span>
                </div>
                {headerRight}
            </div>
            <div style={{ padding: '1.125rem' }}>{children}</div>
        </div>
    );
}

function MetricChip({ label, value, color = T.text, sub }) {
    return (
        <div style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '0.625rem', padding: '0.75rem 0.875rem', textAlign: 'center' }}>
            <p style={{ fontSize: '1.25rem', fontWeight: 800, fontFamily: T.fontMono, color, margin: 0, lineHeight: 1.2 }}>{value}</p>
            <p style={{ fontSize: '0.5625rem', color: T.textMuted, margin: '0.25rem 0 0', textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: T.fontMono }}>{label}</p>
            {sub && <p style={{ fontSize: '0.5rem', color: T.textMuted, margin: '0.125rem 0 0', fontFamily: T.fontMono }}>{sub}</p>}
        </div>
    );
}

function SectionHeader({ icon: Icon, title, subtitle, color = T.cyan }) {
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
            <div style={{ width: 32, height: 32, borderRadius: '0.5rem', background: `${color}12`, border: `1px solid ${color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon size={16} color={color} />
            </div>
            <div>
                <h2 style={{ fontSize: '1rem', fontWeight: 800, color: T.text, margin: 0, letterSpacing: '-0.02em' }}>{title}</h2>
                <p style={{ fontSize: '0.6875rem', fontFamily: T.fontMono, color: T.textMuted, margin: 0 }}>{subtitle}</p>
            </div>
        </div>
    );
}

function Badge({ text, color, bg, borderColor }) {
    return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.625rem', fontFamily: T.fontMono, fontWeight: 700, color, background: bg, border: `1px solid ${borderColor}`, borderRadius: '9999px', padding: '0.2rem 0.625rem', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
            {text}
        </span>
    );
}

/* ── Risk Gauge ─────────────────────────────────────────────────────── */

function RiskGauge({ value }) {
    const R = 78, CX = 105, CY = 108;
    const startAngle = -225, endAngle = 45, totalDeg = endAngle - startAngle;
    const valueDeg = (value / 100) * totalDeg;
    const polar = (deg, r) => { const a = (deg - 90) * Math.PI / 180; return { x: CX + r * Math.cos(a), y: CY + r * Math.sin(a) }; };
    const arc = (a1, a2, r) => { const s = polar(a1, r), e = polar(a2, r); return `M ${s.x} ${s.y} A ${r} ${r} 0 ${a2 - a1 > 180 ? 1 : 0} 1 ${e.x} ${e.y}`; };
    const color = value <= 40 ? T.emerald : value <= 70 ? T.amber : T.rose;
    const needle = polar(startAngle + valueDeg, 56);
    const label = value <= 30 ? 'SAFE' : value <= 55 ? 'ELEVATED' : value <= 75 ? 'HIGH' : 'CRITICAL';
    return (
        <svg width={210} height={190} style={{ overflow: 'visible' }}>
            {Array.from({ length: 27 }, (_, i) => { const a = startAngle + (i / 26) * totalDeg, m = i % 5 === 0; const inner = polar(a, R - (m ? 10 : 6)), outer = polar(a, R); return <line key={i} x1={inner.x} y1={inner.y} x2={outer.x} y2={outer.y} stroke="rgba(255,255,255,0.12)" strokeWidth={m ? 2 : 0.8} />; })}
            <path d={arc(startAngle, endAngle, R)} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={12} strokeLinecap="round" />
            <defs><linearGradient id="gaugeGrad" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stopColor={T.emerald} /><stop offset="50%" stopColor={T.amber} /><stop offset="100%" stopColor={T.rose} /></linearGradient></defs>
            <motion.path d={arc(startAngle, startAngle, R)} fill="none" stroke="url(#gaugeGrad)" strokeWidth={12} strokeLinecap="round" animate={{ d: arc(startAngle, startAngle + valueDeg, R) }} transition={{ duration: 1.6, ease: 'easeOut' }} style={{ filter: `drop-shadow(0 0 8px ${color})` }} />
            <motion.line x1={CX} y1={CY} x2={needle.x} y2={needle.y} stroke={color} strokeWidth={2} strokeLinecap="round" style={{ filter: `drop-shadow(0 0 4px ${color})` }} initial={{ x2: polar(startAngle, 56).x, y2: polar(startAngle, 56).y }} animate={{ x2: needle.x, y2: needle.y }} transition={{ duration: 1.6, ease: 'easeOut' }} />
            <circle cx={CX} cy={CY} r={5} fill={color} style={{ filter: `drop-shadow(0 0 6px ${color})` }} />
            <text x={CX} y={CY + 26} textAnchor="middle" fill="white" fontSize={26} fontFamily={T.fontMono} fontWeight={700}>{value}</text>
            <text x={CX} y={CY + 42} textAnchor="middle" fill={color} fontSize={9} fontFamily={T.fontMono} fontWeight={700} letterSpacing={2}>{label}</text>
        </svg>
    );
}

/* ── System Health Bar ─────────────────────────────────────────────── */

function SystemHealthBar({ mockMode, hasModelTrained, userProfileCount }) {
    const globalStatus = hasModelTrained ? 'Online' : 'Cold Start';
    const globalColor = hasModelTrained ? T.emerald : T.amber;
    const baselineStatus = userProfileCount > 0 ? 'Online' : 'Learning';
    const baselineColor = userProfileCount > 0 ? T.emerald : T.cyan;
    const indicators = [
        { label: 'PQC Layer', status: 'Active', color: T.emerald, icon: Shield },
        { label: 'Global Agent', status: globalStatus, color: globalColor, icon: Radio },
        { label: 'User Baseline', status: baselineStatus, color: baselineColor, icon: Fingerprint },
        { label: 'Data Source', status: mockMode ? 'MOCK' : 'LIVE', color: mockMode ? T.amber : T.emerald, icon: Database },
        { label: 'Vault', status: '100%', color: T.emerald, icon: Lock },
    ];
    return (
        <div style={{ position: 'sticky', top: '68px', zIndex: 40, background: 'rgba(2,6,23,0.92)', backdropFilter: 'blur(20px)', borderBottom: `1px solid ${T.cardBorder}`, padding: '0.5rem 1.5rem', display: 'flex', alignItems: 'center', gap: '1.75rem', overflowX: 'auto' }}>
            <span style={{ fontSize: '0.5625rem', fontFamily: T.fontMono, color: T.textMuted, letterSpacing: '0.12em', textTransform: 'uppercase', flexShrink: 0 }}>SYS STATUS</span>
            {indicators.map(({ label, status, color, icon: Icon }) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexShrink: 0 }}>
                    <span style={{ width: 5, height: 5, borderRadius: '50%', background: color, boxShadow: `0 0 6px ${color}`, animation: 'glow-pulse 2s ease-in-out infinite' }} />
                    <Icon size={11} color={color} />
                    <span style={{ fontSize: '0.625rem', fontFamily: T.fontMono, color: T.textMuted }}>{label}:</span>
                    <span style={{ fontSize: '0.625rem', fontFamily: T.fontMono, color, fontWeight: 700 }}>{status}</span>
                </div>
            ))}
        </div>
    );
}

/* ── Chart Tooltip ─────────────────────────────────────────────────── */

function ChartTooltip({ active, payload, label }) {
    if (!active || !payload?.length) return null;
    return (
        <div style={{ background: 'rgba(2,6,23,0.96)', border: `1px solid ${T.cardBorder}`, borderRadius: '0.5rem', padding: '0.5rem 0.75rem', fontFamily: T.fontMono, fontSize: '0.6875rem' }}>
            <p style={{ color: T.textMuted, marginBottom: '0.25rem', fontSize: '0.625rem' }}>{label}</p>
            {payload.map(p => <p key={p.name} style={{ color: p.color, margin: 0 }}>{p.name}: <strong>{p.value}</strong></p>)}
        </div>
    );
}

/* ── User Selector ─────────────────────────────────────────────────── */

function UserSelector({ users, selected, onSelect }) {
    const [open, setOpen] = useState(false);
    const ref = useRef(null);
    useEffect(() => { const h = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }; document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h); }, []);
    const current = users.find(u => u.user_id === selected) || users[0];
    if (!current) return null;
    const trust = computeTrustScore(current);
    const tc = trust >= 0.7 ? T.emerald : trust >= 0.4 ? T.amber : T.rose;
    return (
        <div ref={ref} style={{ position: 'relative' }}>
            <button onClick={() => setOpen(!open)} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(255,255,255,0.04)', border: `1px solid ${T.cardBorder}`, borderRadius: '0.625rem', padding: '0.5rem 0.875rem', cursor: 'pointer', color: T.text, fontFamily: T.fontMono, fontSize: '0.8125rem', transition: 'all 0.2s' }}>
                <Users size={14} color={T.cyan} />
                <span>{current.user_id}</span>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: tc, boxShadow: `0 0 6px ${tc}` }} />
                <ChevronDown size={12} color={T.textMuted} style={{ transform: open ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s' }} />
            </button>
            <AnimatePresence>
                {open && (
                    <motion.div initial={{ opacity: 0, y: -4, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -4, scale: 0.97 }} transition={{ duration: 0.15 }} style={{ position: 'absolute', top: '100%', left: 0, marginTop: '0.375rem', background: 'rgba(15,23,42,0.98)', border: `1px solid ${T.cardBorder}`, borderRadius: '0.625rem', overflow: 'hidden', zIndex: 50, backdropFilter: T.glass, minWidth: '200px', boxShadow: '0 16px 48px rgba(0,0,0,0.5)' }}>
                        {users.map(u => {
                            const t = computeTrustScore(u), c = t >= 0.7 ? T.emerald : t >= 0.4 ? T.amber : T.rose;
                            return (
                                <div key={u.user_id} onClick={() => { onSelect(u.user_id); setOpen(false); }}
                                    style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0.875rem', cursor: 'pointer', background: u.user_id === selected ? 'rgba(255,255,255,0.06)' : 'transparent', borderLeft: u.user_id === selected ? `2px solid ${T.cyan}` : '2px solid transparent', transition: 'all 0.15s' }}
                                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                                    onMouseLeave={e => e.currentTarget.style.background = u.user_id === selected ? 'rgba(255,255,255,0.06)' : 'transparent'}>
                                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: c, boxShadow: `0 0 4px ${c}` }} />
                                    <span style={{ fontSize: '0.8125rem', fontFamily: T.fontMono, color: T.text }}>{u.user_id}</span>
                                    <span style={{ marginLeft: 'auto', fontSize: '0.625rem', fontFamily: T.fontMono, color: c }}>{Math.round(t * 100)}%</span>
                                </div>
                            );
                        })}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN PAGE
   ═══════════════════════════════════════════════════════════════════════════ */

export default function SecurityInsightsPage() {
    const navigate = useNavigate();
    const [mockMode, setMockMode] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // ── Data state ───────────────────────────────────────────
    const [dashboard, setDashboard] = useState(null);           // global telemetry
    const [userProfiles, setUserProfiles] = useState([]);        // all user profiles
    const [selectedUser, setSelectedUser] = useState(null);
    const [userEvents, setUserEvents] = useState([]);
    const [userProfile, setUserProfile] = useState(null);

    // ── Animated gauge ───────────────────────────────────────
    const [threatIndex, setThreatIndex] = useState(0);

    // ── Fetch real data ──────────────────────────────────────
    const fetchDashboard = useCallback(async () => {
        if (mockMode) {
            setDashboard(MOCK_DASHBOARD);
            setUserProfiles(MOCK_USERS);
            if (!selectedUser && MOCK_USERS.length) setSelectedUser(MOCK_USERS[0].user_id);
            setLoading(false);
            return;
        }
        try {
            setLoading(true);
            setError(null);
            const [dashRes, usersRes] = await Promise.all([
                fetch('/api/security/dashboard'),
                fetch('/api/security/users'),
            ]);
            if (!dashRes.ok || !usersRes.ok) throw new Error('API error');
            const dashData = await dashRes.json();
            const usersData = await usersRes.json();
            setDashboard(dashData);
            setUserProfiles(usersData.users || []);
            if (!selectedUser && usersData.users?.length) setSelectedUser(usersData.users[0].user_id);
        } catch (err) {
            setError(err.message);
            // Fallback to mock on error
            setDashboard(MOCK_DASHBOARD);
            setUserProfiles(MOCK_USERS);
            if (!selectedUser && MOCK_USERS.length) setSelectedUser(MOCK_USERS[0].user_id);
        } finally {
            setLoading(false);
        }
    }, [mockMode]);

    // ── Fetch user detail when selection changes ─────────────
    const fetchUserDetail = useCallback(async () => {
        if (!selectedUser) return;
        if (mockMode) {
            const mu = MOCK_USERS.find(u => u.user_id === selectedUser);
            setUserProfile(mu || null);
            setUserEvents(MOCK_USER_EVENTS[selectedUser] || []);
            return;
        }
        try {
            const res = await fetch(`/api/security/user/${selectedUser}`);
            if (!res.ok) throw new Error('User API error');
            const data = await res.json();
            setUserProfile(data.profile);
            setUserEvents(data.events || []);
        } catch {
            setUserProfile(null);
            setUserEvents([]);
        }
    }, [selectedUser, mockMode]);

    useEffect(() => { fetchDashboard(); }, [fetchDashboard]);
    useEffect(() => { fetchUserDetail(); }, [fetchUserDetail]);

    // Auto-refresh every 15 seconds
    useEffect(() => {
        const id = setInterval(() => { fetchDashboard(); fetchUserDetail(); }, 15000);
        return () => clearInterval(id);
    }, [fetchDashboard, fetchUserDetail]);

    // ── Animate gauge based on data ──────────────────────────
    const gaugeInitialized = useRef(false);
    useEffect(() => {
        if (!dashboard) return;
        // Use the actual average global_risk_score from telemetry events
        const events = dashboard.events || [];
        const avgRisk = events.length > 0
            ? events.reduce((sum, e) => sum + (e.global_risk_score || 0), 0) / events.length
            : 0;
        const target = Math.min(Math.round(avgRisk * 100), 100);

        // Only animate from 0 on the very first load
        if (gaugeInitialized.current) {
            setThreatIndex(target);
            return;
        }
        gaugeInitialized.current = true;

        let cur = 0;
        const step = target / 80;
        const id = setInterval(() => { cur = Math.min(cur + step, target); setThreatIndex(Math.round(cur)); if (cur >= target) clearInterval(id); }, 18);
        return () => clearInterval(id);

    }, [dashboard]);

    // ── Derived values ───────────────────────────────────────
    const traffic = dashboard?.traffic || [];
    const totalReq = dashboard?.total_requests || 0;
    const totalAnom = dashboard?.total_anomalies || 0;
    const allEvents = dashboard?.events || [];

    const trust = computeTrustScore(userProfile);
    const trustColor = trust >= 0.7 ? T.emerald : trust >= 0.4 ? T.amber : T.rose;
    const trustLabel = trust >= 0.7 ? 'TRUSTED' : trust >= 0.4 ? 'ELEVATED' : 'CRITICAL';
    const loginWindow = userProfile ? circularMeanToWindow(userProfile.avg_login_hour_sin, userProfile.avg_login_hour_cos, userProfile.login_hour_std_dev) : 'N/A';
    const devices = userProfile?.trusted_user_agents || [];
    const ips = userProfile?.trusted_ips || [];
    const sampleCount = userProfile?.sample_count || 0;

    return (
        <div style={{ minHeight: '100vh', background: T.bgGrad, paddingTop: '68px' }}>
            <SystemHealthBar mockMode={mockMode} hasModelTrained={allEvents.some(e => (e.global_risk_score || 0) > 0)} userProfileCount={userProfiles.length} />

            <div style={{ maxWidth: '1440px', margin: '0 auto', padding: '1.75rem 1.5rem 3rem' }}>

                {/* ── PAGE HEADER ─────────────────────────────────────── */}
                <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }}
                    style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.75rem', flexWrap: 'wrap', gap: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
                        <button onClick={() => navigate('/dashboard')} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', background: 'rgba(255,255,255,0.04)', border: `1px solid ${T.cardBorder}`, borderRadius: '0.625rem', padding: '0.4rem 0.75rem', color: T.textSec, cursor: 'pointer', fontSize: '0.75rem', fontFamily: T.fontUI, transition: 'all 0.2s' }}
                            onMouseEnter={e => { e.currentTarget.style.color = 'white'; e.currentTarget.style.borderColor = T.cyan; }}
                            onMouseLeave={e => { e.currentTarget.style.color = T.textSec; e.currentTarget.style.borderColor = T.cardBorder; }}>
                            <ArrowLeft size={13} /> Vault
                        </button>
                        <div>
                            <h1 style={{ fontSize: '1.5rem', fontWeight: 900, letterSpacing: '-0.03em', margin: 0 }}>
                                Security <span style={{ color: T.cyan }}>Command Center</span>
                            </h1>
                            <p style={{ fontSize: '0.6875rem', color: T.textMuted, margin: '0.125rem 0 0', fontFamily: T.fontMono }}>
                                Post-quantum threat intelligence • Hybrid anomaly scoring
                            </p>
                        </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
                        {/* Mock / Live toggle */}
                        <div onClick={() => setMockMode(!mockMode)} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', padding: '0.35rem 0.75rem', background: mockMode ? T.amberBg : 'rgba(255,255,255,0.04)', border: `1px solid ${mockMode ? T.amberBorder : T.cardBorder}`, borderRadius: '9999px', transition: 'all 0.2s' }}>
                            {mockMode ? <ToggleRight size={16} color={T.amber} /> : <ToggleLeft size={16} color={T.textMuted} />}
                            <span style={{ fontSize: '0.6875rem', fontFamily: T.fontMono, color: mockMode ? T.amber : T.textSec, fontWeight: 600 }}>
                                {mockMode ? 'MOCK DATA' : 'LIVE DATA'}
                            </span>
                        </div>

                        {/* Status badge */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', padding: '0.3rem 0.75rem', background: mockMode ? T.amberBg : T.roseBg, border: `1px solid ${mockMode ? T.amberBorder : T.roseBorder}`, borderRadius: '9999px', fontSize: '0.625rem', fontFamily: T.fontMono, color: mockMode ? T.amber : T.rose, fontWeight: 700 }}>
                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: mockMode ? T.amber : T.rose, boxShadow: `0 0 6px ${mockMode ? T.amber : T.rose}`, animation: mockMode ? 'none' : 'glow-pulse 1s ease-in-out infinite' }} />
                            {mockMode ? 'DEMO' : 'LIVE'}
                        </div>
                    </div>
                </motion.div>

                {/* ── Error Banner ──────────────────────────────────── */}
                {error && !mockMode && (
                    <div style={{ padding: '0.625rem 1rem', marginBottom: '1rem', background: T.amberBg, border: `1px solid ${T.amberBorder}`, borderRadius: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontFamily: T.fontMono, fontSize: '0.75rem', color: T.amber }}>
                        <AlertTriangle size={14} /> Failed to fetch live data — showing cached/default values. {error}
                    </div>
                )}

                {/* ═════════════════════════════════════════════════════
                   SECTION 1 — GLOBAL SYSTEM OVERVIEW
                   ═════════════════════════════════════════════════════ */}

                <SectionHeader icon={Globe} title="Global System Overview" subtitle="Isolation Forest anomaly detection • System-wide threat monitoring" color={T.cyan} />

                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 4fr) minmax(0, 8fr)', gap: '1rem', marginBottom: '2.5rem' }}>

                    {/* LEFT — Risk Gauge + Metrics + Mitigations */}
                    <motion.div initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.05 }}
                        style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

                        <Card title="Isolation Forest Threat Score" icon={TrendingUp} iconColor={threatIndex <= 40 ? T.emerald : threatIndex <= 65 ? T.amber : T.rose}>
                            <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '0.25rem' }}>
                                <RiskGauge value={threatIndex} />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginTop: '0.5rem' }}>
                                <MetricChip label="Total Requests" value={totalReq} />
                                <MetricChip label="Failed (24h)" value={totalAnom} color={totalAnom > 4 ? T.rose : T.amber} />
                                <MetricChip label="Unique IPs" value={dashboard?.unique_ips || 0} />
                                <MetricChip label="User Profiles" value={userProfiles.length} />
                            </div>
                        </Card>

                        <Card title="Active Mitigations" icon={Shield} iconColor={T.emerald}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                                {[
                                    { label: 'Rate Limiting', status: 'ACTIVE', color: T.emerald, detail: '100 req/min per IP' },
                                    { label: 'Brute-Force Guard', status: 'ACTIVE', color: T.emerald, detail: '5 failures → 15 min ban' },
                                    { label: 'Geo-Fence', status: 'INACTIVE', color: T.textMuted, detail: 'Not configured' },
                                ].map(m => (
                                    <div key={m.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem 0.625rem', borderRadius: '0.5rem', background: m.status === 'ACTIVE' ? 'rgba(16,185,129,0.04)' : 'rgba(255,255,255,0.02)', border: `1px solid ${m.status === 'ACTIVE' ? T.emeraldBorder : 'rgba(255,255,255,0.05)'}` }}>
                                        <div>
                                            <p style={{ fontSize: '0.75rem', fontWeight: 600, color: T.text, margin: 0 }}>{m.label}</p>
                                            <p style={{ fontSize: '0.5625rem', fontFamily: T.fontMono, color: T.textMuted, margin: 0 }}>{m.detail}</p>
                                        </div>
                                        <Badge text={m.status} color={m.color} bg={m.status === 'ACTIVE' ? T.emeraldBg : 'rgba(255,255,255,0.03)'} borderColor={m.status === 'ACTIVE' ? T.emeraldBorder : 'rgba(255,255,255,0.08)'} />
                                    </div>
                                ))}
                            </div>
                        </Card>
                    </motion.div>

                    {/* RIGHT — Traffic Chart */}
                    <motion.div initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }}>
                        <Card title="System Traffic — 24h" icon={Activity} iconColor={T.cyan}
                            style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
                            headerRight={
                                <div style={{ display: 'flex', gap: '1rem' }}>
                                    {[{ c: T.cyan, l: 'Requests' }, { c: T.rose, l: 'Failed' }].map(({ c, l }) => (
                                        <span key={l} style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.625rem', fontFamily: T.fontMono, color: T.textMuted }}>
                                            <span style={{ width: 8, height: 2, background: c, display: 'inline-block', borderRadius: 1 }} /> {l}
                                        </span>
                                    ))}
                                </div>
                            }>
                            <div style={{ flex: 1, minHeight: 0, height: '100%' }}>
                                <ResponsiveContainer width="100%" height="100%" minHeight={400}>
                                    <AreaChart data={traffic} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
                                        <defs>
                                            <linearGradient id="gradReq" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={T.cyan} stopOpacity={0.2} /><stop offset="95%" stopColor={T.cyan} stopOpacity={0} /></linearGradient>
                                            <linearGradient id="gradAnom" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={T.rose} stopOpacity={0.3} /><stop offset="95%" stopColor={T.rose} stopOpacity={0} /></linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                                        <XAxis dataKey="time" tick={{ fontSize: 9, fontFamily: T.fontMono, fill: T.textMuted }} tickLine={false} axisLine={false} interval={3} />
                                        <YAxis tick={{ fontSize: 9, fontFamily: T.fontMono, fill: T.textMuted }} tickLine={false} axisLine={false} />
                                        <Tooltip content={<ChartTooltip />} />
                                        <Area type="monotone" dataKey="requests" name="Requests" stroke={T.cyan} fill="url(#gradReq)" strokeWidth={2} dot={false} />
                                        <Area type="monotone" dataKey="anomalies" name="Failed" stroke={T.rose} fill="url(#gradAnom)" strokeWidth={2}
                                            dot={(props) => { const { cx, cy, payload } = props; if (!payload.flagged) return null; return <circle cx={cx} cy={cy} r={4} fill={T.rose} stroke="rgba(244,63,94,0.4)" strokeWidth={6} style={{ filter: `drop-shadow(0 0 4px ${T.rose})` }} />; }} />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </Card>
                    </motion.div>
                </div>

                {/* ═════════════════════════════════════════════════════
                   SECTION 2 — USER BEHAVIORAL ANALYSIS
                   ═════════════════════════════════════════════════════ */}

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                    <SectionHeader icon={Fingerprint} title="User Behavioral Analysis" subtitle="Per-user drift detection • Account Takeover prevention" color={T.purple} />
                    {userProfiles.length > 0 && <UserSelector users={userProfiles} selected={selectedUser} onSelect={setSelectedUser} />}
                </div>

                {userProfiles.length === 0 ? (
                    /* No user profiles yet */
                    <Card title="No User Profiles" icon={Users} iconColor={T.textMuted}>
                        <div style={{ textAlign: 'center', padding: '2rem 0' }}>
                            <Fingerprint size={40} color={T.textMuted} style={{ marginBottom: '0.75rem' }} />
                            <p style={{ fontSize: '0.875rem', color: T.textSec, margin: 0 }}>
                                No user baselines have been created yet.
                            </p>
                            <p style={{ fontSize: '0.6875rem', fontFamily: T.fontMono, color: T.textMuted, margin: '0.5rem 0 0' }}>
                                User profiles are automatically built after successful logins.
                                <br />Toggle to <strong>Mock Mode</strong> to see a demo with sample data.
                            </p>
                        </div>
                    </Card>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 5fr) minmax(0, 4fr) minmax(0, 3fr)', gap: '1rem' }}>

                        {/* LEFT — Trust + Baseline */}
                        <motion.div key={selectedUser + '-m'} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                                <Card title="Trust Score" icon={ShieldCheck} iconColor={trustColor}>
                                    <div style={{ textAlign: 'center' }}>
                                        <p style={{ fontSize: '2.5rem', fontWeight: 900, fontFamily: T.fontMono, color: trustColor, margin: 0, lineHeight: 1, textShadow: `0 0 20px ${trustColor}40` }}>
                                            {Math.round(trust * 100)}<span style={{ fontSize: '1rem', color: T.textMuted }}>%</span>
                                        </p>
                                        <Badge text={trustLabel} color={trustColor} bg={trust >= 0.7 ? T.emeraldBg : trust >= 0.4 ? T.amberBg : T.roseBg} borderColor={trust >= 0.7 ? T.emeraldBorder : trust >= 0.4 ? T.amberBorder : T.roseBorder} />
                                        <p style={{ fontSize: '0.5625rem', fontFamily: T.fontMono, color: T.textMuted, margin: '0.5rem 0 0' }}>{sampleCount} samples in baseline</p>
                                    </div>
                                </Card>

                                <Card title="Baseline Maturity" icon={BarChart3} iconColor={sampleCount >= 3 ? T.emerald : T.amber}>
                                    <div style={{ textAlign: 'center' }}>
                                        <p style={{ fontSize: '2.5rem', fontWeight: 900, fontFamily: T.fontMono, color: sampleCount >= 3 ? T.emerald : T.amber, margin: 0, lineHeight: 1 }}>
                                            {sampleCount}
                                        </p>
                                        <Badge text={sampleCount >= 3 ? 'MATURE' : 'IMMATURE'} color={sampleCount >= 3 ? T.emerald : T.amber} bg={sampleCount >= 3 ? T.emeraldBg : T.amberBg} borderColor={sampleCount >= 3 ? T.emeraldBorder : T.amberBorder} />
                                        <p style={{ fontSize: '0.5625rem', fontFamily: T.fontMono, color: T.textMuted, margin: '0.5rem 0 0' }}>min 3 for full scoring</p>
                                    </div>
                                </Card>
                            </div>

                            <Card title="Baseline Profile" icon={UserCheck} iconColor={T.purple}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                    <div>
                                        <p style={{ fontSize: '0.5625rem', fontFamily: T.fontMono, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 0.375rem' }}>Typical Login Window</p>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(167,139,250,0.06)', border: '1px solid rgba(167,139,250,0.18)', borderRadius: '0.5rem', padding: '0.5rem 0.75rem' }}>
                                            <Clock size={13} color={T.purple} />
                                            <span style={{ fontSize: '0.8125rem', fontFamily: T.fontMono, color: T.text }}>{loginWindow}</span>
                                        </div>
                                    </div>
                                    <div>
                                        <p style={{ fontSize: '0.5625rem', fontFamily: T.fontMono, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 0.375rem' }}>Trusted Devices</p>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
                                            {devices.length > 0 ? devices.map(d => (
                                                <div key={d} style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', background: 'rgba(255,255,255,0.03)', border: `1px solid ${T.cardBorder}`, borderRadius: '0.375rem', padding: '0.3rem 0.5rem', fontSize: '0.6875rem', fontFamily: T.fontMono, color: T.textSec }}>
                                                    <MonitorSmartphone size={11} color={T.textMuted} /> {d}
                                                </div>
                                            )) : <span style={{ fontSize: '0.6875rem', fontFamily: T.fontMono, color: T.textMuted }}>None yet</span>}
                                        </div>
                                    </div>
                                    <div>
                                        <p style={{ fontSize: '0.5625rem', fontFamily: T.fontMono, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 0.375rem' }}>Trusted IPs</p>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
                                            {ips.length > 0 ? ips.map(ip => (
                                                <div key={ip} style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', background: 'rgba(255,255,255,0.03)', border: `1px solid ${T.cardBorder}`, borderRadius: '0.375rem', padding: '0.3rem 0.5rem', fontSize: '0.6875rem', fontFamily: T.fontMono, color: T.textSec }}>
                                                    <Wifi size={11} color={T.textMuted} /> {ip}
                                                </div>
                                            )) : <span style={{ fontSize: '0.6875rem', fontFamily: T.fontMono, color: T.textMuted }}>None yet</span>}
                                        </div>
                                    </div>
                                </div>
                            </Card>
                        </motion.div>

                        {/* CENTER — Event Timeline */}
                        <motion.div key={selectedUser + '-t'} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.05 }}>
                            <Card title={`Event Timeline — ${selectedUser || '?'}`} icon={Activity} iconColor={T.cyan}
                                style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                                <div style={{ flex: 1, overflowY: 'auto' }}>
                                    {userEvents.length === 0 ? (
                                        <div style={{ textAlign: 'center', padding: '2rem 0', color: T.textMuted, fontFamily: T.fontMono, fontSize: '0.75rem' }}>
                                            No events recorded for this user yet.
                                        </div>
                                    ) : userEvents.map((ev, i) => {
                                        const isFailed = ev.is_failed_attempt;
                                        const score = ev.global_risk_score || 0;
                                        const evColor = isFailed ? T.rose : score > 0.5 ? T.amber : T.emerald;
                                        const EvIcon = isFailed ? AlertTriangle : score > 0.5 ? ShieldAlert : CheckCircle2;
                                        const isLast = i === userEvents.length - 1;
                                        return (
                                            <div key={ev.id} style={{ display: 'flex', gap: '0.75rem', position: 'relative', paddingBottom: isLast ? 0 : '1rem' }}>
                                                {!isLast && <div style={{ position: 'absolute', left: 15, top: 30, bottom: 0, width: 1, background: 'rgba(255,255,255,0.06)' }} />}
                                                <div style={{ width: 30, height: 30, borderRadius: '0.5rem', flexShrink: 0, background: `${evColor}12`, border: `1px solid ${evColor}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1 }}>
                                                    <EvIcon size={14} color={evColor} />
                                                </div>
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <p style={{ fontSize: '0.8125rem', fontWeight: 600, color: T.text, margin: 0, lineHeight: 1.3 }}>
                                                        {isFailed ? 'Failed' : 'Success'}: {ev.method} {ev.endpoint_path}
                                                    </p>
                                                    <p style={{ fontSize: '0.625rem', fontFamily: T.fontMono, color: T.textMuted, margin: '0.125rem 0 0' }}>
                                                        {fmtTime(ev.timestamp)} • {ev.ip_address} • risk: {score.toFixed(2)}
                                                    </p>
                                                </div>
                                                <Badge text={isFailed ? 'FAIL' : 'OK'} color={evColor} bg={`${evColor}12`} borderColor={`${evColor}30`} />
                                            </div>
                                        );
                                    })}
                                </div>
                            </Card>
                        </motion.div>

                        {/* RIGHT — Session Intel */}
                        <motion.div key={selectedUser + '-r'} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.1 }} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

                            <Card title="Risk Breakdown" icon={ShieldAlert} iconColor={T.amber}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                                    {[
                                        { label: 'Global Score', value: threatIndex / 100, color: T.cyan },
                                        { label: 'User Trust', value: trust, color: trustColor },
                                        { label: 'IP Diversity', value: Math.min((ips.length || 0) / 5, 1), color: T.purple },
                                        { label: 'Baseline Maturity', value: Math.min(sampleCount / 30, 1), color: sampleCount >= 3 ? T.emerald : T.amber },
                                    ].map(bar => (
                                        <div key={bar.label}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.125rem' }}>
                                                <span style={{ fontSize: '0.5625rem', fontFamily: T.fontMono, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{bar.label}</span>
                                                <span style={{ fontSize: '0.5625rem', fontFamily: T.fontMono, color: bar.color }}>{(bar.value * 100).toFixed(0)}%</span>
                                            </div>
                                            <div style={{ height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.06)' }}>
                                                <motion.div initial={{ width: 0 }} animate={{ width: `${bar.value * 100}%` }} transition={{ duration: 1, ease: 'easeOut' }}
                                                    style={{ height: '100%', borderRadius: 2, background: bar.color, boxShadow: `0 0 6px ${bar.color}40` }} />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </Card>

                            <Card title="Session Intel" icon={Cpu} iconColor={T.cyan}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                    {[
                                        { label: 'User ID', value: selectedUser || '—', icon: UserCheck },
                                        { label: 'IP Count', value: `${ips.length} known`, icon: Globe },
                                        { label: 'Devices', value: `${devices.length} registered`, icon: MonitorSmartphone },
                                        { label: 'Events', value: `${userEvents.length} recorded`, icon: Activity },
                                        { label: 'Last Updated', value: userProfile?.last_updated ? fmtTime(userProfile.last_updated) : 'N/A', icon: Clock },
                                        { label: 'Baseline', value: sampleCount >= 3 ? 'Mature' : 'Immature', icon: Server, color: sampleCount >= 3 ? T.emerald : T.amber },
                                    ].map(item => (
                                        <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.375rem 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                                            <item.icon size={12} color={item.color || T.textMuted} />
                                            <span style={{ fontSize: '0.6875rem', color: T.textMuted, fontFamily: T.fontMono }}>{item.label}</span>
                                            <span style={{ marginLeft: 'auto', fontSize: '0.6875rem', fontFamily: T.fontMono, color: item.color || T.text, fontWeight: 600 }}>{item.value}</span>
                                        </div>
                                    ))}
                                </div>
                            </Card>
                        </motion.div>
                    </div>
                )}
            </div>
        </div>
    );
}
