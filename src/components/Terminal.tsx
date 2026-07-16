"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Terminal as TerminalIcon, ShieldAlert, Zap, Loader2, Info } from 'lucide-react';
import ModeSelector from './ModeSelector';

type Mode = 'safe' | 'learning' | 'power';

interface OutputLine {
  id: string;
  type: 'input' | 'output' | 'error' | 'explanation' | 'system' | 'command';
  content: string;
  command?: string;
  safety?: 'SAFE' | 'WARNING' | 'DANGEROUS';
}

// Helper functions for client-side caching of generated commands and explanations
const getCachedCommand = (prompt: string): string | null => {
  if (typeof window === 'undefined') return null;
  try {
    const cache = JSON.parse(localStorage.getItem('shell_ai_cmd_cache') || '{}');
    return cache[prompt.trim().toLowerCase()] || null;
  } catch {
    return null;
  }
};

const setCachedCommand = (prompt: string, command: string) => {
  if (typeof window === 'undefined') return;
  try {
    const cache = JSON.parse(localStorage.getItem('shell_ai_cmd_cache') || '{}');
    cache[prompt.trim().toLowerCase()] = command;
    localStorage.setItem('shell_ai_cmd_cache', JSON.stringify(cache));
  } catch {}
};

const getCachedExplanation = (command: string): string | null => {
  if (typeof window === 'undefined') return null;
  try {
    const cache = JSON.parse(localStorage.getItem('shell_ai_exp_cache') || '{}');
    return cache[command.trim()] || null;
  } catch {
    return null;
  }
};

const setCachedExplanation = (command: string, explanation: string) => {
  if (typeof window === 'undefined') return;
  try {
    const cache = JSON.parse(localStorage.getItem('shell_ai_exp_cache') || '{}');
    cache[command.trim()] = explanation;
    localStorage.setItem('shell_ai_exp_cache', JSON.stringify(cache));
  } catch {}
};

