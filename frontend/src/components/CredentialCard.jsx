import { motion } from 'framer-motion';

const CAT_COLORS = {
    Social: { bg: 'rgba(236,72,153,0.1)', text: '#f472b6', border: 'rgba(236,72,153,0.25)' },
    Finance: { bg: 'rgba(34,197,94,0.1)', text: '#4ade80', border: 'rgba(34,197,94,0.25)' },
    Work: { bg: 'rgba(59,130,246,0.1)', text: '#60a5fa', border: 'rgba(59,130,246,0.25)' },
    Personal: { bg: 'rgba(139,92,246,0.1)', text: '#a78bfa', border: 'rgba(139,92,246,0.25)' },
};

export default function CredentialCard({ item, onClick, hackerMode, index }) {
    if (hackerMode) {
        return (
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: index * 0.04 }}
                onClick={onClick}
                style={{
                    background: '#050505',
                    border: '1px solid rgba(220,38,38,0.5)',
                    borderRadius: '0.875rem',
                    padding: '1.5rem',
                    cursor: 'pointer',
                    position: 'relative',
                    overflow: 'hidden',
                    transition: 'all 0.25s ease',
                    fontFamily: 'JetBrains Mono, monospace',
                }}
                whileHover={{
                    borderColor: 'rgba(220,38,38,0.9)',
                    boxShadow: '0 0 25px rgba(220,38,38,0.3)',
                    y: -2,
                }}
            >
                <div style={{
                    position: 'absolute', inset: 0,
                    background: 'repeating-linear-gradient(0deg, rgba(0,0,0,0.2) 0px, rgba(0,0,0,0.2) 1px, transparent 1px, transparent 4px)',
                    pointerEvents: 'none',
                    opacity: 0.5,
                }} />

                <div style={{ position: 'relative', zIndex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ef4444', boxShadow: '0 0 8px #ef4444', animation: 'glow-pulse 1.5s ease-in-out infinite' }} />
                            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#ef4444', letterSpacing: '0.12em', textTransform: 'uppercase' }}>ENCRYPTED</span>
                        </div>
                        <span style={{
                            fontSize: '0.625rem', background: 'rgba(220,38,38,0.15)',
                            color: '#f87171', padding: '0.2rem 0.5rem',
                            borderRadius: '4px', border: '1px solid rgba(220,38,38,0.4)',
                            fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
                        }}>
                            LOCKED
                        </span>
                    </div>

                    <p style={{
                        fontSize: '0.625rem', color: 'rgba(220,38,38,0.6)',
                        wordBreak: 'break-all', lineHeight: 1.6, marginBottom: '0.75rem',
                        maxHeight: '3.5rem', overflow: 'hidden',
                    }}>
                        {item.ciphertext.slice(0, 96)}…
                    </p>

                    <div style={{ display: 'flex', gap: '1rem', paddingTop: '0.75rem', borderTop: '1px solid rgba(220,38,38,0.15)' }}>
                        <span style={{ fontSize: '0.625rem', color: 'rgba(220,38,38,0.5)' }}>🔒 AES-256</span>
                        <span style={{ fontSize: '0.625rem', color: 'rgba(220,38,38,0.5)' }}>⚛ KYBER-768</span>
                    </div>
                </div>
            </motion.div>
        );
    }

    const cat = item.category || 'Personal';
    const colors = CAT_COLORS[cat] ?? CAT_COLORS.Personal;
    const initial = item.site.charAt(0).toUpperCase();

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: index * 0.05 }}
            onClick={onClick}
            className="glass"
            style={{
                padding: '1.5rem', borderRadius: '1.125rem',
                cursor: 'pointer', transition: 'all 0.25s ease',
            }}
            whileHover={{
                y: -4,
                boxShadow: '0 0 28px rgba(6,182,212,0.15)',
                borderColor: 'rgba(6,182,212,0.35)',
            }}
        >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                {/* Avatar */}
                <div style={{
                    width: '44px', height: '44px', borderRadius: '12px',
                    background: 'linear-gradient(135deg, rgba(6,182,212,0.2), rgba(139,92,246,0.2))',
                    border: '1px solid rgba(6,182,212,0.2)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '1.125rem', fontWeight: 800, color: 'var(--neon-cyan)',
                    flexShrink: 0,
                }}>
                    {initial}
                </div>

                {/* Badges */}
                <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    <span className="badge" style={{ background: colors.bg, color: colors.text, borderColor: colors.border }}>
                        {cat}
                    </span>
                    <span className="badge" style={{
                        background: 'rgba(6,182,212,0.08)',
                        color: 'rgba(6,182,212,0.85)',
                        borderColor: 'rgba(6,182,212,0.2)',
                    }}>
                        PQC
                    </span>
                </div>
            </div>

            <h3 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: '0.375rem', color: 'white', letterSpacing: '-0.01em' }}>
                {item.site}
            </h3>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace' }}>
                ID: {item.id.slice(0, 8)}…
            </p>
        </motion.div>
    );
}
