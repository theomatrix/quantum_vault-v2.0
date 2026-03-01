import { motion, AnimatePresence } from 'framer-motion';

export default function HackerModal({ item, onClose }) {
    if (!item) return null;

    return (
        <AnimatePresence>
            <div className="modal-backdrop" style={{ background: 'rgba(10,0,0,0.92)' }} onClick={e => e.target === e.currentTarget && onClose()}>
                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ duration: 0.25 }}
                    style={{
                        background: '#050505',
                        border: '2px solid #dc2626',
                        borderRadius: '1rem',
                        maxWidth: '640px', width: '100%',
                        boxShadow: '0 0 60px rgba(220,38,38,0.4)',
                        fontFamily: 'JetBrains Mono, monospace',
                        overflow: 'hidden', position: 'relative',
                    }}
                >
                    {/* Scanlines */}
                    <div style={{
                        position: 'absolute', inset: 0, pointerEvents: 'none',
                        background: 'repeating-linear-gradient(0deg, rgba(0,0,0,0.2) 0px, rgba(0,0,0,0.2) 1px, transparent 1px, transparent 4px)',
                        zIndex: 0,
                    }} />

                    <div style={{ position: 'relative', zIndex: 1, padding: '1.75rem' }}>
                        {/* Header */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '1rem', borderBottom: '1px solid rgba(220,38,38,0.2)', marginBottom: '1rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#dc2626', animation: 'glow-pulse 1s ease-in-out infinite' }} />
                                <h2 style={{ fontSize: '0.875rem', fontWeight: 700, color: '#ef4444', letterSpacing: '0.15em', textTransform: 'uppercase' }}>
                                    ⚠ Data Breach Simulation
                                </h2>
                            </div>
                            <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '1.25rem' }}>✕</button>
                        </div>

                        {/* Warning */}
                        <div style={{
                            background: 'rgba(220,38,38,0.08)',
                            border: '1px solid rgba(220,38,38,0.2)',
                            borderLeft: '3px solid #dc2626',
                            borderRadius: '0.5rem', padding: '0.75rem',
                            marginBottom: '1.25rem',
                            fontSize: '0.75rem', color: '#fca5a5', lineHeight: 1.6,
                        }}>
                            <strong style={{ color: '#f87171' }}>ATTACKER PERSPECTIVE:</strong> This is the raw data extracted from the database.
                            Without the user's private key (stored locally), this information is mathematically impossible to decrypt.
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxHeight: '52vh', overflowY: 'auto' }}>
                            <DataRow label="Record ID" value={item.id} color="white" />
                            <DataRow label="Kyber-768 Ciphertext" value={item.ciphertext} color="#4ade80" />
                            <DataRow label="AES-256 Payload" value={item.content} color="#fbbf24" />
                        </div>

                        <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
                            <span style={{
                                display: 'inline-block',
                                background: '#dc2626', color: 'black',
                                fontWeight: 800, fontSize: '0.75rem',
                                padding: '0.5rem 1.25rem', borderRadius: '0.375rem',
                                letterSpacing: '0.08em', textTransform: 'uppercase',
                                animation: 'glow-pulse 1.5s ease-in-out infinite',
                            }}>
                                ⛔ Decryption Failed: Key Not Found
                            </span>
                        </div>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}

function DataRow({ label, value, color }) {
    return (
        <div>
            <p style={{ fontSize: '0.625rem', color: 'rgba(220,38,38,0.7)', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700, marginBottom: '0.375rem' }}>{label}</p>
            <div style={{
                background: '#0a0a0a', border: '1px solid rgba(220,38,38,0.15)',
                borderRadius: '0.375rem', padding: '0.625rem',
                fontSize: '0.6875rem', color, wordBreak: 'break-all', lineHeight: 1.65,
            }}>
                {value}
            </div>
        </div>
    );
}
