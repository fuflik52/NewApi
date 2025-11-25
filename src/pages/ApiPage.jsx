import React, { useState, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Key, Copy, Check, Terminal, Shield, Zap, ChevronDown, Eye, EyeOff, RefreshCw, Plus, Trash2, AlertCircle, BarChart2, Database, Server, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { dbService } from '../services/mockDatabase';
import Loader from '../components/Loader';

const ApiPage = () => {
  const [tokens, setTokens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copiedId, setCopiedId] = useState(null);
  const [isCreating, setIsCreating] = useState(false);
  const [visibleKeys, setVisibleKeys] = useState({}); 
  
  // Charts state
  const [chartData, setChartData] = useState([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [timeRange, setTimeRange] = useState('24h'); // '1h', '24h', '7d', '30d', '365d'

  // System Stats State
  const [systemStats, setSystemStats] = useState(null);

  // Code snippets state
  const [activeTab, setActiveTab] = useState('curl');

  const loadData = async () => {
      try {
          const token = localStorage.getItem('auth_token');
          const [tokensRes, userRes, statsRes] = await Promise.all([
              fetch('/api/tokens', { headers: { 'Authorization': `Bearer ${token}` } }),
              fetch('/api/user/me', { headers: { 'Authorization': `Bearer ${token}` } }),
              fetch('/api/system/stats', { headers: { 'Authorization': `Bearer ${token}` } })
          ]);

          if (tokensRes.ok) {
              const data = await tokensRes.json();
              setTokens(data);
          }
          
          if (statsRes.ok) {
              const data = await statsRes.json();
              setSystemStats(data);
          }
          
          if (userRes.ok) {
              const userData = await userRes.json();
              if (userData.success && userData.user.is_admin) {
                  setIsAdmin(true);
                  // Load Analytics if admin
                  const analyticsRes = await fetch(`/api/analytics?range=${timeRange}`, { headers: { 'Authorization': `Bearer ${token}` } });
                  if (analyticsRes.ok) {
                      const analytics = await analyticsRes.json();
                      setChartData(analytics.history || []);
                  }
              }
          }
      } catch (e) {
          console.error(e);
      } finally {
          setLoading(false);
      }
  };

  useEffect(() => {
    loadData();
  }, [timeRange]);

  const handleCreateToken = async () => {
      if (tokens.length >= 3) {
          setError('Maximum 3 tokens allowed');
          setTimeout(() => setError(''), 3000);
          return;
      }

      setIsCreating(true);
      try {
          const token = localStorage.getItem('auth_token');
          const res = await fetch('/api/tokens', {
              method: 'POST',
              headers: { 
                  'Authorization': `Bearer ${token}`,
                  'Content-Type': 'application/json'
              }
          });
          
          if (res.ok) {
              await loadData();
          } else {
              const data = await res.json();
              throw new Error(data.error);
          }
      } catch (e) {
          setError(e.message);
          setTimeout(() => setError(''), 3000);
      } finally {
          setIsCreating(false);
      }
  };

  const [tokenToDelete, setTokenToDelete] = useState(null);

  const handleDeleteToken = async (id) => {
      const token = localStorage.getItem('auth_token');
      await fetch(`/api/tokens/${id}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` }
      });
      setTokenToDelete(null);
      await loadData();
  };

  const toggleVisibility = (id) => {
      setVisibleKeys(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const copyToClipboard = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const primaryKey = tokens.length > 0 ? tokens[0].token : 'sk_live_...';
  const baseUrl = systemStats?.base_url || 'https://bublickrust.ru/api';

  const codeSnippets = {
      curl: `curl -X POST ${baseUrl}/images/upload \\
  -H "Authorization: Bearer ${primaryKey}" \\
  -F "image=@your-file.png"`,
      node: `const fs = require('fs');
const FormData = require('form-data');
const axios = require('axios');

const form = new FormData();
form.append('image', fs.createReadStream('image.png'));

axios.post('${baseUrl}/images/upload', form, {
  headers: {
    'Authorization': 'Bearer ${primaryKey}',
    ...form.getHeaders()
  }
})
.then(res => console.log(res.data))
.catch(err => console.error(err));`,
      python: `import requests

url = "${baseUrl}/images/upload"
headers = {"Authorization": "Bearer ${primaryKey}"}
files = {"image": open("image.png", "rb")}

response = requests.post(url, headers=headers, files=files)
print(response.json())`
  };

  return (
    <div className="space-y-8 pb-10 pt-4">
      
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

      {/* System Status (Global) */}
      {systemStats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="glass-panel p-4 rounded-xl flex items-center gap-4 border border-border-color">
                <div className="p-3 rounded-full bg-emerald-500/10 text-emerald-500">
                    <Server className="w-6 h-6" />
                </div>
                <div>
                    <div className="text-xs text-text-muted uppercase font-bold">Статус API</div>
                    <div className="text-lg font-bold text-text-main flex items-center gap-2">
                        {systemStats.status === 'online' ? 'Online' : 'Offline'}
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    </div>
                </div>
            </div>
            <div className="glass-panel p-4 rounded-xl flex items-center gap-4 border border-border-color">
                <div className="p-3 rounded-full bg-accent-primary/10 text-accent-primary">
                    <Database className="w-6 h-6" />
                </div>
                <div>
                    <div className="text-xs text-text-muted uppercase font-bold">Всего файлов</div>
                    <div className="text-lg font-bold text-text-main">
                        {systemStats.stats.total_images.toLocaleString()} 
                        <span className="text-sm text-text-muted ml-1 font-normal">
                            ({(systemStats.stats.total_storage_bytes / (1024 * 1024)).toFixed(1)} MB)
                        </span>
                    </div>
                </div>
            </div>
            <div className="glass-panel p-4 rounded-xl flex items-center gap-4 border border-border-color">
                <div className="p-3 rounded-full bg-blue-500/10 text-blue-500">
                    <Clock className="w-6 h-6" />
                </div>
                <div>
                    <div className="text-xs text-text-muted uppercase font-bold">Аптайм</div>
                    <div className="text-lg font-bold text-text-main">
                        {systemStats.stats.uptime}
                    </div>
                </div>
            </div>
        </div>
      )}

      {/* API Requests Chart (Only visible if Admin or if we implement user stats) */}
      {chartData.length > 0 && (
        <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-panel rounded-2xl p-6 mb-8 relative overflow-hidden"
        >
            <div className="absolute inset-0 bg-grid-pattern opacity-5 pointer-events-none" />
            <div className="flex items-center justify-between mb-6 relative z-10">
                <div className="flex items-center gap-2">
                    <BarChart2 className="text-accent-primary w-5 h-5" />
                    <h2 className="text-xl font-semibold text-text-main">Активность API</h2>
                </div>
                <div className="flex gap-2">
                    <button 
                        onClick={() => setTimeRange('1h')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                            timeRange === '1h' 
                                ? 'bg-accent-primary text-white' 
                                : 'bg-bg-secondary text-text-muted hover:text-text-main hover:bg-bg-hover'
                        }`}
                    >
                        1Ч
                    </button>
                    <button 
                        onClick={() => setTimeRange('24h')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                            timeRange === '24h' 
                                ? 'bg-accent-primary text-white' 
                                : 'bg-bg-secondary text-text-muted hover:text-text-main hover:bg-bg-hover'
                        }`}
                    >
                        24Ч
                    </button>
                    <button 
                        onClick={() => setTimeRange('7d')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                            timeRange === '7d' 
                                ? 'bg-accent-primary text-white' 
                                : 'bg-bg-secondary text-text-muted hover:text-text-main hover:bg-bg-hover'
                        }`}
                    >
                        НЕДЕЛЯ
                    </button>
                    <button 
                        onClick={() => setTimeRange('30d')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                            timeRange === '30d' 
                                ? 'bg-accent-primary text-white' 
                                : 'bg-bg-secondary text-text-muted hover:text-text-main hover:bg-bg-hover'
                        }`}
                    >
                        МЕСЯЦ
                    </button>
                    <button 
                        onClick={() => setTimeRange('365d')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                            timeRange === '365d' 
                                ? 'bg-accent-primary text-white' 
                                : 'bg-bg-secondary text-text-muted hover:text-text-main hover:bg-bg-hover'
                        }`}
                    >
                        ГОД
                    </button>
                </div>
            </div>
            <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                        <defs>
                            <linearGradient id="colorApi" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="var(--accent-primary)" stopOpacity={0.3}/>
                                <stop offset="95%" stopColor="var(--accent-primary)" stopOpacity={0}/>
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: 'var(--text-muted)', fontSize: 12 }} dy={10} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--text-muted)', fontSize: 12 }} />
                        <Tooltip 
                            contentStyle={{ backgroundColor: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'var(--text-main)' }}
                            itemStyle={{ color: 'var(--accent-primary)' }}
                        />
                        <Area type="monotone" dataKey="requests" stroke="var(--accent-primary)" strokeWidth={2} fillOpacity={1} fill="url(#colorApi)" />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </motion.div>
      )}

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
            <Loader />
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
                                <span className="text-xs text-text-muted px-2 py-0.5 rounded-full bg-bg-main border border-border-color ml-auto md:ml-0">
                                    Запросов: {token.requests_count || 0}
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
                            onClick={() => setTokenToDelete(token.id)}
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

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
          {tokenToDelete && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
                onClick={() => setTokenToDelete(null)}
              >
                  <motion.div 
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.95, opacity: 0 }}
                    onClick={e => e.stopPropagation()}
                    className="bg-bg-panel border border-border-color rounded-2xl p-6 max-w-md w-full shadow-2xl"
                  >
                      <div className="flex items-center gap-3 text-red-500 mb-4">
                          <div className="p-3 rounded-full bg-red-500/10">
                              <Trash2 className="w-6 h-6" />
                          </div>
                          <h3 className="text-xl font-bold">Удалить ключ?</h3>
                      </div>
                      
                      <p className="text-text-muted mb-6 leading-relaxed">
                          Вы уверены, что хотите удалить этот API ключ? <br/>
                          <span className="text-red-400 font-medium">Это действие нельзя отменить</span>, и все приложения, использующие этот ключ, перестанут работать.
                      </p>

                      <div className="flex items-center justify-end gap-3">
                          <button 
                              onClick={() => setTokenToDelete(null)}
                              className="px-4 py-2 rounded-xl text-text-muted hover:text-text-main hover:bg-white/5 transition-colors font-medium"
                          >
                              Отмена
                          </button>
                          <button 
                              onClick={() => handleDeleteToken(tokenToDelete)}
                              className="px-4 py-2 rounded-xl bg-red-500 hover:bg-red-600 text-white font-bold transition-all shadow-lg shadow-red-500/20"
                          >
                              Удалить
                          </button>
                      </div>
                  </motion.div>
              </motion.div>
          )}
      </AnimatePresence>

      {/* Instructions using primary key */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 glass-panel p-8 rounded-2xl">
          <div className="flex items-center gap-3 mb-6">
            <Terminal className="w-6 h-6 text-accent-primary" />
            <h2 className="text-xl font-semibold text-text-main">Документация API</h2>
          </div>
          
          <div className="mb-6">
              <div className="text-xs text-text-muted uppercase font-bold mb-2">Base URL</div>
              <div className="p-3 bg-bg-main rounded-lg border border-border-color font-mono text-sm text-text-main flex items-center justify-between">
                  <span>{baseUrl}</span>
                  <button 
                    onClick={() => copyToClipboard(baseUrl, 'url')}
                    className="text-text-muted hover:text-text-main"
                  >
                    {copiedId === 'url' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  </button>
              </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 mb-4">
              {['curl', 'node', 'python'].map(tab => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        activeTab === tab 
                        ? 'bg-accent-primary text-accent-secondary' 
                        : 'bg-bg-main text-text-muted hover:text-text-main'
                    }`}
                  >
                      {tab.charAt(0).toUpperCase() + tab.slice(1)}
                  </button>
              ))}
          </div>

          <div className="bg-bg-main rounded-xl overflow-hidden border border-border-color relative">
              <div className="flex items-center justify-between px-4 py-2 bg-black/20 border-b border-border-color">
                <span className="text-xs text-text-muted font-mono">POST {baseUrl}/images/upload</span>
                <button 
                    onClick={() => copyToClipboard(codeSnippets[activeTab], 'code')}
                    className="text-text-muted hover:text-text-main"
                >
                    {copiedId === 'code' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
              <div className="p-4 overflow-x-auto">
                <pre className="font-mono text-sm text-text-muted leading-relaxed">
                    {codeSnippets[activeTab]}
                </pre>
              </div>
          </div>
        </div>

        <div className="glass-panel p-8 rounded-2xl flex flex-col">
           <h3 className="text-lg font-semibold text-text-main mb-4">Параметры запроса</h3>
           <div className="space-y-4">
               <div>
                   <div className="text-xs text-text-muted uppercase font-bold mb-1">Header</div>
                   <div className="p-2 bg-bg-main rounded border border-border-color font-mono text-sm text-text-main break-all">
                       Authorization: Bearer TOKEN
                   </div>
               </div>
               <div>
                   <div className="text-xs text-text-muted uppercase font-bold mb-1">Body (Multipart)</div>
                   <div className="p-2 bg-bg-main rounded border border-border-color font-mono text-sm text-text-main">
                       image: (File)
                   </div>
               </div>
               <div className="mt-4 pt-4 border-t border-border-color">
                   <div className="text-xs text-text-muted uppercase font-bold mb-1">Response (JSON)</div>
                   <pre className="text-xs text-emerald-400 font-mono">
{`{
  "success": true,
  "directUrl": "...",
  "file": { ... }
}`}
                   </pre>
               </div>
           </div>
        </div>
      </div>
    </div>
  );
};

export default ApiPage;
