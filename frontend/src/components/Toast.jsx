import { AnimatePresence, motion } from 'framer-motion';
import { useToast } from '../context/ToastContext';

const ICONS = {
    success: '✓',
    error: '✕',
    info: 'ℹ',
};

export default function Toast() {
    const { toasts } = useToast();

    return (
        <div className="toast-wrapper">
            <AnimatePresence>
                {toasts.map(t => (
                    <motion.div
                        key={t.id}
                        className={`toast ${t.type}`}
                        initial={{ opacity: 0, y: 30, scale: 0.9 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                    >
                        <span style={{
                            width: '20px', height: '20px',
                            borderRadius: '50%',
                            background: t.type === 'error' ? 'rgba(239,68,68,0.2)' : t.type === 'info' ? 'rgba(139,92,246,0.2)' : 'rgba(6,182,212,0.2)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '11px', fontWeight: 700, flexShrink: 0,
                            color: t.type === 'error' ? 'var(--neon-red)' : t.type === 'info' ? 'var(--neon-purple)' : 'var(--neon-cyan)',
                        }}>
                            {ICONS[t.type] ?? '●'}
                        </span>
                        <span style={{ fontSize: '0.875rem', lineHeight: 1.4 }}>{t.message}</span>
                    </motion.div>
                ))}
            </AnimatePresence>
        </div>
    );
}
