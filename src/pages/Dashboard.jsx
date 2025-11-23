import React, { useState, useEffect } from 'react';
import { Activity, Users, Database, Globe, Server, Cpu, Zap } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, Legend } from 'recharts';
import { motion } from 'framer-motion';
import { useTheme } from '../context/ThemeContext';
import { dbService } from '../services/mockDatabase';

const StatCard = ({ title, value, change, icon: Icon }) => (
  <div className="glass-panel p-6 rounded-2xl relative overflow-hidden hover:translate-y-[-2px] transition-transform duration-300 group">
    <div className="absolute top-0 right-0 p-4 opacity-5 text-accent-primary group-hover:opacity-10 transition-opacity">
      <Icon className="w-24 h-24" />
    </div>
    <div className="relative z-10">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 rounded-lg bg-bg-main text-accent-primary">
          <Icon className="w-6 h-6" />
        </div>
        <h3 className="text-text-muted font-medium">{title}</h3>
      </div>
      <div className="flex items-end gap-4">
        <span className="text-3xl font-bold text-text-main">{value}</span>
        <span className={`text-sm font-medium px-2 py-1 rounded-full bg-bg-main ${change.startsWith('+') ? 'text-emerald-400' : 'text-red-400'}`}>
          {change}
        </span>
      </div>
    </div>
  </div>
);

const CircularGauge = ({ value, title, icon: Icon }) => {
  const circumference = 2 * Math.PI * 40;
  const strokeDashoffset = circumference - (value / 100) * circumference;

  return (
    <div className="flex flex-col items-center justify-center p-4">
      <div className="relative w-32 h-32">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="40" fill="transparent" stroke="var(--bg-main)" strokeWidth="8" />
          <motion.circle 
            cx="50" 
            cy="50" 
            r="40" 
            fill="transparent" 
            stroke="var(--accent-primary)" 
            strokeWidth="8" 
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <Icon className="w-6 h-6 text-text-muted mb-1" />
          <span className="text-xl font-bold text-text-main">{Math.round(value)}%</span>
        </div>
      </div>
      <h4 className="mt-2 font-medium text-text-muted">{title}</h4>
    </div>
  );
};

