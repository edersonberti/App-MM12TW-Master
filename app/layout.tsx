import type {Metadata} from 'next';
import './globals.css'; // Global styles

export const metadata: Metadata = {
  title: 'MM12TW - Controle de Área de Lazer',
  description: 'Aplicativo de controle para área de lazer Master Lazer. Gerenciamento de motores, timers de filtragem e automação de iluminação LED.',
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="pt-BR">
      <body suppressHydrationWarning className="bg-slate-950 min-h-screen text-slate-100 flex md:items-center justify-center relative overflow-x-hidden md:overflow-y-auto font-sans antialiased">
        {/* Background Mesh Gradients */}
        <div className="absolute top-[-100px] left-[-100px] w-[500px] h-[500px] bg-blue-600/20 rounded-full blur-[120px] pointer-events-none"></div>
        <div className="absolute bottom-[-100px] right-[-100px] w-[600px] h-[600px] bg-orange-600/10 rounded-full blur-[120px] pointer-events-none"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-indigo-900/10 rounded-full blur-[150px] pointer-events-none"></div>
        
        <div className="relative z-10 w-full min-h-[100dvh] md:min-h-0 flex md:items-center justify-center">
          {children}
        </div>
      </body>
    </html>
  );
}
