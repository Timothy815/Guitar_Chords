import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, NavLink, Navigate } from 'react-router-dom';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
class ErrorBoundary extends (React.Component as any) {
  constructor(props: { children: React.ReactNode }) { super(props); (this as any).state = { error: null }; }
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const self = this as any;
    if (self.state.error) {
      return (
        <div style={{ padding: 32, fontFamily: 'monospace' }}>
          <h2 style={{ color: '#c0392b' }}>Something went wrong</h2>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: 13 }}>{self.state.error.message}{'\n\n'}{self.state.error.stack}</pre>
          <button onClick={() => self.setState({ error: null })} style={{ marginTop: 16, padding: '8px 16px' }}>Try again</button>
        </div>
      );
    }
    return self.props.children;
  }
}
import { Dictionary } from './pages/Dictionary';
import { Progressions } from './pages/Progressions';
import { EarTraining } from './pages/EarTraining';
import { Music, Calendar, BookOpen, Sun, Moon, Disc, Headphones } from 'lucide-react';

function Layout({ children }: { children: React.ReactNode }) {
  const [isDark, setIsDark] = useState(() => {
    return document.documentElement.classList.contains('dark');
  });

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDark]);

  return (
    <div className="min-h-screen bg-brand-bg text-brand-ink transition-colors duration-300">
      <header className="bg-brand-surface border-b border-brand-line sticky top-0 z-10 print:hidden transition-colors duration-300">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-brand-primary rounded-lg flex items-center justify-center">
              <Music size={18} className="text-white" />
            </div>
            <span className="font-serif font-bold text-xl text-brand-primary tracking-tight">GuitarMaster</span>
          </div>
          
          <div className="flex gap-4 items-center">
            <nav className="flex gap-1">
              <NavLink 
                to="/dictionary" 
                className={({isActive}) => `flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${isActive ? 'bg-brand-sidebar text-brand-ink' : 'text-brand-secondary hover:text-brand-ink hover:bg-brand-sidebar/50'}`}
              >
                <BookOpen size={16} /> Dictionary
              </NavLink>
              <NavLink
                to="/caged"
                className={({isActive}) => `flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${isActive ? 'bg-brand-sidebar text-brand-ink' : 'text-brand-secondary hover:text-brand-ink hover:bg-brand-sidebar/50'}`}
              >
                <Music size={16} /> CAGED System
              </NavLink>
              <NavLink
                to="/circle"
                className={({isActive}) => `flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${isActive ? 'bg-brand-sidebar text-brand-ink' : 'text-brand-secondary hover:text-brand-ink hover:bg-brand-sidebar/50'}`}
              >
                <Disc size={16} /> Circle of 5ths
              </NavLink>
              <NavLink
                to="/progressions"
                className={({isActive}) => `flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${isActive ? 'bg-brand-sidebar text-brand-ink' : 'text-brand-secondary hover:text-brand-ink hover:bg-brand-sidebar/50'}`}
              >
                <Calendar size={16} /> Practice
              </NavLink>
              <NavLink
                to="/ear-training"
                className={({isActive}) => `flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${isActive ? 'bg-brand-sidebar text-brand-ink' : 'text-brand-secondary hover:text-brand-ink hover:bg-brand-sidebar/50'}`}
              >
                <Headphones size={16} /> Ear Training
              </NavLink>
            </nav>
            <div className="w-px h-6 bg-brand-line"></div>
            <button 
              onClick={() => setIsDark(!isDark)}
              className="p-2 text-brand-secondary hover:text-brand-ink hover:bg-brand-sidebar rounded-md transition-colors"
              title="Toggle theme"
            >
              {isDark ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          </div>
        </div>
      </header>

      <main className="p-6 md:p-8">
        {children}
      </main>
    </div>
  );
}

import { Caged } from './pages/Caged';
import { Circle } from './pages/Circle';

export default function App() {
  return (
    <BrowserRouter basename="/Guitar_Chords">
      <ErrorBoundary>
      <Layout>
        <Routes>
          <Route path="/" element={<Navigate to="/dictionary" replace />} />
          <Route path="/dictionary" element={<Dictionary />} />
          <Route path="/progressions" element={<Progressions />} />
          <Route path="/caged" element={<Caged />} />
          <Route path="/circle" element={<Circle />} />
          <Route path="/ear-training" element={<EarTraining />} />
        </Routes>
      </Layout>
      </ErrorBoundary>
    </BrowserRouter>
  );
}
