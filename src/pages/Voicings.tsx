import React, { useState } from 'react';
import { ShellVoicingsTab } from '../components/voicings/ShellVoicingsTab';
import { Drop2Tab } from '../components/voicings/Drop2Tab';
import { Drop3Tab } from '../components/voicings/Drop3Tab';
import { TriadsTab } from '../components/voicings/TriadsTab';
import { UpperStructureTab } from '../components/voicings/UpperStructureTab';
import { DyadsTab } from '../components/voicings/DyadsTab';
import { QuartalTab } from '../components/voicings/QuartalTab';
import { TensionsTab } from '../components/voicings/TensionsTab';

type Tab = 'shell' | 'drop2' | 'drop3' | 'triads' | 'ust' | 'dyads' | 'quartal' | 'tensions';

const TABS: { key: Tab; label: string }[] = [
  { key: 'shell',    label: 'Shell Voicings'   },
  { key: 'drop2',   label: 'Drop 2'            },
  { key: 'drop3',   label: 'Drop 3'            },
  { key: 'triads',  label: 'Triads'            },
  { key: 'ust',     label: 'Upper Structure'   },
  { key: 'dyads',   label: 'Dyads'             },
  { key: 'quartal', label: 'Quartal'           },
  { key: 'tensions',label: 'Tensions'          },
];

export function Voicings() {
  const [tab, setTab] = useState<Tab>('shell');

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-serif font-bold text-brand-ink">Voicings</h1>
        <p className="text-sm text-brand-secondary mt-1">
          Chord voicing techniques — from stripped-down shells to full four-note drop voicings, dyads, quartal stacks, and color-tone extensions.
        </p>
      </div>

      <div className="flex gap-1 border-b border-brand-line overflow-x-auto">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap ${
              tab === t.key
                ? 'border-brand-primary text-brand-primary'
                : 'border-transparent text-brand-secondary hover:text-brand-ink'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'shell'    && <ShellVoicingsTab />}
      {tab === 'drop2'   && <Drop2Tab />}
      {tab === 'drop3'   && <Drop3Tab />}
      {tab === 'triads'  && <TriadsTab />}
      {tab === 'ust'     && <UpperStructureTab />}
      {tab === 'dyads'   && <DyadsTab />}
      {tab === 'quartal' && <QuartalTab />}
      {tab === 'tensions'&& <TensionsTab />}
    </div>
  );
}