const Dashboard = () => {
  const [stats, setStats] = useState({ users: 0, uploads: 0, storage_bytes: 0, requests: 0 });
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  // Real data state
  const [chartData, setChartData] = useState([]);
  const [endpointData, setEndpointData] = useState([]);
  const [statusData, setStatusData] = useState([]);
  
  // Live simulation state
  const [cpu, setCpu] = useState(42);
  const [ram, setRam] = useState(68);
  const [uptime, setUptime] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });

  useEffect(() => {
    const checkUser = async () => {
        try {
            const token = localStorage.getItem('auth_token');
            if (!token) return;

            const res = await fetch('/api/user/me', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (data.success && data.user.is_admin) {
                setIsAdmin(true);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };
    checkUser();
  }, []);

  useEffect(() => {
    if (!isAdmin) return;

    const fetchStats = async () => {
        try {
            const res = await fetch('/api/stats');
            const data = await res.json();
            setStats(data);
        } catch (e) { console.error(e); }
    };
    fetchStats();

    // Mock chart data for now
    const fetchData = async () => {
        const stats = await dbService.getUsageStats(30);
        setChartData(stats);

        const endpoints = await dbService.getEndpointStats();
        setEndpointData(endpoints);

        const statuses = await dbService.getStatusDistribution();
        setStatusData(statuses);
    };
    fetchData();
  }, [isAdmin]);

  // Simulate fluctuating server stats (CPU/RAM only)
  useEffect(() => {
    if (!isAdmin) return;
    const interval = setInterval(() => {
      setCpu(prev => Math.max(30, Math.min(80, prev + (Math.random() * 10 - 5))));
      setRam(prev => Math.max(50, Math.min(90, prev + (Math.random() * 6 - 3))));
    }, 2000);
    return () => clearInterval(interval);
  }, [isAdmin]);

  // Real Uptime from consistent start time
  useEffect(() => {
    if (!isAdmin) return;
    const updateUptime = () => {
        const start = dbService.getUptimeStart();
        const now = new Date();
        const diff = now - start;
        
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
        const minutes = Math.floor((diff / 1000 / 60) % 60);
        const seconds = Math.floor((diff / 1000) % 60);

        setUptime({ days, hours, minutes, seconds });
    };

    const interval = setInterval(updateUptime, 1000);
    updateUptime(); // Initial call

    return () => clearInterval(interval);
  }, [isAdmin]);

  if (loading) return <div className="p-8">Loading...</div>;

  if (!isAdmin) {
      return (
          <div className="glass-panel p-8 rounded-2xl text-center">
              <h2 className="text-2xl font-bold text-text-main mb-4">Доступ ограничен</h2>
              <p className="text-text-muted">Эта панель доступна только администраторам.</p>
          </div>
      );
  }

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold text-text-main mb-2">Панель управления</h1>
        <p className="text-text-muted">Добро пожаловать на борт, Командор.</p>
      </header>

      {/* Top Stats - Real DB Data */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          title="Всего запросов" 
          value={stats.requests.toLocaleString()} 
          change="+0%" 
          icon={Activity} 
        />
        <StatCard 
          title="Пользователи" 
          value={stats.users.toString()} 
          change="+0%" 
          icon={Users} 
        />
        <StatCard 
          title="База данных" 
          value={`${(stats.storage_bytes / (1024 * 1024)).toFixed(2)} MB`} 
          change="+0%" 
          icon={Database} 
        />
        <StatCard 
          title="Статус сети" 
          value="100%" 
          change="Stable" 
          icon={Globe} 
        />
      </div>

      {/* Main Chart */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="glass-panel rounded-2xl p-8"
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-text-main">Общая активность</h2>
          <div className="flex gap-2">
            <span className="w-3 h-3 rounded-full bg-accent-primary"></span>
            <span className="text-sm text-text-muted">Трафик (запросы)</span>
          </div>
        </div>
        <div className="h-[350px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="colorTraffic" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--chart-color)" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="var(--chart-color)" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: 'var(--text-muted)', fontSize: 12 }} dy={10} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--text-muted)', fontSize: 12 }} />
              <Tooltip 
                contentStyle={{ backgroundColor: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'var(--text-main)' }}
                itemStyle={{ color: 'var(--chart-color)' }}
              />
              <Area type="monotone" dataKey="requests" stroke="var(--chart-color)" strokeWidth={2} fillOpacity={1} fill="url(#colorTraffic)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </motion.div>

      {/* Grid of New Visuals */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Status Distribution (Donut) */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="glass-panel rounded-2xl p-6 flex flex-col"
        >
          <h3 className="text-lg font-semibold text-text-main mb-4">Распределение статусов</h3>
          <div className="flex-1 min-h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} stroke="rgba(0,0,0,0)" />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ backgroundColor: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'var(--text-main)' }}
                  itemStyle={{ color: 'var(--text-main)' }}
                />
                <Legend verticalAlign="bottom" height={36} iconType="circle" />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Endpoint Usage (Bar) */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="glass-panel rounded-2xl p-6 flex flex-col"
        >
          <h3 className="text-lg font-semibold text-text-main mb-4">Топ эндпоинтов</h3>
          <div className="flex-1 min-h-[250px]">
             <ResponsiveContainer width="100%" height="100%">
                <BarChart data={endpointData} layout="vertical" margin={{ left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border-color)" />
                  <XAxis type="number" hide />
                  <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fill: 'var(--text-muted)', fontSize: 12 }} width={100} />
                  <Tooltip 
                    cursor={{ fill: 'var(--bg-main)' }}
                    contentStyle={{ backgroundColor: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'var(--text-main)' }}
                    itemStyle={{ color: 'var(--chart-color)' }}
                  />
                  <Bar dataKey="requests" fill="var(--chart-color)" radius={[0, 4, 4, 0]} barSize={20} />
                </BarChart>
             </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Server Health (Gauges) */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="glass-panel rounded-2xl p-6"
        >
          <h3 className="text-lg font-semibold text-text-main mb-4">Здоровье сервера</h3>
          <div className="flex flex-col items-center justify-center h-full pb-4">
             <div className="flex items-center justify-around w-full">
               <CircularGauge value={cpu} title="CPU Usage" icon={Cpu} />
               <CircularGauge value={ram} title="RAM Usage" icon={Server} />
             </div>
             <div className="mt-6 w-full bg-bg-main rounded-xl p-4 border border-border-color">
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="text-text-muted">Uptime</span>
                  <span className="text-text-main font-mono">
                    {uptime.days}d {uptime.hours}h {uptime.minutes}m <span className="text-accent-primary">{uptime.seconds}s</span>
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-text-muted">Last Backup</span>
                  <span className="text-emerald-400">2 hours ago</span>
                </div>
             </div>
          </div>
        </motion.div>

      </div>
    </div>
  );
};

export default Dashboard;
