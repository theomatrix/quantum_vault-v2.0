import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import BackgroundOrbs from '../components/BackgroundOrbs';

const fadeUp = (delay = 0) => ({
    initial: { opacity: 0, y: 32 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.6, delay, ease: 'easeOut' },
});

const HOW_IT_WORKS = [
    {
        step: '01',
        color: 'rgba(6,182,212,0.15)',
        textColor: '#06b6d4',
        title: 'Key Encapsulation',
        desc: 'Your data key is encapsulated inside a Kyber-768 mathematical puzzle that quantum computers cannot solve efficiently.',
    },
    {
        step: '02',
        color: 'rgba(139,92,246,0.15)',
        textColor: '#8b5cf6',
        title: 'Hybrid Encryption',
        desc: 'The actual data is locked with AES-256-GCM, while the key is protected by post-quantum algorithms. Best of both worlds.',
    },
    {
        step: '03',
        color: 'rgba(34,197,94,0.15)',
        textColor: '#22c55e',
        title: 'Zero Knowledge',
        desc: 'Your master password never leaves your device. We store only the encrypted ciphertext. We cannot see your data.',
    },
];

const FEATURES = [
    { icon: '🛡️', title: 'Kyber-768', sub: 'NIST PQC Standard', color: '#06b6d4' },
    { icon: '🔒', title: 'AES-256-GCM', sub: 'Military Grade', color: '#8b5cf6' },
    { icon: '🧪', title: 'PBKDF2', sub: 'Key Derivation', color: '#22c55e' },
    { icon: '⚡', title: 'Client-Side', sub: 'Zero Server Trust', color: '#eab308' },
];

