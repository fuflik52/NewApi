import React from 'react';
import { Moon, Sun, Sparkles, Code } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

const ThemeOption = ({ id, label, icon: Icon, active }) => {
  const { setTheme } = useTheme();
  return (
    <button 
      onClick={() => setTheme(id)}
      className={`flex items-center gap-3 p-4 rounded-xl border transition-all duration-300 w-full ${
        active 
          ? 'bg-accent-primary text-accent-secondary border-accent-primary shadow-lg transform scale-[1.02]' 
          : 'bg-bg-main text-text-muted border-border-color hover:border-text-muted'
      }`}
    >
      <Icon className="w-5 h-5" />
      <span className="font-medium">{label}</span>
      {active && <div className="ml-auto w-2 h-2 rounded-full bg-accent-secondary animate-pulse" />}
    </button>
  );
};

const Settings = () => {
  const { theme } = useTheme();

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-text-main mb-8">Настройки</h1>
      
      {/* Theme Selection */}
      <div className="glass-panel p-8 rounded-2xl">
        <h2 className="text-xl font-semibold text-text-main mb-4">Внешний вид</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <ThemeOption 
            id="dark" 
            label="Dark (Mono)" 
            icon={Moon} 
            active={theme === 'dark'} 
          />
          <ThemeOption 
            id="light" 
            label="Light (Mono)" 
            icon={Sun} 
            active={theme === 'light'} 
          />
          <ThemeOption 
            id="cosmo" 
            label="Cosmos" 
            icon={Sparkles} 
            active={theme === 'cosmo'} 
          />
           <ThemeOption 
            id="monokai" 
            label="Monokai" 
            icon={Code} 
            active={theme === 'monokai'} 
          />
        </div>
      </div>
    </div>
  );
};

export default Settings;