export default function Terminal() {
  const [mode, setMode] = useState<Mode>('learning');
  const [input, setInput] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [output, setOutput] = useState<OutputLine[]>([
    { id: '0', type: 'system', content: 'Welcome to Smart Shell AI v1.0.0.' },
    { id: '1', type: 'system', content: 'Type your command in natural language (e.g., "list all txt files").' }
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [pendingCommand, setPendingCommand] = useState<{ command: string; explanation: string; safety: string } | null>(null);
  const [isDockerActive, setIsDockerActive] = useState<boolean | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [output, pendingCommand]);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const res = await fetch('/api/status');
        const data = await res.json();
        setIsDockerActive(!!data.dockerActive);
      } catch (err) {
        setIsDockerActive(false);
      }
    };
    fetchStatus();
  }, []);

  const addOutput = (line: Omit<OutputLine, 'id'>) => {
    setOutput(prev => [...prev, { ...line, id: Math.random().toString(36).substring(7) }]);
  };

  const handleExecute = async (cmd: string) => {
    setIsLoading(true);
    addOutput({ type: 'system', content: `Executing: ${cmd}` });
    try {
      const res = await fetch('/api/execute-command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: cmd })
      });
      const data = await res.json();
      
      if (data.isFallback) {
        addOutput({ 
          type: 'system', 
          content: '⚠️ Docker sandbox is not active. Command executed directly on the host system.', 
          safety: 'WARNING' 
        });
      }
      
      if (data.stdout) addOutput({ type: 'output', content: data.stdout });
      if (data.stderr) addOutput({ type: 'error', content: data.stderr });
      if (data.error) addOutput({ type: 'error', content: data.error });
    } catch (err: any) {
      addOutput({ type: 'error', content: err.message || 'Execution failed' });
    } finally {
      setIsLoading(false);
      setPendingCommand(null);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  const processNaturalLanguage = async (text: string) => {
    setIsLoading(true);
    try {
      // 1. Generate Command (Check client-side cache first)
      let command = getCachedCommand(text);
      if (command) {
        console.log('[Client Cache] Hit command cache for:', text);
      } else {
        const genRes = await fetch('/api/generate-command', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: text })
        });
        const genData = await genRes.json();
        
        if (!genRes.ok) throw new Error(genData.error || 'Failed to generate command');
        command = genData.command;
        if (command) {
          setCachedCommand(text, command);
        }
      }

      if (!command) throw new Error('Command generation returned empty content');
      
      addOutput({ type: 'command', content: `Generated command: ${command}`, command });

      // 2. Validate Safety
      const valRes = await fetch('/api/validate-command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command })
      });
      const valData = await valRes.json();
      const safety = valData.safety; // SAFE, WARNING, DANGEROUS

      addOutput({ type: 'system', content: `Safety Status: ${safety}`, safety });

      if (mode === 'safe' && (safety === 'DANGEROUS' || safety === 'WARNING')) {
        addOutput({ type: 'error', content: `Command blocked by Safe Mode.` });
        setIsLoading(false);
        return;
      }

      // 3. Explain Command (for learning mode or pending - check client cache first)
      let explanation = '';
      if (mode === 'learning' || safety !== 'SAFE') {
        explanation = getCachedExplanation(command) || '';
        if (explanation) {
          console.log('[Client Cache] Hit explanation cache for:', command);
        } else {
          const expRes = await fetch('/api/explain-command', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ command })
          });
          const expData = await expRes.json();
          explanation = expData.explanation;
          if (explanation) {
            setCachedExplanation(command, explanation);
          }
        }
        
        if (mode === 'learning' && explanation) {
          addOutput({ type: 'explanation', content: explanation });
        }
      }

      // 4. Execution logic based on mode
      if (mode === 'power' && safety === 'SAFE') {
        await handleExecute(command);
      } else {
        // Require confirmation
        setPendingCommand({ command, explanation, safety });
        setIsLoading(false);
      }
      
    } catch (err: any) {
      addOutput({ type: 'error', content: err.message });
      setIsLoading(false);
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const val = input.trim();
    setInput('');
    setHistory(prev => [...prev, val]);
    setHistoryIndex(-1);
    
    addOutput({ type: 'input', content: val });
    
    // Check if it looks like a direct shell command (starts with / or >) or just natural language
    if (val.startsWith('> ')) {
       await handleExecute(val.slice(2));
    } else {
       await processNaturalLanguage(val);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (history.length > 0) {
        const newIdx = historyIndex < history.length - 1 ? historyIndex + 1 : historyIndex;
        setHistoryIndex(newIdx);
        setInput(history[history.length - 1 - newIdx]);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex > 0) {
        const newIdx = historyIndex - 1;
        setHistoryIndex(newIdx);
        setInput(history[history.length - 1 - newIdx]);
      } else if (historyIndex === 0) {
        setHistoryIndex(-1);
        setInput('');
      }
    }
  };

  return (
    <div className="terminal-glass rounded-xl flex flex-col h-full overflow-hidden border border-neutral-800 shadow-2xl relative">
      <div className="scanline"></div>
      
      <div className="bg-neutral-900/80 px-4 py-3 flex items-center justify-between border-b border-neutral-800 backdrop-blur-md z-10">
        <div className="flex items-center gap-2">
          <TerminalIcon className="w-5 h-5 text-emerald-400" />
          <span className="font-mono text-sm font-medium text-neutral-300">smart-shell ~ user@local</span>
          {isDockerActive === true && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-sans flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              Docker Sandboxed
            </span>
          )}
          {isDockerActive === false && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 font-sans flex items-center gap-1" title="Docker daemon not found. Commands run on your local machine.">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
              Local Host
            </span>
          )}
        </div>
        <ModeSelector mode={mode} setMode={setMode} />
      </div>

      <div className="flex-1 overflow-y-auto p-4 md:p-6 font-mono text-sm space-y-3 z-10" onClick={() => inputRef.current?.focus()}>
        {output.map((line) => (
          <div key={line.id} className="leading-relaxed whitespace-pre-wrap break-words">
            {line.type === 'input' && (
               <div className="text-emerald-400 flex"><span className="mr-2">❯</span> <span className="text-white">{line.content}</span></div>
            )}
            {line.type === 'system' && (
               <div className={`text-neutral-400 flex items-center ${line.safety === 'DANGEROUS' ? 'text-red-400' : line.safety === 'WARNING' ? 'text-yellow-400' : ''}`}>
                 <span className="mr-2 opacity-50">#</span> {line.content}
               </div>
            )}
            {line.type === 'command' && (
               <div className="text-cyan-400 bg-cyan-400/10 p-2 rounded border border-cyan-400/20 mt-1 inline-block">
                 {line.content}
               </div>
            )}
            {line.type === 'explanation' && (
               <div className="text-blue-300 bg-blue-500/10 p-3 rounded border border-blue-500/20 mt-1 flex gap-2">
                 <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
                 <span>{line.content}</span>
               </div>
            )}
            {line.type === 'output' && (
               <div className="text-neutral-300">{line.content}</div>
            )}
            {line.type === 'error' && (
               <div className="text-red-400 bg-red-400/10 p-2 rounded">{line.content}</div>
            )}
          </div>
        ))}

        {pendingCommand && (
          <div className="bg-neutral-800/80 p-4 rounded-lg border border-neutral-700 animate-in fade-in slide-in-from-bottom-2">
            <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
              {pendingCommand.safety === 'DANGEROUS' ? <ShieldAlert className="text-red-500 w-4 h-4"/> : <Info className="text-blue-400 w-4 h-4"/>}
              Pending Execution
            </h4>
            <div className="text-cyan-400 font-mono mb-2">{pendingCommand.command}</div>
            {pendingCommand.explanation && <div className="text-neutral-400 text-sm mb-4">{pendingCommand.explanation}</div>}
            
            <div className="flex gap-3">
              <button onClick={() => handleExecute(pendingCommand.command)} className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-sm transition-colors flex items-center gap-2">
                 <Zap className="w-3 h-3" /> Execute
              </button>
              <button onClick={() => { setPendingCommand(null); addOutput({ type: 'system', content: 'Execution cancelled.' }); setTimeout(() => inputRef.current?.focus(), 50); }} className="px-4 py-1.5 bg-neutral-700 hover:bg-neutral-600 text-white rounded text-sm transition-colors">
                 Cancel
              </button>
            </div>
          </div>
        )}

        {isLoading && !pendingCommand && (
          <div className="text-emerald-400/50 flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Processing...
          </div>
        )}
        
        <div ref={bottomRef} />
      </div>

      <form onSubmit={onSubmit} className="p-4 bg-neutral-900/50 border-t border-neutral-800 flex items-center gap-2 z-10">
        <span className="text-emerald-400 font-mono">❯</span>
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          disabled={isLoading || !!pendingCommand}
          className="flex-1 bg-transparent border-none outline-none text-white font-mono placeholder-neutral-600"
          placeholder='Ask for a command (e.g. "show open ports")'
          autoFocus
          autoComplete="off"
          spellCheck="false"
        />
      </form>
    </div>
  );
}