export default function LandingPage() {
    return (
        <div style={{ minHeight: '100vh', position: 'relative' }}>
            <BackgroundOrbs />

            <div style={{ position: 'relative', zIndex: 1, paddingTop: '68px' }}>
                {/* Hero */}
                <section style={{
                    minHeight: 'calc(100vh - 68px)',
                    display: 'flex', alignItems: 'center',
                    padding: '4rem 1.5rem',
                    maxWidth: '1280px', margin: '0 auto',
                }}>
                    <div style={{
                        display: 'flex', flexWrap: 'wrap',
                        alignItems: 'center', gap: '4rem',
                        width: '100%',
                    }}>
                        {/* Left content */}
                        <div style={{ flex: '1 1 380px', minWidth: 0 }}>
                            <motion.div {...fadeUp(0.05)}>
                                <span style={{
                                    display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
                                    padding: '0.375rem 0.875rem',
                                    background: 'rgba(6,182,212,0.08)',
                                    border: '1px solid rgba(6,182,212,0.2)',
                                    borderRadius: '9999px',
                                    fontSize: '0.6875rem', fontWeight: 700,
                                    color: 'var(--neon-cyan)', textTransform: 'uppercase', letterSpacing: '0.1em',
                                    marginBottom: '1.5rem',
                                }}>
                                    <span style={{
                                        width: '6px', height: '6px', borderRadius: '50%',
                                        background: 'var(--neon-cyan)',
                                        boxShadow: '0 0 8px var(--neon-cyan)',
                                        animation: 'glow-pulse 2s ease-in-out infinite',
                                    }} />
                                    Post-Quantum Cryptography Ready
                                </span>
                            </motion.div>

                            <motion.h1 {...fadeUp(0.1)} style={{
                                fontSize: 'clamp(2.5rem, 5vw, 4rem)',
                                fontWeight: 900, lineHeight: 1.1,
                                letterSpacing: '-0.03em',
                                marginBottom: '1.5rem',
                            }}>
                                <span className="gradient-text">Secure Your Future</span>
                                <br />
                                <span style={{
                                    color: 'var(--neon-cyan)',
                                    textShadow: '0 0 30px rgba(6,182,212,0.5)',
                                    fontSize: 'clamp(2rem, 4vw, 3.5rem)',
                                }}>
                                    Before It's Decrypted
                                </span>
                            </motion.h1>

                            <motion.p {...fadeUp(0.15)} style={{
                                fontSize: '1.0625rem', color: 'var(--text-secondary)',
                                lineHeight: 1.75, maxWidth: '500px', marginBottom: '2.5rem',
                            }}>
                                The world's first browser-based credential vault secured by{' '}
                                <strong style={{ color: 'var(--text-primary)' }}>Kyber-768</strong> (ML-KEM).
                                Protect your secrets against the quantum threat with military-grade lattice cryptography.
                            </motion.p>

                            <motion.div {...fadeUp(0.2)} style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                                <Link to="/auth" className="btn-primary">
                                    <span>🚀 Launch Vault</span>
                                    <span style={{ transition: 'transform 0.2s' }}>→</span>
                                </Link>
                                <a href="#how-it-works" className="btn-outline">
                                    Learn More
                                </a>
                            </motion.div>
                        </div>

                        {/* Right — floating logo */}
                        <motion.div
                            style={{ flex: '1 1 300px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ duration: 0.8, delay: 0.1, ease: 'easeOut' }}
                        >
                            <div style={{ position: 'relative', textAlign: 'center' }}>
                                {/* Glow rings */}
                                <div style={{
                                    position: 'absolute', inset: '-40px',
                                    borderRadius: '50%',
                                    background: 'radial-gradient(circle, rgba(6,182,212,0.15) 0%, transparent 66%)',
                                    animation: 'orb-float 6s ease-in-out infinite',
                                }} />
                                <div style={{
                                    position: 'absolute', inset: '-60px',
                                    borderRadius: '50%',
                                    border: '1px solid rgba(6,182,212,0.1)',
                                    animation: 'spin-slow 20s linear infinite',
                                }} />

                                <div style={{
                                    width: '200px', height: '200px',
                                    background: 'linear-gradient(135deg, rgba(6,182,212,0.15), rgba(139,92,246,0.15))',
                                    border: '1px solid rgba(6,182,212,0.2)',
                                    borderRadius: '50%',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontSize: '80px',
                                    boxShadow: '0 0 60px rgba(6,182,212,0.2)',
                                    animation: 'float 7s ease-in-out infinite',
                                    position: 'relative', zIndex: 1,
                                }}>
                                    🔐
                                </div>

                                <p style={{
                                    marginTop: '1.5rem',
                                    fontSize: '0.75rem', fontFamily: 'JetBrains Mono, monospace',
                                    color: 'rgba(6,182,212,0.6)', letterSpacing: '0.15em', textTransform: 'uppercase',
                                }}>
                                    Lattice-Based Security
                                </p>
                            </div>
                        </motion.div>
                    </div>
                </section>

                {/* How It Works */}
                <section id="how-it-works" style={{
                    background: 'rgba(0,0,0,0.3)',
                    borderTop: '1px solid var(--glass-border)',
                    borderBottom: '1px solid var(--glass-border)',
                    padding: '6rem 1.5rem',
                }}>
                    <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
                        <motion.h2
                            initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }} transition={{ duration: 0.5 }}
                            style={{
                                fontSize: 'clamp(1.75rem, 3vw, 2.5rem)', fontWeight: 800,
                                textAlign: 'center', marginBottom: '1rem',
                                letterSpacing: '-0.02em',
                            }}
                        >
                            How It Works
                        </motion.h2>
                        <motion.p
                            initial={{ opacity: 0 }} whileInView={{ opacity: 1 }}
                            viewport={{ once: true }} transition={{ delay: 0.1 }}
                            style={{ textAlign: 'center', color: 'var(--text-muted)', marginBottom: '4rem', fontSize: '1.0625rem' }}
                        >
                            Military-grade encryption, built for the post-quantum era
                        </motion.p>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
                            {HOW_IT_WORKS.map((item, i) => (
                                <motion.div
                                    key={item.step}
                                    className="glass glass-hover"
                                    initial={{ opacity: 0, y: 30 }}
                                    whileInView={{ opacity: 1, y: 0 }}
                                    viewport={{ once: true }}
                                    transition={{ duration: 0.5, delay: i * 0.1 }}
                                    style={{
                                        padding: '2rem', borderRadius: '1.25rem',
                                        transition: 'all 0.3s ease',
                                    }}
                                >
                                    <div style={{
                                        width: '48px', height: '48px', borderRadius: '12px',
                                        background: item.color, border: `1px solid ${item.textColor}30`,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        fontSize: '0.875rem', fontWeight: 800,
                                        color: item.textColor, fontFamily: 'JetBrains Mono, monospace',
                                        marginBottom: '1.25rem',
                                    }}>
                                        {item.step}
                                    </div>
                                    <h3 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: '0.75rem', color: 'white' }}>
                                        {item.title}
                                    </h3>
                                    <p style={{ fontSize: '0.9375rem', color: 'var(--text-secondary)', lineHeight: 1.65 }}>
                                        {item.desc}
                                    </p>
                                </motion.div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* Security Features */}
                <section style={{ padding: '6rem 1.5rem' }}>
                    <div style={{ maxWidth: '900px', margin: '0 auto' }}>
                        <motion.h2
                            initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }} transition={{ duration: 0.5 }}
                            style={{
                                fontSize: 'clamp(1.75rem, 3vw, 2.5rem)', fontWeight: 800,
                                textAlign: 'center', marginBottom: '3.5rem',
                                letterSpacing: '-0.02em',
                            }}
                        >
                            Security Features
                        </motion.h2>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                            {FEATURES.map((f, i) => (
                                <motion.div
                                    key={f.title}
                                    className="glass glass-hover"
                                    initial={{ opacity: 0, y: 20 }}
                                    whileInView={{ opacity: 1, y: 0 }}
                                    viewport={{ once: true }}
                                    transition={{ duration: 0.4, delay: i * 0.08 }}
                                    style={{
                                        padding: '1.75rem 1.25rem', borderRadius: '1rem',
                                        textAlign: 'center', transition: 'all 0.3s ease',
                                    }}
                                >
                                    <div style={{
                                        fontSize: '2rem', marginBottom: '0.875rem',
                                        filter: `drop-shadow(0 0 8px ${f.color}80)`,
                                    }}>
                                        {f.icon}
                                    </div>
                                    <h4 style={{
                                        fontWeight: 700, fontSize: '0.9375rem',
                                        marginBottom: '0.375rem', color: 'white',
                                    }}>
                                        {f.title}
                                    </h4>
                                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{f.sub}</p>
                                </motion.div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* Footer CTA */}
                <section style={{
                    padding: '5rem 1.5rem',
                    borderTop: '1px solid var(--glass-border)',
                    textAlign: 'center',
                }}>
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                    >
                        <h2 style={{
                            fontSize: 'clamp(1.5rem, 3vw, 2.25rem)',
                            fontWeight: 800, marginBottom: '1rem', letterSpacing: '-0.02em',
                        }}>
                            Ready to secure your credentials?
                        </h2>
                        <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem', fontSize: '1rem' }}>
                            Protect your digital identity before the quantum era arrives.
                        </p>
                        <Link to="/auth" className="btn-primary">
                            Get Started — It's Free
                        </Link>
                    </motion.div>
                </section>
            </div>
        </div>
    );
}
