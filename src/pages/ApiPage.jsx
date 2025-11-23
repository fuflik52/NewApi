import React, { useState, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Key, Copy, Check, Terminal, Shield, Zap, ChevronDown, Eye, EyeOff, RefreshCw, Plus, Trash2, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { dbService } from '../services/mockDatabase';

const ApiPage = () => {
  const [tokens, setTokens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copiedId, setCopiedId] = useState(null);
  const [isCreating, setIsCreating] = useState(false);
  const [visibleKeys, setVisibleKeys] = useState({}); // Map of id -> boolean
  
  // Charts state
  const [timeRange, setTimeRange] = useState(30);
  const [showTimeMenu, setShowTimeMenu] = useState(false);
  const [chartData, setChartData] = useState([]);
  const [totalRequests, setTotalRequests] = useState(0);

  const loadTokens = async () => {
      try {
          const data = await dbService.getApiTokens();
          setTokens(data);
          // Load stats for first token if exists
          if (data.length > 0) {
              // Mock stats loading
              const stats = await dbService.getUsageStats(timeRange, data[0].id);
              setChartData(stats);
              const total = await dbService.getTotalRequests(data[0].id);
              setTotalRequests(total);
          }
      } catch (e) {
          console.error(e);
      } finally {
          setLoading(false);
      }
  };

  useEffect(() => {
    loadTokens();
  }, [timeRange]);

  const handleCreateToken = async () => {
      if (tokens.length >= 3) {
          setError('Maximum 3 tokens allowed');
          setTimeout(() => setError(''), 3000);
          return;
      }

      setIsCreating(true);
      try {
          await dbService.createToken(`Key ${tokens.length + 1}`);
          await loadTokens();
      } catch (e) {
          setError(e.message);
          setTimeout(() => setError(''), 3000);
      } finally {
          setIsCreating(false);
      }
  };

  const handleDeleteToken = async (id) => {
      if (confirm('Are you sure you want to delete this token? This action cannot be undone.')) {
          await dbService.deleteToken(id);
          await loadTokens();
      }
  };

  const toggleVisibility = (id) => {
      setVisibleKeys(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const copyToClipboard = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const primaryKey = tokens.length > 0 ? tokens[0].token : 'sk_live...';

  return (
    <div className="space-y-8 pb-10">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-text-main mb-2 flex items-center gap-2">
            <Zap className="text-accent-primary" />
            API Центр
          </h1>
          <p className="text-text-muted">Управление ключами доступа ({tokens.length}/3)</p>
        </div>
        <div className="flex items-center gap-4">
             <button 
                onClick={handleCreateToken}
                disabled={isCreating || tokens.length >= 3}
                className={`flex items-center gap-2 px-4 py-2 rounded-full bg-accent-primary text-accent-secondary font-bold shadow-lg transition-all ${
                    tokens.length >= 3 ? 'opacity-50 cursor-not-allowed' : 'hover:opacity-90 hover:scale-105'
                }`}
             >
                {isCreating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Создать ключ
             </button>
        </div>
      </div>

      {/* Error Message */}
      <AnimatePresence>
        {error && (
            <motion.div 
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="bg-red-500/10 border border-red-500/50 text-red-500 p-4 rounded-xl flex items-center gap-3"
            >
                <AlertCircle className="w-5 h-5" />
                {error}
            </motion.div>
        )}
      </AnimatePresence>

      {/* Token List */}
      <div className="space-y-4">
        {loading ? (
            <div className="text-center p-8 text-text-muted">Loading keys...</div>
        ) : tokens.length === 0 ? (
            <div className="glass-panel p-12 rounded-2xl text-center">
                <Key className="w-12 h-12 text-text-muted mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-text-main mb-2">Нет активных ключей</h3>
                <p className="text-text-muted mb-6">Создайте API ключ для доступа к сервису.</p>
                <button 
                    onClick={handleCreateToken}
                    className="px-6 py-3 bg-accent-primary text-accent-secondary rounded-xl font-bold hover:opacity-90 transition-all"
                >
                    Создать первый ключ
                </button>
            </div>
        ) : (
            tokens.map((token) => (
                <motion.div 
                    key={token.id}
                    layout
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="glass-panel p-6 rounded-2xl border border-border-color group hover:border-accent-primary/30 transition-colors"
                >
                    <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                        <div className="flex-1 w-full">
                            <div className="flex items-center gap-2 mb-2">
                                <span className="font-semibold text-text-main">{token.name}</span>
                                <span className="text-xs text-text-muted px-2 py-0.5 rounded-full bg-bg-main border border-border-color">
                                    {new Date(token.created_at).toLocaleDateString()}
                                </span>
                            </div>
                            <div className="relative flex items-center bg-bg-main rounded-xl border border-border-color overflow-hidden">
                                <div className="px-4 py-3 font-mono text-text-muted flex-1 truncate">
                                    {visibleKeys[token.id] ? token.token : '•'.repeat(24) + token.token.slice(-4)}
                                </div>
                                <div className="flex items-center border-l border-border-color bg-bg-main">
                                    <button 
                                        onClick={() => toggleVisibility(token.id)}
                                        className="p-3 hover:bg-accent-primary/10 hover:text-accent-primary transition-colors"
                                        title={visibleKeys[token.id] ? "Hide" : "Show"}
                                    >
                                        {visibleKeys[token.id] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                    <button 
                                        onClick={() => copyToClipboard(token.token, token.id)}
                                        className="p-3 hover:bg-accent-primary/10 hover:text-accent-primary transition-colors border-l border-border-color"
                                        title="Copy"
                                    >
                                        {copiedId === token.id ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                                    </button>
                                </div>
                            </div>
                        </div>
                        <button 
                            onClick={() => handleDeleteToken(token.id)}
                            className="p-3 rounded-xl hover:bg-red-500/10 text-text-muted hover:text-red-500 transition-colors md:self-end"
                            title="Delete Token"
                        >
                            <Trash2 className="w-5 h-5" />
                        </button>
                    </div>
                </motion.div>
            ))
        )}
      </div>

      {/* Instructions using primary key */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass-panel p-8 rounded-2xl">
          <div className="flex items-center gap-3 mb-6">
            <Terminal className="w-6 h-6 text-accent-primary" />
            <h2 className="text-xl font-semibold text-text-main">Как подключиться</h2>
          </div>
          <div className="space-y-4">
            <p className="text-text-muted">
              Используйте ключ в заголовке <code className="text-text-main">Authorization</code>.
            </p>
            
            <div className="bg-bg-main rounded-xl overflow-hidden border border-border-color">
              <div className="flex items-center gap-2 px-4 py-2 bg-accent-primary/10 border-b border-border-color">
                <span className="text-xs text-text-muted">Example Request</span>
              </div>
              <div className="p-4 overflow-x-auto">
                <pre className="font-mono text-sm text-text-muted">
{`curl -X POST https://bublickrust.ru/api/images/upload \\
  -H "Authorization: Bearer ${primaryKey.substring(0, 12)}..." \\
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
           </ul>
        </div>
      </div>
    </div>
  );
};

export default ApiPage;
