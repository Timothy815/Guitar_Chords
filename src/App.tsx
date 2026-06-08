import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, NavLink, Navigate } from 'react-router-dom';
import { Dictionary } from './pages/Dictionary';
import { Progressions } from './pages/Progressions';
import { Music, Calendar, BookOpen, Sun, Moon } from 'lucide-react';

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
                to="/progressions" 
                className={({isActive}) => `flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${isActive ? 'bg-brand-sidebar text-brand-ink' : 'text-brand-secondary hover:text-brand-ink hover:bg-brand-sidebar/50'}`}
              >
                <Calendar size={16} /> Practice
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

export default function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Navigate to="/dictionary" replace />} />
          <Route path="/dictionary" element={<Dictionary />} />
          <Route path="/progressions" element={<Progressions />} />
          <Route path="/caged" element={<Caged />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}
