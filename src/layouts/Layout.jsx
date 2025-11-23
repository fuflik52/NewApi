import React, { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Menu, Bell, Check, X } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import Sidebar from '../components/Sidebar';
import StarBackground from '../components/StarBackground';

const Layout = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [invites, setInvites] = useState([]);
  const navigate = useNavigate();
  const location = useLocation();

  const loadInvites = async () => {
      try {
          const token = localStorage.getItem('auth_token');
          if(!token) return;
          const res = await fetch('/api/invaders/state', { headers: { 'Authorization': `Bearer ${token}` } });
          const data = await res.json();
          if(data.invites) setInvites(data.invites);
      } catch(e) { console.error(e); }
  };

  useEffect(() => {
      const token = localStorage.getItem('auth_token');
      if (!token) { navigate('/', { replace: true }); }
      else { loadInvites(); }
      
      // Poll invites every 30s
      const interval = setInterval(loadInvites, 30000);
      return () => clearInterval(interval);
  }, [navigate, location]);

  const respondInvite = async (id, action) => {
      const token = localStorage.getItem('auth_token');
      await fetch('/api/invaders/respond', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ invite_id: id, action })
      });
      loadInvites();
      // Reload current page if it is base-invaders to update state
      if (location.pathname.includes('base-invaders')) {
          window.location.reload();
      }
  };

  // Admin Claim command
  useEffect(() => {
      window.bublickAA = async () => {
          try {
              const token = localStorage.getItem('auth_token');
              const res = await fetch('/api/admin/claim', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                  body: JSON.stringify({ code: 'bublickAA' })
              });
              const data = await res.json();
              if (data.success) {
                  console.log('%c Access Granted. Reloading...', 'color: #00ff00; font-size: 20px;');
                  setTimeout(() => window.location.reload(), 1000);
              }
          } catch (e) { console.error(e); }
      };
  }, []);

  return (
    <div className="min-h-screen bg-bg-main text-text-main transition-colors duration-300">
      <StarBackground />
      
      <Sidebar 
        isOpen={isMobileMenuOpen} 
        onClose={() => setIsMobileMenuOpen(false)} 
        pendingInvites={invites.length}
      />
      
      {/* Global Header (Desktop + Mobile) */}
      <div className="fixed top-0 right-0 left-0 md:left-64 h-16 z-30 flex items-center justify-between px-6 py-2 glass-panel border-b border-border-color md:bg-transparent md:border-none md:glass-panel-none">
         
         {/* Mobile Toggle */}
         <div className="flex items-center gap-4 md:hidden">
             <div className="font-bold text-xl tracking-wider text-text-main">Cosmo</div>
             <button onClick={() => setIsMobileMenuOpen(true)} className="p-2 rounded-lg hover:bg-bg-main text-text-main">
               <Menu className="w-6 h-6" />
             </button>
         </div>

         {/* Spacer for Desktop layout */}
         <div className="hidden md:block"></div>

         {/* Notifications Bell */}
         <div className="relative ml-auto">
            <button 
                onClick={() => setNotificationsOpen(!notificationsOpen)}
                className="p-2 rounded-full hover:bg-white/5 transition-colors relative"
            >
                <Bell className={`w-6 h-6 ${invites.length > 0 ? 'text-green-400 fill-green-400/20' : 'text-text-muted'}`} />
                {invites.length > 0 && (
                    <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse shadow-[0_0_10px_#22c55e]"></span>
                )}
            </button>

            <AnimatePresence>
                {notificationsOpen && (
                    <motion.div 
                        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}
                        className="absolute right-0 mt-4 w-80 glass-panel border border-border-color rounded-xl p-4 z-50 shadow-2xl backdrop-blur-xl bg-[#0a0a0a]/90"
                    >
                        <h3 className="text-xs font-bold text-text-muted uppercase mb-3 tracking-wider">Приглашения</h3>
                        {invites.length === 0 ? (
                            <div className="text-center text-text-muted py-4 text-sm">Нет новых уведомлений</div>
                        ) : (
                            <div className="space-y-2">
                                {invites.map(inv => (
                                    <div key={inv.id} className="flex items-center justify-between bg-white/5 p-3 rounded-lg">
                                        <div className="flex items-center gap-3">
                                            {inv.sender?.avatar ? (
                                                <img src={`https://cdn.discordapp.com/avatars/${inv.sender_id}/${inv.sender.avatar}.png`} className="w-8 h-8 rounded-full" />
                                            ) : (
                                                <div className="w-8 h-8 bg-gray-700 rounded-full"></div>
                                            )}
                                            <span className="text-sm font-bold">{inv.sender?.username}</span>
                                        </div>
                                        <div className="flex gap-2">
                                            <button onClick={() => respondInvite(inv.id, 'accept')} className="p-1.5 hover:bg-green-500/20 text-green-500 rounded transition-colors"><Check size={16}/></button>
                                            <button onClick={() => respondInvite(inv.id, 'reject')} className="p-1.5 hover:bg-red-500/20 text-red-500 rounded transition-colors"><X size={16}/></button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
         </div>
      </div>

      <div className="md:pl-64 min-h-screen pt-20 md:pt-24">
        <main className="p-4 md:p-8 max-w-7xl mx-auto animate-in fade-in duration-500">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default Layout;
