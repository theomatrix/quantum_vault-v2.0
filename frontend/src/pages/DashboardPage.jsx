import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useApp } from '../context/AppContext';
import { useToast } from '../context/ToastContext';
import { getVault } from '../lib/api';
import CredentialCard from '../components/CredentialCard';
import AddCredentialModal from '../components/AddCredentialModal';
import ViewCredentialModal from '../components/ViewCredentialModal';
import HackerModal from '../components/HackerModal';

const CATEGORIES = ['all', 'Social', 'Finance', 'Work', 'Personal'];

export default function DashboardPage() {
    const { currentUser } = useApp();
    const { showToast } = useToast();
    const navigate = useNavigate();

    const [vault, setVault] = useState([]);
    const [filter, setFilter] = useState('all');
    const [hackerMode, setHackerMode] = useState(false);
    const [loading, setLoading] = useState(true);

    // Modal states
    const [showAdd, setShowAdd] = useState(false);
    const [selectedItem, setSelectedItem] = useState(null);
    const [hackerItem, setHackerItem] = useState(null);

    // Redirect if not logged in
    useEffect(() => {
        if (!currentUser) navigate('/');
    }, [currentUser, navigate]);

    const loadVault = useCallback(async () => {
        if (!currentUser) return;
        try {
            const data = await getVault(currentUser);
            setVault(data.vault);
        } catch {
            showToast('Failed to load vault', 'error');
        } finally {
            setLoading(false);
        }
    }, [currentUser, showToast]);

    useEffect(() => { loadVault(); }, [loadVault]);

    const filtered = filter === 'all'
        ? vault
        : vault.filter(v => (v.category || 'Personal') === filter);

    function handleCardClick(item) {
        if (hackerMode) {
            setHackerItem(item);
        } else {
            setSelectedItem(item);
        }
    }

    return (
        <div style={{
            minHeight: '100vh', paddingTop: '68px',
            position: 'relative',
        }}>
            <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '2.5rem 1.5rem' }}>

                {/* Header */}
                <motion.div
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    style={{
                        display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between',
                        alignItems: 'center', gap: '1.5rem', marginBottom: '2.5rem',
                    }}
                >
                    <div>
                        <h1 style={{ fontSize: 'clamp(1.75rem, 3vw, 2.25rem)', fontWeight: 900, letterSpacing: '-0.03em', marginBottom: '0.25rem' }}>
                            My Vault
                        </h1>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.9375rem' }}>
                            Secured by Lattice-Based Cryptography
                        </p>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
                        {/* Category filter */}
                        <select
                            value={filter}
                            onChange={e => setFilter(e.target.value)}
                            style={{
                                background: 'rgba(15,23,42,0.7)',
                                border: '1px solid var(--glass-border)',
                                color: 'var(--text-secondary)',
                                borderRadius: '0.75rem', padding: '0.5rem 0.875rem',
                                fontSize: '0.875rem', outline: 'none', cursor: 'pointer',
                                fontFamily: 'Inter, sans-serif',
                                transition: 'border-color 0.2s',
                            }}
                        >
                            {CATEGORIES.map(c => (
                                <option key={c} value={c} style={{ background: '#0f172a' }}>
                                    {c === 'all' ? 'All Categories' : c}
                                </option>
                            ))}
                        </select>

                        {/* Divider */}
                        <div style={{ width: '1px', height: '28px', background: 'var(--glass-border)' }} />

                        {/* Hacker toggle */}
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', cursor: 'pointer' }}>
                            <div
                                onClick={() => {
                                    setHackerMode(h => {
                                        if (!h) showToast('🕵️ Hacker Mode — viewing raw encrypted data');
                                        return !h;
                                    });
                                }}
                                style={{
                                    width: '44px', height: '24px',
                                    background: hackerMode ? '#dc2626' : 'rgba(255,255,255,0.1)',
                                    borderRadius: '9999px', position: 'relative', cursor: 'pointer',
                                    transition: 'background 0.3s ease',
                                    border: '1px solid transparent',
                                    borderColor: hackerMode ? '#dc2626' : 'var(--glass-border)',
                                }}
                            >
                                <div style={{
                                    position: 'absolute', top: '2px',
                                    left: hackerMode ? '22px' : '2px',
                                    width: '18px', height: '18px',
                                    background: 'white', borderRadius: '50%',
                                    transition: 'left 0.3s ease',
                                    boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
                                }} />
                            </div>
                            <span style={{ fontSize: '0.875rem', color: hackerMode ? '#f87171' : 'var(--text-secondary)', fontWeight: 500 }}>
                                {hackerMode ? '🕵️ Hacker View' : 'Hacker View'}
                            </span>
                        </label>

                        {/* Divider */}
                        <div style={{ width: '1px', height: '28px', background: 'var(--glass-border)' }} />

                        {/* Security Insights button */}
                        <button
                            onClick={() => navigate('/security')}
                            className="btn-outline"
                            style={{ padding: '0.625rem 1.125rem', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                        >
                            🛡️ Security Insights
                        </button>

                        {/* Add button */}
                        <button
                            onClick={() => setShowAdd(true)}
                            className="btn-primary"
                            style={{ padding: '0.625rem 1.25rem', fontSize: '0.9375rem' }}
                        >
                            + Add Credential
                        </button>
                    </div>
                </motion.div>

                {/* Stats bar */}
                {vault.length > 0 && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.1 }}
                        className="glass"
                        style={{
                            display: 'flex', flexWrap: 'wrap', gap: '1.5rem',
                            padding: '1rem 1.5rem', borderRadius: '1rem',
                            marginBottom: '2rem',
                        }}
                    >
                        <Stat label="Total Credentials" value={vault.length} color="var(--neon-cyan)" />
                        {['Social', 'Finance', 'Work', 'Personal'].map(c => {
                            const count = vault.filter(v => (v.category || 'Personal') === c).length;
                            if (!count) return null;
                            return <Stat key={c} label={c} value={count} color="var(--text-muted)" />;
                        })}
                    </motion.div>
                )}

                {/* Vault Grid */}
                {loading ? (
                    <div style={{ textAlign: 'center', padding: '5rem', color: 'var(--text-muted)' }}>
                        <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>⚙️</div>
                        <p>Loading vault…</p>
                    </div>
                ) : filtered.length === 0 ? (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        style={{ textAlign: 'center', padding: '6rem 1.5rem', color: 'var(--text-muted)' }}
                    >
                        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📭</div>
                        <p style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>
                            {filter !== 'all' ? `No ${filter} credentials` : 'Vault is Empty'}
                        </p>
                        <p style={{ fontSize: '0.9375rem' }}>
                            {filter !== 'all' ? 'Try another category or add a new one.' : 'Add your first quantum-safe credential.'}
                        </p>
                    </motion.div>
                ) : (
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                        gap: '1.25rem',
                    }}>
                        <AnimatePresence mode="popLayout">
                            {filtered.map((item, i) => (
                                <CredentialCard
                                    key={item.id}
                                    item={item}
                                    index={i}
                                    hackerMode={hackerMode}
                                    onClick={() => handleCardClick(item)}
                                />
                            ))}
                        </AnimatePresence>
                    </div>
                )}
            </div>

            {/* Modals */}
            {showAdd && (
                <AddCredentialModal
                    onClose={() => setShowAdd(false)}
                    onAdded={loadVault}
                />
            )}
            {selectedItem && (
                <ViewCredentialModal
                    item={selectedItem}
                    onClose={() => setSelectedItem(null)}
                    onDeleted={loadVault}
                />
            )}
            {hackerItem && (
                <HackerModal
                    item={hackerItem}
                    onClose={() => setHackerItem(null)}
                />
            )}
        </div>
    );
}

function Stat({ label, value, color }) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.125rem' }}>
            <span style={{ fontSize: '1.25rem', fontWeight: 800, color, lineHeight: 1 }}>{value}</span>
            <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</span>
        </div>
    );
}
