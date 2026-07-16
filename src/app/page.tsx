import Terminal from '@/components/Terminal';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 md:p-8 relative">
      <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay pointer-events-none"></div>
      
      <div className="w-full max-w-5xl z-10 flex flex-col gap-6 h-[90vh]">
        <header className="flex justify-between items-center px-2">
          <div>
            <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-cyan-400 tracking-tight">
              Smart Shell
            </h1>
            <p className="text-sm text-neutral-400 mt-1">Translate natural language to shell commands safely.</p>
          </div>
        </header>

        <Terminal />
      </div>
    </main>
  );
}
