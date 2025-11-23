import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Server, Settings, LogOut, Rocket, X, Image, Users } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

const Sidebar = ({ isOpen, onClose }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
      const checkAdmin = async () => {
          try {
            const token = localStorage.getItem('auth_token');
            if (!token) return;
            const res = await fetch('/api/user/me', { headers: { 'Authorization': `Bearer ${token}` } });
            const data = await res.json();
            if (data.success && data.user.is_admin) setIsAdmin(true);
          } catch(e) { console.error(e); }
      };
      checkAdmin();
  }, []);

  const menuItems = [
    // Only show Dashboard/Overview to admins
    ...(isAdmin ? [{ icon: LayoutDashboard, label: 'Обзор', path: '/dashboard' }] : []),
    { icon: Server, label: 'API Центр', path: '/dashboard/api' },
    { icon: Image, label: 'Галерея', path: '/dashboard/gallery' },
    ...(isAdmin ? [{ icon: Users, label: 'Все пользователи', path: '/dashboard/users' }] : []),
    { icon: Settings, label: 'Настройки', path: '/dashboard/settings' },
  ];

  const isActive = (path) => location.pathname === path;

  const SidebarContent = () => (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="p-6 flex items-center justify-between min-h-[88px]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 min-w-[40px] rounded-lg bg-accent-primary text-accent-secondary flex items-center justify-center shadow-lg shadow-accent-primary/10">
            <Rocket className="w-6 h-6" />
          </div>
          <span className="font-bold text-xl tracking-wider text-text-main md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-300 whitespace-nowrap">Cosmo</span>
        </div>
        {/* Close button for mobile only */}
        <button onClick={onClose} className="md:hidden p-2 text-text-muted hover:text-text-main">
          <X className="w-6 h-6" />
        </button>
      </div>

      <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto overflow-x-hidden">
        {menuItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            onClick={onClose}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 relative overflow-hidden whitespace-nowrap ${
              isActive(item.path) 
                ? 'bg-accent-primary text-accent-secondary shadow-lg' 
                : 'text-text-muted hover:bg-bg-main hover:text-text-main'
            }`}
          >
            <item.icon className={`w-5 h-5 min-w-[20px] ${isActive(item.path) ? 'text-accent-secondary' : 'group-hover:text-text-main transition-colors'}`} />
            <span className="font-medium md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-300">{item.label}</span>
            
            {item.badge && (
                <span className="ml-auto bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full animate-pulse shadow-[0_0_8px_#ef4444] md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-300">
                    {item.badge}
                </span>
            )}
          </Link>
        ))}
      </nav>

      <div className="p-4 border-t border-border-color">
        <button 
          onClick={() => {
              localStorage.removeItem('auth_token');
              navigate('/');
          }}
          className="flex items-center gap-3 px-4 py-3 text-text-muted hover:text-text-main hover:bg-bg-main w-full rounded-xl transition-all whitespace-nowrap overflow-hidden"
        >
          <LogOut className="w-5 h-5 min-w-[20px]" />
          <span className="md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-300">Выход</span>
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar - Always Visible */}
      <div className="hidden md:flex w-20 hover:w-64 h-screen glass-panel border-r border-border-color flex-col fixed left-0 top-0 z-50 transition-all duration-300 ease-in-out group overflow-hidden">
        <SidebarContent />
      </div>

      {/* Mobile Sidebar - Drawer */}
      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onClose}
              className="fixed inset-0 bg-black/50 z-40 md:hidden backdrop-blur-sm"
            />
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed left-0 top-0 h-full w-64 bg-bg-main border-r border-border-color z-50 md:hidden"
            >
              <SidebarContent />
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
};

export default Sidebar;
