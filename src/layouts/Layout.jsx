import React, { useState, useEffect } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { Menu } from 'lucide-react';
import Sidebar from '../components/Sidebar';
import StarBackground from '../components/StarBackground';

const Layout = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const navigate = useNavigate();

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
    <div className="min-h-screen bg-bg-main text-text-main transition-colors duration-300 relative overflow-x-hidden">
      <StarBackground />
      
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
      <div className="md:pl-64 min-h-screen relative">
        <main className="p-4 md:p-8 max-w-7xl mx-auto animate-in fade-in duration-500 pt-24 md:pt-32">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default Layout;
