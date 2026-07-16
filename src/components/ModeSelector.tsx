"use client";

import React from 'react';
import { Shield, BookOpen, Zap } from 'lucide-react';

type Mode = 'safe' | 'learning' | 'power';

interface ModeSelectorProps {
  mode: Mode;
  setMode: (mode: Mode) => void;
}

export default function ModeSelector({ mode, setMode }: ModeSelectorProps) {
  const modes = [
    { id: 'safe', label: 'Safe', icon: Shield, color: 'text-emerald-400', desc: 'Blocks risky commands' },
    { id: 'learning', label: 'Learning', icon: BookOpen, color: 'text-blue-400', desc: 'Explains everything' },
    { id: 'power', label: 'Power', icon: Zap, color: 'text-amber-400', desc: 'Direct execution' }
  ];

  return (
    <div className="flex bg-neutral-950 rounded-lg p-1 border border-neutral-800 relative">
      {modes.map((m) => {
        const Icon = m.icon;
        const isActive = mode === m.id;
        return (
          <button
            key={m.id}
            onClick={() => setMode(m.id as Mode)}
            title={m.desc}
            className={`
              flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-200
              ${isActive ? 'bg-neutral-800 text-white shadow-sm' : 'text-neutral-500 hover:text-neutral-300 hover:bg-neutral-900'}
            `}
          >
            <Icon className={`w-3.5 h-3.5 ${isActive ? m.color : 'opacity-70'}`} />
            {m.label}
          </button>
        );
      })}
    </div>
  );
}
