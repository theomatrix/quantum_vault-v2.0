import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MlKem768 } from 'crystals-kyber-js';
import { useApp } from '../context/AppContext';
import { useToast } from '../context/ToastContext';
import { fromHex, decryptAES, deriveMasterKey, toHex } from '../lib/crypto';
import { deleteCredential as apiDelCred } from '../lib/api';

export default function ViewCredentialModal({ item, onClose, onDeleted }) {
    const [revealState, setRevealState] = useState('hidden'); // 'hidden'|'verify'|'shown'
    const [verifyPwd, setVerifyPwd] = useState('');
    const [notesShown, setNotesShown] = useState(false);
    const [verifying, setVerifying] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [cred, setCred] = useState(null);

    const { kyberSK, masterKey, currentUser, currentUserSalt } = useApp();
    const { showToast } = useToast();

    // Decrypt once when modal opens
    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const kyber = new MlKem768();
                const secret = await kyber.decap(fromHex(item.ciphertext), kyberSK);
                const fileKey = await window.crypto.subtle.importKey(
                    'raw', secret, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']
                );
                const json = await decryptAES(fileKey, item.content);
                if (!cancelled) setCred(JSON.parse(json));
            } catch (err) {
                if (!cancelled) {
                    showToast('Decryption failed: ' + err.message, 'error');
                    onClose();
                }
            }
        })();
        return () => { cancelled = true; };
    }, [item, kyberSK]); // eslint-disable-line

    async function verifyPassword() {
        if (!verifyPwd) return;
        setVerifying(true);
        try {
            const checkKey = await deriveMasterKey(verifyPwd, currentUserSalt);
            const rawM = await window.crypto.subtle.exportKey('raw', masterKey);
            const rawC = await window.crypto.subtle.exportKey('raw', checkKey);
            if (toHex(rawM) === toHex(rawC)) {
                setRevealState('shown');
                setNotesShown(true);
                setVerifyPwd('');
            } else {
                showToast('Incorrect master password', 'error');
                setVerifyPwd('');
            }
        } catch {
            showToast('Verification error', 'error');
        } finally {
            setVerifying(false);
        }
    }

    async function handleDelete() {
        if (!window.confirm(`Delete credential for "${cred?.site}"? This cannot be undone.`)) return;
        setDeleting(true);
        try {
            await apiDelCred(currentUser, item.id);
            showToast('Credential deleted');
            onDeleted();
            onClose();
        } catch {
            showToast('Delete failed', 'error');
        } finally {
            setDeleting(false);
        }
    }

    function hide() {
        setRevealState('hidden');
        setNotesShown(false);
        setVerifyPwd('');
    }

    return (
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
                <div style={{ height: '3px', background: 'linear-gradient(90deg, transparent, var(--neon-cyan), var(--neon-purple), transparent)' }} />

                <div style={{ padding: '2rem' }}>
                    {/* Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <div style={{
                                width: '42px', height: '42px', borderRadius: '12px',
                                background: 'linear-gradient(135deg, rgba(6,182,212,0.2), rgba(139,92,246,0.2))',
                                border: '1px solid rgba(6,182,212,0.2)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '1.25rem', fontWeight: 800, color: 'var(--neon-cyan)',
                            }}>
                                {cred?.site?.charAt(0)?.toUpperCase() ?? '?'}
                            </div>
                            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
                                {cred?.site ?? '…'}
                            </h2>
                        </div>
                        <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1.25rem', lineHeight: 1 }}>✕</button>
                    </div>

                    {!cred ? (
                        <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>⚙️</div>
                            <p style={{ fontSize: '0.875rem' }}>Decrypting…</p>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
                            {/* Username */}
                            <Field label="Username">
                                <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.9375rem', userSelect: 'all' }}>
                                    {cred.username || '—'}
                                </span>
                            </Field>

                            {/* Password */}
                            <Field label="Password">
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                                    <span style={{
                                        fontFamily: 'JetBrains Mono, monospace',
                                        color: revealState === 'shown' ? '#4ade80' : 'var(--neon-cyan)',
                                        fontSize: revealState === 'shown' ? '0.9375rem' : '1.125rem',
                                        userSelect: revealState === 'shown' ? 'all' : 'none',
                                        letterSpacing: revealState === 'shown' ? 'normal' : '0.15em',
                                    }}>
                                        {revealState === 'shown' ? cred.password : '••••••••'}
                                    </span>

                                    {revealState === 'hidden' && (
                                        <button
                                            onClick={() => setRevealState('verify')}
                                            style={{
                                                background: 'rgba(255,255,255,0.06)', border: '1px solid var(--glass-border)',
                                                color: 'var(--text-secondary)', borderRadius: '0.375rem',
                                                padding: '0.25rem 0.625rem', fontSize: '0.75rem',
                                                cursor: 'pointer', fontFamily: 'Inter, sans-serif', flexShrink: 0,
                                                transition: 'all 0.2s',
                                            }}
                                        >
                                            Reveal
                                        </button>
                                    )}
                                    {revealState === 'shown' && (
                                        <button onClick={hide} style={{
                                            background: 'rgba(255,255,255,0.06)', border: '1px solid var(--glass-border)',
                                            color: 'var(--text-secondary)', borderRadius: '0.375rem',
                                            padding: '0.25rem 0.625rem', fontSize: '0.75rem',
                                            cursor: 'pointer', fontFamily: 'Inter, sans-serif', flexShrink: 0,
                                        }}>
                                            Hide
                                        </button>
                                    )}
                                </div>

                                {/* Verify input */}
                                <AnimatePresence>
                                    {revealState === 'verify' && (
                                        <motion.div
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: 'auto', opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            style={{ overflow: 'hidden', marginTop: '0.625rem' }}
                                        >
                                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                <input
                                                    type="password"
                                                    className="form-input"
                                                    value={verifyPwd}
                                                    onChange={e => setVerifyPwd(e.target.value)}
                                                    onKeyDown={e => e.key === 'Enter' && verifyPassword()}
                                                    placeholder="Master password…"
                                                    autoFocus
                                                    style={{ fontSize: '0.875rem' }}
                                                />
                                                <button
                                                    onClick={verifyPassword}
                                                    disabled={verifying}
                                                    className="btn-primary"
                                                    style={{ flexShrink: 0, padding: '0 1rem', fontSize: '0.8125rem' }}
                                                >
                                                    {verifying ? '…' : 'Verify'}
                                                </button>
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </Field>

                            {/* Notes */}
                            <Field label="Secure Notes">
                                {notesShown || !cred.notes ? (
                                    <p style={{
                                        fontSize: '0.875rem',
                                        color: cred.notes ? 'var(--text-primary)' : 'var(--text-muted)',
                                        fontStyle: cred.notes ? 'normal' : 'italic',
                                        whiteSpace: 'pre-wrap',
                                        fontFamily: 'JetBrains Mono, monospace',
                                        lineHeight: 1.6,
                                    }}>
                                        {cred.notes || 'No notes added.'}
                                    </p>
                                ) : (
                                    <div
                                        onClick={() => {
                                            if (revealState !== 'shown') {
                                                setRevealState('verify');
                                                showToast('Verify master password to view notes', 'info');
                                            } else {
                                                setNotesShown(true);
                                            }
                                        }}
                                        style={{
                                            textAlign: 'center', padding: '1rem',
                                            cursor: 'pointer', color: 'var(--neon-cyan)',
                                            fontSize: '0.8125rem', fontWeight: 600,
                                            border: '1px dashed rgba(6,182,212,0.2)',
                                            borderRadius: '0.5rem', transition: 'all 0.2s',
                                        }}
                                    >
                                        🔒 Click to reveal notes
                                    </div>
                                )}
                            </Field>

                            {/* Kyber info */}
                            <Field label="Kyber-768 Encapsulation">
                                <p style={{
                                    fontSize: '0.625rem', color: 'var(--text-muted)',
                                    fontFamily: 'JetBrains Mono, monospace',
                                    wordBreak: 'break-all', lineHeight: 1.65,
                                }}>
                                    {item.ciphertext.slice(0, 64)}… [Truncated]
                                </p>
                            </Field>

                            {/* Footer */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '0.875rem', borderTop: '1px solid var(--glass-border)', marginTop: '0.125rem' }}>
                                <p style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace' }}>
                                    Quantum-Resistant AES-256-GCM
                                </p>
                                <button onClick={handleDelete} className="btn-danger" disabled={deleting}>
                                    🗑 {deleting ? 'Deleting…' : 'Delete'}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </motion.div>
        </div>
    );
}

function Field({ label, children }) {
    return (
        <div style={{
            background: 'rgba(15,23,42,0.6)',
            border: '1px solid var(--glass-border)',
            borderRadius: '0.75rem', padding: '0.875rem',
        }}>
            <p style={{
                fontSize: '0.6875rem', fontWeight: 700, color: 'var(--text-muted)',
                textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.5rem',
            }}>
                {label}
            </p>
            {children}
        </div>
    );
}
