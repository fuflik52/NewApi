import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Check, Copy, FileImage, Upload, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const ApiDocs = () => {
  const [copied, setCopied] = useState(false);
  const [uptime, setUptime] = useState({ days: 14, hours: 2, minutes: 15, seconds: 30 });

  // Update uptime every second
  useEffect(() => {
    const interval = setInterval(() => {
      setUptime(prev => {
        let { days, hours, minutes, seconds } = prev;
        seconds++;
        if (seconds >= 60) {
          seconds = 0;
          minutes++;
          if (minutes >= 60) {
            minutes = 0;
            hours++;
            if (hours >= 24) {
              hours = 0;
              days++;
            }
          }
        }
        return { days, hours, minutes, seconds };
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const copyCode = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto pb-10">
      {/* Header */}
      <div className="text-center space-y-4">
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="inline-flex items-center gap-3 px-5 py-2.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 font-bold shadow-[0_0_15px_rgba(16,185,129,0.2)]"
        >
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
          </span>
          Статус: РАБОТАЕТ
        </motion.div>
        <h1 className="text-4xl font-bold text-text-main">Image Upload API</h1>
        <p className="text-text-muted text-lg">Быстрая и надежная загрузка изображений</p>
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="glass-panel p-6 rounded-2xl">
          <div className="flex items-center gap-3 mb-6">
            <Upload className="w-6 h-6 text-accent-primary" />
            <h2 className="text-xl font-semibold text-text-main">Основная информация</h2>
          </div>
          <div className="space-y-4">
            <div className="bg-bg-main p-4 rounded-xl border border-border-color">
              <div className="text-xs text-text-muted uppercase font-bold mb-1">Метод</div>
              <div className="text-text-main font-mono bg-emerald-500/20 text-emerald-500 px-2 py-1 rounded inline-block">POST</div>
            </div>
            <div className="bg-bg-main p-4 rounded-xl border border-border-color">
              <div className="text-xs text-text-muted uppercase font-bold mb-1">Endpoint</div>
              <div className="text-text-main font-mono">/api/images/upload</div>
            </div>
            <div className="bg-bg-main p-4 rounded-xl border border-border-color">
              <div className="text-xs text-text-muted uppercase font-bold mb-1">Авторизация</div>
              <div className="text-text-main font-mono">Bearer Token</div>
            </div>
            <div className="flex gap-4">
               <div className="flex-1 bg-bg-main p-4 rounded-xl border border-border-color">
                <div className="text-xs text-text-muted uppercase font-bold mb-1">Поле формы</div>
                <div className="text-text-main font-mono">image</div>
              </div>
              <div className="flex-1 bg-bg-main p-4 rounded-xl border border-border-color">
                <div className="flex items-center gap-1 text-xs text-text-muted uppercase font-bold mb-1">
                  <Clock className="w-3 h-3" />
                  Время работы
                </div>
                <div className="text-text-main font-mono text-sm">
                  {uptime.days}d {uptime.hours}h <span className="text-accent-primary">{uptime.minutes}m</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="glass-panel p-6 rounded-2xl">
          <div className="flex items-center gap-3 mb-6">
            <FileImage className="w-6 h-6 text-accent-primary" />
            <h2 className="text-xl font-semibold text-text-main">Требования к файлам</h2>
          </div>
          <div className="space-y-4">
            <div className="bg-bg-main p-4 rounded-xl border border-border-color">
              <div className="text-xs text-text-muted uppercase font-bold mb-1">Макс. размер</div>
              <div className="text-text-main font-bold">15 MB</div>
            </div>
            <div className="bg-bg-main p-4 rounded-xl border border-border-color">
              <div className="text-xs text-text-muted uppercase font-bold mb-2">Поддерживаемые форматы</div>
              <div className="flex flex-wrap gap-2">
                {['PNG', 'JPG', 'JPEG', 'GIF', 'WebP'].map(fmt => (
                  <span key={fmt} className="px-3 py-1 rounded-lg bg-accent-primary/10 border border-accent-primary/20 text-accent-primary text-sm font-medium">
                    {fmt}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Example */}
      <div className="glass-panel p-6 rounded-2xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-text-main">Пример запроса (cURL)</h2>
          
          <motion.button 
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => copyCode(`curl -X POST https://bublickrust.ru/api/images/upload \\
  -H "Authorization: Bearer YOUR_TOKEN" \\
  -F "image=@your-image.png"`)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-bg-main hover:bg-accent-primary/10 text-text-muted hover:text-text-main transition-colors text-sm border border-border-color min-w-[140px] justify-center"
          >
            <AnimatePresence mode="wait" initial={false}>
              {copied ? (
                <motion.div
                  key="check"
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.5 }}
                  transition={{ duration: 0.2 }}
                  className="flex items-center gap-2 text-emerald-500"
                >
                  <Check className="w-4 h-4" />
                  <span>Скопировано</span>
                </motion.div>
              ) : (
                <motion.div
                  key="copy"
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.5 }}
                  transition={{ duration: 0.2 }}
                  className="flex items-center gap-2"
                >
                  <Copy className="w-4 h-4" />
                  <span>Копировать</span>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.button>
        </div>
        {/* Use theme variable for background instead of hardcoded black */}
        <div className="bg-bg-main rounded-xl p-4 overflow-x-auto border border-border-color font-mono text-sm shadow-inner">
          <div className="text-text-muted">
            <span className="text-accent-primary">curl</span> -X POST https://bublickrust.ru/api/images/upload \<br/>
            &nbsp;&nbsp;-H <span className="text-emerald-500">"Authorization: Bearer YOUR_TOKEN"</span> \<br/>
            &nbsp;&nbsp;-F <span className="text-yellow-500">"image=@your-image.png"</span>
          </div>
        </div>
      </div>

      <div className="flex justify-center">
        <Link 
          to="/dashboard" 
          className="flex items-center gap-2 px-6 py-3 rounded-xl bg-bg-main hover:bg-accent-primary/10 border border-border-color text-text-muted hover:text-text-main transition-all group"
        >
          <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
          Вернуться на главную
        </Link>
      </div>
    </div>
  );
};

export default ApiDocs;
