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
              // One-time hard purge of stale PWA cache and service workers to fix any blank screen or chunk load issues
              try {
                var purgeVersion = 'masterlazer_v4_purge';
                if (typeof window !== 'undefined' && !localStorage.getItem(purgeVersion)) {
                  localStorage.setItem(purgeVersion, 'true');
                  if ('serviceWorker' in navigator) {
                    navigator.serviceWorker.getRegistrations().then(function(regs) {
                      if (regs && regs.length > 0) {
                        for (var i = 0; i < regs.length; i++) {
                          regs[i].unregister();
                        }
                      }
                    });
                  }
                  if ('caches' in window) {
                    caches.keys().then(function(keys) {
                      keys.forEach(function(key) {
                        caches.delete(key);
                      });
                    });
                  }
                  console.log('[PWA] One-time fresh cache purge initiated.');
                  setTimeout(function() {
                    window.location.reload();
                  }, 200);
                }
              } catch (err) {
                console.error('[PWA] Purge error:', err);
              }

              window.addEventListener('error', function(e) {
                if (e && (e.message === 'Script error.' || (e.error && e.error.message === 'Script error.'))) {
                  e.stopImmediatePropagation();
                  e.preventDefault();
                }
                
                // Self-healing for chunk load errors caused by stale PWA browser caching
                var msg = e && e.message ? String(e.message) : '';
                if (msg.indexOf('chunk') !== -1 || msg.indexOf('Loading') !== -1 || msg.indexOf('CSS') !== -1 || msg.indexOf('Failed to fetch') !== -1) {
                  console.warn('Chunk load or network error detected. Purging SW caches and reloading page...');
                  if ('caches' in window) {
                    caches.keys().then(function(keys) {
                      keys.forEach(function(key) {
                        caches.delete(key);
                      });
                    });
                  }
                  setTimeout(function() {
                    window.location.reload();
                  }, 400);
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
