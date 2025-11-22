import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Menu } from 'lucide-react';
import Sidebar from '../components/Sidebar';
import StarBackground from '../components/StarBackground';

const Layout = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-bg-main text-text-main transition-colors duration-300">
      <StarBackground />
      
      <Sidebar isOpen={isMobileMenuOpen} onClose={() => setIsMobileMenuOpen(false)} />
      
      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-16 glass-panel border-b border-border-color z-30 flex items-center px-4 justify-between">
         <div className="font-bold text-xl tracking-wider text-text-main">Cosmo</div>
         <button 
           onClick={() => setIsMobileMenuOpen(true)}
           className="p-2 rounded-lg hover:bg-bg-main text-text-main"
         >
           <Menu className="w-6 h-6" />
         </button>
      </div>

      <div className="md:pl-64 min-h-screen pt-16 md:pt-0">
        <main className="p-4 md:p-8 max-w-7xl mx-auto animate-in fade-in duration-500">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default Layout;
