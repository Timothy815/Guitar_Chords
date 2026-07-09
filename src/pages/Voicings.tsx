import React, { useState } from 'react';
import { ShellVoicingsTab } from '../components/voicings/ShellVoicingsTab';
import { Drop2Tab } from '../components/voicings/Drop2Tab';

type Tab = 'shell' | 'drop2';

const TABS: { key: Tab; label: string }[] = [
  { key: 'shell', label: 'Shell Voicings' },
  { key: 'drop2', label: 'Drop 2' },
];

export function Voicings() {
  const [tab, setTab] = useState<Tab>('shell');

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-serif font-bold text-brand-ink">Voicings</h1>
        <p className="text-sm text-brand-secondary mt-1">
          Chord voicing techniques — from stripped-down shells to full four-note drop voicings.
        </p>
      </div>

      <div className="flex gap-1 border-b border-brand-line">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t.key
                ? 'border-brand-primary text-brand-primary'
                : 'border-transparent text-brand-secondary hover:text-brand-ink'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'shell' && <ShellVoicingsTab />}
      {tab === 'drop2' && <Drop2Tab />}
    </div>
  );
}
