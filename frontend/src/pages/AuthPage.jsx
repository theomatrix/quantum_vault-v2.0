import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { MlKem768 } from 'crystals-kyber-js';

import { useApp } from '../context/AppContext';
import { useToast } from '../context/ToastContext';
import {
    generateSalt, deriveMasterKey, toHex, fromHex,
    encryptAES, decryptAES,
} from '../lib/crypto';
import { registerUser, loginUser } from '../lib/api';
import BackgroundOrbs from '../components/BackgroundOrbs';

export default function AuthPage() {
    const [isRegistering, setIsRegistering] = useState(false);
    const [loading, setLoading] = useState(false);
    const usernameRef = useRef(null);
    const passwordRef = useRef(null);

    const { setUser } = useApp();
    const { showToast } = useToast();
    const navigate = useNavigate();

    async function handleSubmit(e) {
        e.preventDefault();
        const username = usernameRef.current.value.trim();
        const password = passwordRef.current.value;

        if (!username || !password) {
            showToast('Please fill all fields', 'error');
            return;
        }

        setLoading(true);
        try {
            if (isRegistering) {
                await handleRegister(username, password);
            } else {
                await handleLogin(username, password);
            }
        } finally {
            setLoading(false);
        }
    }

    async function handleRegister(username, password) {
        const salt = generateSalt();
        const masterKey = await deriveMasterKey(password, salt);

        const kyber = new MlKem768();
        const [pk, sk] = await kyber.generateKeyPair();

        const skHex = toHex(sk);
        const encSK = await encryptAES(masterKey, skHex);

        const payload = {
            username,
            salt: toHex(salt),
            enc_sk: encSK,
            pk: toHex(pk),
        };

        const data = await registerUser(payload);
        if (data.status === 'success') {
            showToast('Account created! You can now login.');
            setIsRegistering(false);
        } else {
            showToast('Error: ' + (data.detail ?? 'Registration failed'), 'error');
        }
    }

    async function handleLogin(username, password) {
        const data = await loginUser(username);

        const salt = fromHex(data.salt);
        const masterKey = await deriveMasterKey(password, salt);

        let skHex;
        try {
            skHex = await decryptAES(masterKey, data.enc_sk);
        } catch {
            showToast('Login failed. Check your credentials.', 'error');
            return;
        }

        const kyberSK = fromHex(skHex);
        const kyberPK = fromHex(data.pk);

        setUser({ username, masterKey, kyberPK, kyberSK, salt });
        navigate('/dashboard');
    }

    return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', paddingTop: '68px', padding: '5rem 1.5rem 2rem' }}>
            <BackgroundOrbs />

            <motion.div
                key={isRegistering ? 'register' : 'login'}
                initial={{ opacity: 0, y: 24, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -24, scale: 0.97 }}
                transition={{ duration: 0.4, ease: 'easeOut' }}
                style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: '440px' }}
            >
                <div className="glass" style={{
                    borderRadius: '1.5rem',
                    overflow: 'hidden',
                    boxShadow: '0 24px 80px rgba(0,0,0,0.5)',
                }}>
                    {/* Top accent line */}
                    <div style={{
                        height: '3px',
                        background: 'linear-gradient(90deg, transparent, var(--neon-cyan), var(--neon-purple), transparent)',
                    }} />

                    <div style={{ padding: '2.5rem' }}>
                        {/* Header */}
                        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                            <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>
                                {isRegistering ? '🛡️' : '🔐'}
                            </div>
                            <h1 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '0.375rem', letterSpacing: '-0.02em' }}>
                                {isRegistering ? 'Create New Vault' : 'Access Vault'}
                            </h1>
                            <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                                Authenticate with your quantum identity
                            </p>
                        </div>

                        {/* Form */}
                        <form onSubmit={handleSubmit}>
                            <div style={{ marginBottom: '1rem' }}>
                                <label className="form-label">Username</label>
                                <input
                                    ref={usernameRef}
                                    type="text"
                                    className="form-input"
                                    placeholder="Enter your ID"
                                    autoFocus
                                />
                            </div>

                            <div style={{ marginBottom: '1.5rem' }}>
                                <label className="form-label">Master Password</label>
                                <input
                                    ref={passwordRef}
                                    type="password"
                                    className="form-input"
                                    placeholder="••••••••••••"
                                />
                            </div>

                            {/* Registration notice */}
                            <AnimatePresence>
                                {isRegistering && (
                                    <motion.div
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: 'auto' }}
                                        exit={{ opacity: 0, height: 0 }}
                                        style={{
                                            marginBottom: '1.25rem', overflow: 'hidden',
                                            background: 'rgba(234,179,8,0.08)',
                                            border: '1px solid rgba(234,179,8,0.2)',
                                            borderRadius: '0.75rem', padding: '0.875rem',
                                        }}
                                    >
                                        <div style={{ display: 'flex', gap: '0.625rem', alignItems: 'flex-start' }}>
                                            <span style={{
                                                width: '7px', height: '7px', borderRadius: '50%',
                                                background: '#eab308', flexShrink: 0, marginTop: '5px',
                                                boxShadow: '0 0 6px #eab308',
                                                animation: 'glow-pulse 2s ease-in-out infinite',
                                            }} />
                                            <p style={{ fontSize: '0.8125rem', color: '#fef08a', lineHeight: 1.55 }}>
                                                <strong>Generating Kyber-768 Keys:</strong> Your device will create a post-quantum key pair. This may take a moment.
                                            </p>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            <button
                                type="submit"
                                className="btn-primary"
                                disabled={loading}
                                style={{ width: '100%' }}
                            >
                                {loading
                                    ? (isRegistering ? '⚙️ Generating Keys…' : '⚙️ Decrypting…')
                                    : (isRegistering ? '🛡️ Create Quantum Account' : '🔓 Login')}
                            </button>
                        </form>

                        <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
                            <button
                                onClick={() => setIsRegistering(r => !r)}
                                style={{
                                    background: 'none', border: 'none',
                                    color: 'var(--text-muted)', cursor: 'pointer',
                                    fontSize: '0.875rem', fontFamily: 'Inter, sans-serif',
                                    transition: 'color 0.2s',
                                }}
                                onMouseEnter={e => e.target.style.color = 'var(--neon-cyan)'}
                                onMouseLeave={e => e.target.style.color = 'var(--text-muted)'}
                            >
                                {isRegistering ? 'Already have an account? Login →' : 'New user? Create an account →'}
                            </button>
                        </div>
                    </div>
                </div>
            </motion.div>
        </div>
    );
}
