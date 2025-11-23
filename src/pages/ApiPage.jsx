import React, { useState, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Key, Copy, Check, Terminal, Shield, Zap, ChevronDown, Eye, EyeOff, RefreshCw, Database as DbIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { dbService } from '../services/mockDatabase';

const ApiPage = () => {
  const [apiKey, setApiKey] = useState('Loading...');
  const [copied, setCopied] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [timeRange, setTimeRange] = useState(30);
  const [showTimeMenu, setShowTimeMenu] = useState(false);
  const [chartData, setChartData] = useState([]);
  const [totalRequests, setTotalRequests] = useState(0);

  // Initial Data Load
  useEffect(() => {
    const loadData = async () => {
      const tokenData = await dbService.getApiToken();
      // Check if tokenData is valid before accessing properties
      if (tokenData && tokenData.token) {
          setApiKey(tokenData.token);
          
          if (tokenData.id) {
            // Pass token ID to get specific user stats
            const stats = await dbService.getUsageStats(timeRange, tokenData.id);
            setChartData(stats);

            const total = await dbService.getTotalRequests(tokenData.id);
            setTotalRequests(total);
          }
      } else {
          setApiKey('Error loading token');
      }
    };
    loadData();
  }, [timeRange]);

  const startGeneration = async () => {
    setIsGenerating(true);
    
    // Animation effect
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let interval = setInterval(() => {
      let randomKey = 'sk_live_';
      for (let i = 0; i < 24; i++) {
          randomKey += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      setApiKey(randomKey);
    }, 50);

    // Actual DB call
    const newToken = await dbService.regenerateToken();
    
    clearInterval(interval);
    // Check if newToken is valid
    if (newToken) {
        setApiKey(newToken);
    } else {
        // If generation failed (e.g. not implemented on backend yet), revert to safe state or show error
        // For now, just re-fetch current token
        const tokenData = await dbService.getApiToken();
        setApiKey(tokenData?.token || 'Error');
    }
    setIsGenerating(false);
  };

  const copyToClipboard = () => {
    if (apiKey && apiKey !== 'Loading...' && apiKey !== 'Error') {
        navigator.clipboard.writeText(apiKey);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="space-y-8 pb-10">
      
      {/* Header with Domain Simulation */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-text-main mb-2 flex items-center gap-2">
            <Zap className="text-accent-primary" />
            API Центр
          </h1>
          <p className="text-text-muted">Управление доступом и мониторинг</p>
        </div>
        <div className="flex items-center gap-4">
          <a href="/dashboard/api/test" className="hidden md:flex items-center gap-2 px-4 py-2 rounded-full bg-bg-main border border-border-color text-sm text-text-muted hover:text-text-main hover:border-accent-primary transition-colors">
            <Terminal className="w-4 h-4" />
            Тест API
          </a>
          <a href="/dashboard/api/docs" className="hidden md:flex items-center gap-2 px-4 py-2 rounded-full bg-bg-main border border-border-color text-sm text-text-muted hover:text-text-main hover:border-accent-primary transition-colors">
            <Terminal className="w-4 h-4" />
            Документация
          </a>
          <div className="px-4 py-2 rounded-full bg-bg-main border border-border-color font-mono text-sm text-text-muted flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
            api.bublickrust.ru
          </div>
        </div>
      </div>

      {/* API Key Section */}
      <div className="glass-panel p-8 rounded-2xl border-t-4 border-accent-primary">
        <div className="flex items-center gap-3 mb-6">
          <Key className="w-6 h-6 text-accent-primary" />
          <h2 className="text-xl font-semibold text-text-main">Ваш API Ключ</h2>
        </div>
        
        <div className="flex flex-col md:flex-row gap-4 items-center">
          <div className="relative flex-1 w-full group">
            <input 
              type={showKey ? "text" : "password"} 
              value={apiKey} 
              readOnly
              className="w-full bg-bg-main border border-border-color rounded-xl px-6 py-4 font-mono text-text-main focus:outline-none focus:border-accent-primary transition-colors text-lg tracking-wider pr-24"
            />
            
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
               <motion.button 
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setShowKey(!showKey)}
                  className="p-2 hover:bg-bg-main rounded-lg text-text-muted hover:text-text-main transition-colors overflow-hidden"
                  title={showKey ? "Скрыть" : "Показать"}
               >
                  <AnimatePresence mode="wait" initial={false}>
                    {showKey ? (
                      <motion.div
                        key="hide"
                        initial={{ opacity: 0, scale: 0.5, rotate: -90 }}
                        animate={{ opacity: 1, scale: 1, rotate: 0 }}
                        exit={{ opacity: 0, scale: 0.5, rotate: 90 }}
                        transition={{ duration: 0.2 }}
                      >
                        <EyeOff className="w-5 h-5" />
                      </motion.div>
                    ) : (
                      <motion.div
                        key="show"
                        initial={{ opacity: 0, scale: 0.5, rotate: 90 }}
                        animate={{ opacity: 1, scale: 1, rotate: 0 }}
                        exit={{ opacity: 0, scale: 0.5, rotate: -90 }}
                        transition={{ duration: 0.2 }}
                      >
                        <Eye className="w-5 h-5" />
                      </motion.div>
                    )}
                  </AnimatePresence>
               </motion.button>
               <motion.button 
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.9 }}
                onClick={copyToClipboard}
                className="p-2 hover:bg-bg-main rounded-lg text-text-muted hover:text-text-main overflow-hidden"
                title="Копировать"
              >
                <AnimatePresence mode="wait" initial={false}>
                  {copied ? (
                    <motion.div
                      key="check"
                      initial={{ opacity: 0, scale: 0.5 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.5 }}
                      transition={{ duration: 0.2 }}
                    >
                      <Check className="w-5 h-5 text-emerald-400" />
                    </motion.div>
                  ) : (
                    <motion.div
                      key="copy"
                      initial={{ opacity: 0, scale: 0.5 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.5 }}
                      transition={{ duration: 0.2 }}
                    >
                      <Copy className="w-5 h-5" />
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.button>
            </div>
          </div>
          <motion.button 
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={startGeneration}
            disabled={isGenerating}
            className={`w-full md:w-auto whitespace-nowrap bg-accent-primary text-accent-secondary font-bold py-4 px-8 rounded-xl shadow-lg flex items-center justify-center gap-2 ${isGenerating ? 'opacity-80 cursor-not-allowed' : 'hover:opacity-90'}`}
          >
            {isGenerating ? <RefreshCw className="w-5 h-5 animate-spin" /> : null}
            {isGenerating ? 'Генерация...' : 'Сгенерировать новый'}
          </motion.button>
        </div>
        <p className="mt-4 text-sm text-text-muted flex items-center gap-2">
          <Shield className="w-4 h-4" />
          Никогда не передавайте этот ключ третьим лицам.
        </p>
      </div>

      {/* Instructions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass-panel p-8 rounded-2xl">
          <div className="flex items-center gap-3 mb-6">
            <Terminal className="w-6 h-6 text-accent-primary" />
            <h2 className="text-xl font-semibold text-text-main">Как подключиться</h2>
          </div>
          <div className="space-y-4">
            <p className="text-text-muted">
              Используйте этот ключ в заголовке <code className="text-text-main">Authorization</code> для всех запросов.
            </p>
            
            <div className="bg-bg-main rounded-xl overflow-hidden border border-border-color">
              <div className="flex items-center gap-2 px-4 py-2 bg-accent-primary/10 border-b border-border-color">
                <div className="w-3 h-3 rounded-full bg-[#ff5f56]"></div>
                <div className="w-3 h-3 rounded-full bg-[#ffbd2e]"></div>
                <div className="w-3 h-3 rounded-full bg-[#27c93f]"></div>
                <span className="text-xs text-text-muted ml-2">BASH</span>
              </div>
              <div className="p-4 overflow-x-auto">
                <pre className="font-mono text-sm text-text-muted">
{`curl -X POST https://bublickrust.ru/api/images/upload \\
  -H "Authorization: Bearer ${apiKey && apiKey.length > 10 ? apiKey.substring(0, 10) : 'sk_live...'}..." \\
  -F "image=@your-image.png"`}
                </pre>
              </div>
            </div>
          </div>
        </div>

        <div className="glass-panel p-8 rounded-2xl flex flex-col justify-center">
           <h3 className="text-lg font-semibold text-text-main mb-4">Доступные методы</h3>
           <ul className="space-y-3">
             <li className="flex items-center justify-between p-3 rounded-lg bg-bg-main border border-border-color">
               <span className="font-mono text-text-main">POST /api/images/upload</span>
               <span className="text-text-muted text-sm">Загрузка изображений</span>
             </li>
             <li className="flex items-center justify-between p-3 rounded-lg bg-bg-main border border-border-color">
               <span className="font-mono text-text-main">POST /api/gradient-role</span>
               <span className="text-text-muted text-sm">Градиентные роли</span>
             </li>
             <li className="flex items-center justify-between p-3 rounded-lg bg-bg-main border border-border-color">
               <span className="font-mono text-text-main">POST /api/tournament-application</span>
               <span className="text-text-muted text-sm">Турнирная заявка</span>
             </li>
           </ul>
        </div>
      </div>

      {/* Chart */}
      <div className="glass-panel p-8 rounded-2xl">
        <div className="flex items-center justify-between mb-8 relative">
          <div>
            <h2 className="text-xl font-semibold text-text-main">Использование API</h2>
            <p className="text-text-muted">Количество запросов: <span className="text-accent-primary font-bold">{totalRequests.toLocaleString()}</span></p>
          </div>
          
          <div className="relative">
            <button 
              onClick={() => setShowTimeMenu(!showTimeMenu)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-bg-main text-sm text-text-muted border border-border-color hover:bg-accent-primary/10 transition-colors"
            >
              Последние {timeRange} дней
              <ChevronDown className={`w-4 h-4 transition-transform ${showTimeMenu ? 'rotate-180' : ''}`} />
            </button>

            <AnimatePresence>
              {showTimeMenu && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="absolute right-0 top-full mt-2 w-48 bg-bg-main border border-border-color rounded-xl shadow-xl z-20 overflow-hidden"
                >
                  {[7, 30, 90].map((days) => (
                    <button
                      key={days}
                      onClick={() => {
                        setTimeRange(days);
                        setShowTimeMenu(false);
                      }}
                      className={`w-full text-left px-4 py-3 text-sm hover:bg-accent-primary/10 transition-colors ${timeRange === days ? 'text-accent-primary' : 'text-text-muted'}`}
                    >
                      Последние {days} дней
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="colorRequests" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--chart-color)" stopOpacity={0.2}/>
                  <stop offset="95%" stopColor="var(--chart-color)" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" />
              <XAxis 
                dataKey="name" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: 'var(--text-muted)', fontSize: 12 }} 
                dy={10}
              />
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: 'var(--text-muted)', fontSize: 12 }} 
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'var(--bg-main)', 
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  color: 'var(--text-main)'
                }}
                itemStyle={{ color: 'var(--chart-color)' }}
              />
              <Area 
                type="monotone" 
                dataKey="requests" 
                stroke="var(--chart-color)" 
                strokeWidth={2}
                fillOpacity={1} 
                fill="url(#colorRequests)" 
                animationDuration={2000}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default ApiPage;
