import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MlKem768 } from 'crystals-kyber-js';
import { useApp } from '../context/AppContext';
import { useToast } from '../context/ToastContext';
import { encryptAES, toHex, calcPasswordStrength } from '../lib/crypto';
import { addCredential as apiAddCredential } from '../lib/api';

const CATEGORIES = ['Social', 'Finance', 'Work', 'Personal'];

export default function AddCredentialModal({ onClose, onAdded }) {
    const [category, setCategory] = useState('Personal');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const siteRef = useRef();
    const userRef = useRef();
    const notesRef = useRef();

    const { kyberPK, currentUser } = useApp();
    const { showToast } = useToast();

    const strength = calcPasswordStrength(password);

    async function handleSave() {
        const site = siteRef.current.value.trim();
        const user = userRef.current.value.trim();
        const notes = notesRef.current.value.trim();

        if (!site || !password) {
            showToast('Service name and password are required', 'error');
            return;
        }

        setLoading(true);
        try {
            const plaintext = JSON.stringify({ site, username: user, password, notes, category });
            const kyber = new MlKem768();
            const [ciphertext, sharedSecret] = await kyber.encap(kyberPK);

            const fileKey = await window.crypto.subtle.importKey(
                'raw', sharedSecret, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']
            );
            const encContent = await encryptAES(fileKey, plaintext);

            const payload = {
                id: crypto.randomUUID(),
                site,
                category,
                ciphertext: toHex(ciphertext),
                content: encContent,
            };

            await apiAddCredential(currentUser, payload);
            showToast('🔐 Credential encrypted & stored!');
            onAdded();
            onClose();
        } catch (err) {
            showToast('Failed: ' + err.message, 'error');
        } finally {
            setLoading(false);
        }
    }

    return (
        <AnimatePresence>
            <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
                <motion.div
                    initial={{ opacity: 0, scale: 0.92, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.92, y: 20 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                    className="glass"
                    style={{
                        width: '100%', maxWidth: '460px',
                        borderRadius: '1.5rem', overflow: 'hidden',
                        boxShadow: '0 32px 80px rgba(0,0,0,0.6)',
                    }}
                >
                    {/* Top bar */}
                    <div style={{ height: '3px', background: 'linear-gradient(90deg, transparent, var(--neon-cyan), var(--neon-purple), transparent)' }} />

                    <div style={{ padding: '2rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.75rem' }}>
                            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, letterSpacing: '-0.02em' }}>Store New Credential</h2>
                            <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1.25rem', lineHeight: 1 }}>✕</button>
                        </div>

                        <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem' }}>
                            <div style={{ flex: 1 }}>
                                <label className="form-label">Service Name</label>
                                <input ref={siteRef} type="text" className="form-input" placeholder="e.g. Google" />
                            </div>
                            <div style={{ flexShrink: 0 }}>
                                <label className="form-label">Category</label>
                                <select
                                    value={category}
                                    onChange={e => setCategory(e.target.value)}
                                    className="form-input"
                                    style={{ width: 'auto', paddingRight: '0.5rem' }}
                                >
                                    {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                                </select>
                            </div>
                        </div>

                        <div style={{ marginBottom: '1rem' }}>
                            <label className="form-label">Username / Email</label>
                            <input ref={userRef} type="text" className="form-input" placeholder="user@example.com" />
                        </div>

                        <div style={{ marginBottom: '1rem' }}>
                            <label className="form-label">Password</label>
                            <input
                                type="password"
                                className="form-input"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                placeholder="••••••••••••"
                            />
                            {/* Strength meter */}
                            <div style={{ marginTop: '0.5rem', height: '3px', background: 'rgba(255,255,255,0.05)', borderRadius: '2px', overflow: 'hidden' }}>
                                <div style={{
                                    height: '100%', width: strength.width,
                                    background: strength.color,
                                    boxShadow: `0 0 8px ${strength.color}`,
                                    borderRadius: '2px',
                                    transition: 'all 0.3s ease',
                                }} />
                            </div>
                            <p style={{ textAlign: 'right', fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: '0.25rem', fontFamily: 'JetBrains Mono, monospace' }}>
                                Strength: <span style={{ color: strength.color }}>{strength.label}</span>
                            </p>
                        </div>

                        <div style={{ marginBottom: '1.75rem' }}>
                            <label className="form-label">Secure Notes (Optional)</label>
                            <textarea
                                ref={notesRef}
                                className="form-input"
                                placeholder="Any additional notes…"
                                style={{ height: '90px', resize: 'none' }}
                            />
                        </div>

                        <div style={{ display: 'flex', gap: '0.75rem' }}>
                            <button onClick={onClose} className="btn-outline" style={{ flex: 1 }}>Cancel</button>
                            <button onClick={handleSave} className="btn-primary" disabled={loading} style={{ flex: 1 }}>
                                {loading ? '🔒 Encrypting…' : '🔐 Encrypt & Save'}
                            </button>
                        </div>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
