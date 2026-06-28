import type {Metadata} from 'next';
import './globals.css'; // Global styles

export const metadata: Metadata = {
  title: 'MM12TW - Controle de Área de Lazer',
  description: 'Aplicativo de controle para área de lazer Master Lazer. Gerenciamento de motores, timers de filtragem e automação de iluminação LED.',
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="pt-BR" className="w-full min-h-screen overflow-y-auto overscroll-behavior-none select-none">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#020617" />
        <link rel="apple-touch-icon" href="/180x180.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              window.addEventListener('error', function(e) {
                if (e && (e.message === 'Script error.' || (e.error && e.error.message === 'Script error.'))) {
                  e.stopImmediatePropagation();
                  e.preventDefault();
                }
              }, true);
              window.addEventListener('unhandledrejection', function(e) {
                if (e && e.reason && (e.reason.message === 'Script error.' || String(e.reason).includes('Script error'))) {
                  e.stopImmediatePropagation();
                  e.preventDefault();
                }
              }, true);

              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js').then(function(reg) {
                    console.log('PWA Service Worker registered successfully:', reg.scope);
                  }).catch(function(err) {
                    console.warn('PWA Service Worker registration failed:', err);
                  });
                });
              }
            `,
          }}
        />
      </head>
      <body suppressHydrationWarning className="bg-slate-950 w-full min-h-screen text-slate-100 flex items-center justify-center relative overflow-y-auto overscroll-behavior-none font-sans antialiased">
        {/* Inline CSS & HTML Splash Screen for instant rendering */}
        <style dangerouslySetInnerHTML={{ __html: `
          @keyframes ripple {
            0% { transform: scale(0.85); opacity: 0.3; }
            50% { opacity: 0.8; }
            100% { transform: scale(1.25); opacity: 0; }
          }
          @keyframes pulse-slow {
            0%, 100% { transform: scale(1); opacity: 0.9; filter: drop-shadow(0 0 15px rgba(67, 152, 250, 0.5)); }
            50% { transform: scale(1.04); opacity: 1; filter: drop-shadow(0 0 25px rgba(67, 152, 250, 0.8)); }
          }
          @keyframes spin-slow {
            to { transform: rotate(360deg); }
          }
          .ripple-ring-1 {
            position: absolute;
            border: 2px solid rgba(67, 152, 250, 0.25);
            border-radius: 50%;
            width: 140px;
            height: 140px;
            animation: ripple 2s infinite ease-out;
          }
          .ripple-ring-2 {
            position: absolute;
            border: 2px solid rgba(16, 185, 129, 0.2);
            border-radius: 50%;
            width: 140px;
            height: 140px;
            animation: ripple 2.5s infinite ease-out 0.8s;
          }
          .spin-indicator {
            width: 20px;
            height: 20px;
            border: 2px solid rgba(67, 152, 250, 0.15);
            border-top-color: #4398fa;
            border-radius: 50%;
            animation: spin-slow 1s linear infinite;
          }
        `}} />

        <div id="pwa-splash-screen" style={{
          position: 'fixed',
          inset: 0,
          width: '100vw',
          height: '100vh',
          backgroundColor: '#020617',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 999999,
          fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          color: '#f8fafc',
          overflow: 'hidden',
          pointerEvents: 'none',
          transition: 'opacity 0.6s cubic-bezier(0.4, 0, 0.2, 1)'
        }}>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '200px', height: '200px' }}>
            <div className="ripple-ring-1"></div>
            <div className="ripple-ring-2"></div>
            
            <div style={{ position: 'absolute', width: '120px', height: '120px', borderRadius: '50%', border: '1.5px dashed rgba(67, 152, 250, 0.3)', animation: 'spin-slow 15s linear infinite' }}></div>

            <div style={{ position: 'absolute', width: '84px', height: '84px', background: 'radial-gradient(circle, rgba(30,41,59,0.95) 0%, rgba(15,23,42,0.98) 100%)', border: '1.5px solid rgba(67, 152, 250, 0.4)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'pulse-slow 3s infinite ease-in-out', boxShadow: '0 0 20px rgba(67, 152, 250, 0.2)' }}>
              {/* Glowing Wave Logo */}
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#4398fa" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2 10a4 4 0 0 1 7.5-2" />
                <path d="M9 10a4 4 0 0 1 7.5-2" />
                <path d="M16 10a4 4 0 0 1 7.5-2" />
                <path d="M2 14a4 4 0 0 1 7.5-2" />
                <path d="M9 14a4 4 0 0 1 7.5-2" />
                <path d="M16 14a4 4 0 0 1 7.5-2" />
                <path d="M2 18a4 4 0 0 1 7.5-2" />
                <path d="M9 18a4 4 0 0 1 7.5-2" />
                <path d="M16 18a4 4 0 0 1 7.5-2" />
              </svg>
            </div>
          </div>

          <div style={{ textAlign: 'center', marginTop: '24px', zIndex: 10 }}>
            <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 800, letterSpacing: '4px', background: 'linear-gradient(135deg, #ffffff 40%, #a5f3fc 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', textShadow: '0 0 20px rgba(67,152,250,0.3)' }}>
              MASTER LAZER
            </h1>
            <p style={{ margin: '6px 0 0 0', fontSize: '10px', fontWeight: 700, letterSpacing: '3px', color: '#94a3b8', textTransform: 'uppercase' }}>
              Automação de Piscina
            </p>
          </div>

          <div style={{ position: 'absolute', bottom: '60px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
            <div className="spin-indicator"></div>
            <span style={{ fontSize: '10px', letterSpacing: '2px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Iniciando...</span>
          </div>
        </div>

        {/* Background Mesh Gradients */}
        <div className="absolute top-[-100px] left-[-100px] w-[500px] h-[500px] bg-blue-600/20 rounded-full blur-[120px] pointer-events-none"></div>
        <div className="absolute bottom-[-100px] right-[-100px] w-[600px] h-[600px] bg-orange-600/10 rounded-full blur-[120px] pointer-events-none"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-indigo-900/10 rounded-full blur-[150px] pointer-events-none"></div>
        
        <div className="relative z-10 w-full min-h-screen flex items-center justify-center overflow-y-auto">
          {children}
        </div>
      </body>
    </html>
  );
}
