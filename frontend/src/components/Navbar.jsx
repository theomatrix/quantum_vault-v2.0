import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useApp } from '../context/AppContext';

export default function Navbar() {
    const { currentUser, logout } = useApp();
    const navigate = useNavigate();

    function handleLogout() {
        logout();
        navigate('/');
    }

    return (
        <nav className="navbar glass">
            <div style={{
                maxWidth: '1280px',
                margin: '0 auto',
                padding: '0 1.5rem',
                height: '68px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
            }}>
                {/* Logo */}
                <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', textDecoration: 'none' }}>
                    <div style={{
                        width: '38px', height: '38px',
                        background: 'linear-gradient(135deg, rgba(6,182,212,0.2), rgba(139,92,246,0.2))',
                        border: '1px solid rgba(6,182,212,0.3)',
                        borderRadius: '10px',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '18px',
                    }}>
                        🔐
                    </div>
                    <span style={{ fontSize: '1.125rem', fontWeight: 800, color: 'white', letterSpacing: '-0.02em' }}>
                        Quantum<span style={{ color: 'var(--neon-cyan)' }}>Vault</span>
                    </span>
                </Link>

                {/* Right side */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <AnimatePresence>
                        {currentUser && (
                            <motion.div
                                key="user-badge"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 20 }}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '0.5rem',
                                    padding: '0.375rem 0.875rem',
                                    background: 'rgba(6,182,212,0.08)',
                                    border: '1px solid rgba(6,182,212,0.2)',
                                    borderRadius: '9999px',
                                }}
                            >
                                <span style={{
                                    width: '7px', height: '7px', borderRadius: '50%',
                                    background: 'var(--neon-green)',
                                    boxShadow: '0 0 6px var(--neon-green)',
                                    animation: 'glow-pulse 2s ease-in-out infinite',
                                }} />
                                <span style={{
                                    fontSize: '0.8125rem', fontFamily: 'JetBrains Mono, monospace',
                                    color: 'var(--neon-cyan)', fontWeight: 600,
                                }}>
                                    {currentUser}
                                </span>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    <AnimatePresence>
                        {currentUser && (
                            <motion.button
                                key="logout-btn"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                onClick={handleLogout}
                                style={{
                                    background: 'none', border: 'none',
                                    color: 'var(--text-muted)', cursor: 'pointer',
                                    fontSize: '0.875rem', fontWeight: 500,
                                    padding: '0.375rem 0.625rem', borderRadius: '0.5rem',
                                    transition: 'color 0.2s ease',
                                    fontFamily: 'Inter, sans-serif',
                                }}
                                onMouseEnter={e => e.target.style.color = 'white'}
                                onMouseLeave={e => e.target.style.color = 'var(--text-muted)'}
                            >
                                Logout →
                            </motion.button>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </nav>
    );
}
