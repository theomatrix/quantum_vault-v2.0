export default function BackgroundOrbs() {
    return (
        <div style={{
            position: 'fixed', inset: 0,
            pointerEvents: 'none', zIndex: 0, overflow: 'hidden',
        }}>
            {/* Cyan orb */}
            <div style={{
                position: 'absolute',
                top: '15%', left: '10%',
                width: '500px', height: '500px',
                background: 'radial-gradient(circle, rgba(6,182,212,0.09) 0%, transparent 70%)',
                borderRadius: '50%',
                animation: 'orb-float 9s ease-in-out infinite',
            }} />

            {/* Purple orb */}
            <div style={{
                position: 'absolute',
                bottom: '10%', right: '8%',
                width: '450px', height: '450px',
                background: 'radial-gradient(circle, rgba(139,92,246,0.09) 0%, transparent 70%)',
                borderRadius: '50%',
                animation: 'orb-float 11s ease-in-out infinite reverse',
            }} />

            {/* Subtle grid */}
            <div style={{
                position: 'absolute', inset: 0,
                backgroundImage: `
          linear-gradient(rgba(255,255,255,0.018) 1px, transparent 1px),
          linear-gradient(90deg, rgba(255,255,255,0.018) 1px, transparent 1px)
        `,
                backgroundSize: '60px 60px',
                maskImage: 'radial-gradient(ellipse 80% 80% at 50% 50%, black 40%, transparent 100%)',
            }} />
        </div>
    );
}
