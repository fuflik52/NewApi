import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ExternalLink, Users, Activity } from 'lucide-react';
import Loader from '../components/Loader';
import FigmaColorIcon from '../components/icons/FigmaColorIcon';

const AdminFigma = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const token = localStorage.getItem('auth_token');
        const res = await fetch('/api/admin/figma/users', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (res.ok) {
            const data = await res.json();
            setUsers(data);
        } else {
            console.error('Failed to load figma users');
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  if (loading) return <Loader />;

  return (
    <div className="space-y-8 pb-10">
       <header>
        <h1 className="text-3xl font-bold text-text-main mb-2 flex items-center gap-3">
          <FigmaColorIcon className="w-8 h-8" />
          Пользователи Figma
        </h1>
        <p className="text-text-muted">Мониторинг активности плагина "BublickRust"</p>
      </header>

      <div className="glass-panel rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border-color bg-bg-panel/50">
                <th className="px-6 py-4 text-left text-xs font-bold text-text-muted uppercase tracking-wider">Пользователь</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-text-muted uppercase tracking-wider">Активность</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-text-muted uppercase tracking-wider">Последний проект</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-text-muted uppercase tracking-wider">Использований</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-color">
              {users.map((user, index) => (
                <motion.tr 
                  key={user.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="hover:bg-white/5 transition-colors"
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-3">
                      <img className="h-10 w-10 rounded-full bg-bg-main border border-border-color" src={user.avatar} alt="" />
                      <div>
                        <div className="text-sm font-medium text-text-main">{user.username}</div>
                        <div className="text-xs text-text-muted">ID: {user.id}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-text-main">
                      {new Date(user.last_active).toLocaleDateString()}
                    </div>
                    <div className="text-xs text-text-muted">
                      {new Date(user.last_active).toLocaleTimeString()}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {user.figma_file_id && user.figma_file_id !== '?' ? (
                        <a 
                          href={`https://www.figma.com/file/${user.figma_file_id}`} 
                          target="_blank" 
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-sm text-accent-primary hover:text-accent-primary/80 transition-colors"
                    >
                      <FigmaColorIcon className="w-4 h-4" />
                      {user.figma_file_name || 'Unknown File'}
                      <ExternalLink className="w-3 h-3" />
                    </a>
                ) : (
                    <div className="inline-flex items-center gap-2 text-sm text-text-muted">
                      <FigmaColorIcon className="w-4 h-4" />
                      {user.figma_file_name || 'Unknown File'}
                    </div>
                )}
                  </td>
                   <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                        <Activity className="w-4 h-4 text-emerald-500" />
                        <span className="text-sm font-bold text-text-main">{user.usage_count}</span>
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
        {users.length === 0 && (
            <div className="p-12 text-center text-text-muted">
                Нет данных о пользователях.
            </div>
        )}
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="glass-panel p-6 rounded-2xl">
              <h3 className="text-lg font-semibold text-text-main mb-4 flex items-center gap-2">
                  <Users className="w-5 h-5 text-accent-primary" />
                  Всего пользователей
              </h3>
              <div className="text-3xl font-bold text-text-main">{users.length}</div>
          </div>
           <div className="glass-panel p-6 rounded-2xl">
              <h3 className="text-lg font-semibold text-text-main mb-4 flex items-center gap-2">
                  <Activity className="w-5 h-5 text-emerald-500" />
                  Всего генераций
              </h3>
              <div className="text-3xl font-bold text-text-main">
                  {users.reduce((acc, u) => acc + u.usage_count, 0)}
              </div>
          </div>
      </div>
    </div>
  );
};

export default AdminFigma;

