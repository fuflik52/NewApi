import React, { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Menu } from 'lucide-react';
import Sidebar from '../components/Sidebar';
import StarBackground from '../components/StarBackground';
import { useTheme } from '../context/ThemeContext';

const Layout = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { background } = useTheme();

  // Admin Claim command & Access Control
  useEffect(() => {
      const checkAccess = async () => {
          const token = localStorage.getItem('auth_token');
          if (!token) return; // Auth page handles redirect if needed

          try {
              const res = await fetch('/api/user/me', { headers: { 'Authorization': `Bearer ${token}` } });
              const data = await res.json();
              
              if (data.success) {
                  const isAdmin = data.user.is_admin;
                  const adminRoutes = ['/dashboard', '/dashboard/users', '/dashboard/figma'];
                  
                  // If trying to access admin route without permission
                  if (adminRoutes.includes(location.pathname) && !isAdmin) {
                      navigate('/dashboard/api', { replace: true });
                  }
              }
          } catch (e) { console.error(e); }
      };
      checkAccess();

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
  }, [location.pathname, navigate]);

  return (
    <div className="min-h-screen bg-bg-main text-text-main transition-colors duration-300 relative overflow-x-hidden">
      {(background === 'grid' || background === 'both') && (
        <div className="fixed inset-0 bg-grid-pattern pointer-events-none z-0" />
      )}
      {(background === 'stars' || background === 'both') && (
        <StarBackground />
      )}
      
      <Sidebar 
        isOpen={isMobileMenuOpen}  
        onClose={() => setIsMobileMenuOpen(false)} 
      />
      
      {/* Mobile Menu Button (Fixed top-left) */}
      <div className="md:hidden fixed top-4 left-4 z-50">
         <button onClick={() => setIsMobileMenuOpen(true)} className="p-2 glass-panel rounded-lg text-text-main">
           <Menu className="w-6 h-6" />
         </button>
      </div>

      {/* Main Content Area */}
      <div className="md:pl-20 min-h-screen relative transition-all duration-300">
        <main className="p-4 md:p-8 max-w-7xl mx-auto animate-in fade-in duration-500 pt-24 md:pt-32">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default Layout;
