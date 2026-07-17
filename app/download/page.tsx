import Image from 'next/image';
import { Download, ShieldCheck, Smartphone } from 'lucide-react';

const LOGO_PATH = encodeURI('/logo(512 x 512 px).png');

export default function AabDownloadPage() {
  return (
    <main className="relative flex min-h-screen w-full items-center justify-center overflow-hidden px-5 py-10">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-[-12rem] h-[28rem] w-[28rem] -translate-x-1/2 rounded-full bg-blue-500/20 blur-[100px]" />
        <div className="absolute bottom-[-10rem] right-[-8rem] h-80 w-80 rounded-full bg-cyan-400/10 blur-[90px]" />
      </div>

      <section className="relative w-full max-w-md overflow-hidden rounded-[2rem] border border-white/10 bg-slate-900/75 p-7 text-center shadow-2xl shadow-black/40 backdrop-blur-xl sm:p-9">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-blue-400/80 to-transparent" />

        <div className="mx-auto mb-5 flex h-24 w-24 items-center justify-center rounded-3xl border border-white/10 bg-white/5 p-2 shadow-lg shadow-blue-950/40">
          <div className="relative h-full w-full">
            <Image
              src={LOGO_PATH}
              alt="Master Lazer"
              fill
              sizes="96px"
              className="rounded-2xl object-contain"
              priority
            />
          </div>
        </div>

        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-emerald-300">
          <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
          Download oficial
        </span>

        <h1 className="mt-5 text-3xl font-black tracking-tight text-white">
          Master Lazer
        </h1>
        <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-slate-400">
          Baixe o aplicativo para controlar sua área de lazer diretamente pelo
          celular Android.
        </p>

        <div className="my-7 flex items-center justify-center gap-3 rounded-2xl border border-white/8 bg-white/[0.04] px-4 py-3 text-left">
          <div className="rounded-xl bg-blue-500/15 p-2.5 text-blue-300">
            <Smartphone className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-100">Aplicativo Android</p>
            <p className="text-xs text-slate-500">Android App Bundle para download</p>
          </div>
        </div>

        <a
          href="/download/aab"
          download="Master Lazer.aab"
          className="group flex w-full items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-blue-600 to-cyan-500 px-6 py-4 text-base font-extrabold text-white shadow-xl shadow-blue-600/20 transition duration-200 hover:-translate-y-0.5 hover:shadow-blue-500/35 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-400/40 active:translate-y-0"
        >
          <Download
            className="h-5 w-5 transition-transform group-hover:translate-y-0.5"
            aria-hidden="true"
          />
          Baixar AAB
        </a>

        <p className="mt-4 text-[11px] leading-5 text-slate-500">
          O formato AAB é destinado à publicação do aplicativo no Google Play.
        </p>
      </section>
    </main>
  );
}
