  // ... (imports)
  import { Menu, Bell, Check, X, LogOut } from 'lucide-react';
  // ...

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [invites, setInvites] = useState([]);
  const [myTeamStatus, setMyTeamStatus] = useState({ inTeam: false, isCaptain: false }); // Track team status
  const [confirmModal, setConfirmModal] = useState(null); // { title, action, onConfirm }

  // ... loadInvites ... 
  // Modify loadInvites to also check if I am in a team (for leave button)
  const loadState = async () => {
      try {
          const token = localStorage.getItem('auth_token');
          if(!token) return;
          const res = await fetch('/api/invaders/state', { headers: { 'Authorization': `Bearer ${token}` } });
          const data = await res.json();
          if(data.invites) setInvites(data.invites);
          
          // Determine if I should show Leave button
          // I am in a team IF: I am NOT a captain AND there is a captain (meaning I accepted an invite)
          const amInTeam = !data.is_captain && data.captain && data.captain.id !== data.invites[0]?.receiver_id; // rough check, better:
          // The API returns `captain` object. If captain.id != myId, I am a member.
          // We need myId. Let's decode token or fetch user me once.
          // Simpler: API returns `is_captain`. If !is_captain and `team` has members or captain is set?
          // Actually, `data.captain` is set if I am in a team (member or captain).
          // If `is_captain` is false AND `captain` exists, I am a member -> Show Leave.
          
          setMyTeamStatus({ 
              inTeam: !data.is_captain && !!data.captain, 
              isCaptain: data.is_captain 
          });

      } catch(e) { console.error(e); }
  };

  // Update poll
  useEffect(() => {
      const token = localStorage.getItem('auth_token');
      if (!token) { navigate('/', { replace: true }); }
      else { loadState(); }
      const interval = setInterval(loadState, 10000); // Faster poll
      return () => clearInterval(interval);
  }, [navigate, location]);

  const handleLeaveTeam = async () => {
      const token = localStorage.getItem('auth_token');
      await fetch('/api/invaders/leave', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
      });
      window.location.reload();
  };

  // ...

  return (
    <div className="min-h-screen bg-bg-main text-text-main transition-colors duration-300 relative overflow-x-hidden">
      <StarBackground />
      
      <Sidebar 
        isOpen={isMobileMenuOpen} 
        onClose={() => setIsMobileMenuOpen(false)} 
        pendingInvites={invites.length}
      />
      
      {/* Mobile Menu Button (Fixed top-left) */}
      <div className="md:hidden fixed top-4 left-4 z-50">
         <button onClick={() => setIsMobileMenuOpen(true)} className="p-2 glass-panel rounded-lg text-text-main">
           <Menu className="w-6 h-6" />
         </button>
      </div>

      {/* Main Content Area */}
      <div className="md:pl-64 min-h-screen relative">
        
        {/* Top Right Controls (Absolute position in content area) */}
        <div className="absolute top-6 right-6 z-40 flex items-center gap-3">
            
            {/* Leave Team Button (Only if in team and not captain) */}
            {myTeamStatus.inTeam && (
                <button 
                    onClick={() => setConfirmModal({
                        title: 'Покинуть команду?',
                        onConfirm: handleLeaveTeam
                    })}
                    className="p-3 glass-panel rounded-xl border border-border-color hover:border-red-500/50 hover:text-red-500 transition-all group"
                    title="Покинуть команду"
                >
                    <LogOut className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
                </button>
            )}

            {/* Notifications Bell */}
            <div className="relative">
                <button 
                    onClick={() => setNotificationsOpen(!notificationsOpen)}
                    className="p-3 glass-panel rounded-xl border border-border-color hover:border-accent-primary transition-all relative"
                >
                    <Bell className={`w-5 h-5 ${invites.length > 0 ? 'text-green-400 fill-green-400/20' : 'text-text-muted'}`} />
                    {invites.length > 0 && (
                        <span className="absolute top-2 right-2.5 w-2 h-2 bg-green-500 rounded-full animate-pulse shadow-[0_0_8px_#22c55e]"></span>
                    )}
                </button>

                <AnimatePresence>
                    {notificationsOpen && (
                        <motion.div 
                            initial={{ opacity: 0, scale: 0.95, y: 10 }} 
                            animate={{ opacity: 1, scale: 1, y: 0 }} 
                            exit={{ opacity: 0, scale: 0.95, y: 10 }}
                            className="absolute right-0 mt-3 w-80 glass-panel border border-border-color rounded-xl p-4 shadow-2xl backdrop-blur-xl bg-[#0a0a0a]/90 origin-top-right"
                        >
                            <div className="flex justify-between items-center mb-3">
                                <h3 className="text-xs font-bold text-text-muted uppercase tracking-wider">Уведомления</h3>
                                <button onClick={() => setNotificationsOpen(false)}><X size={14} className="text-text-muted hover:text-white"/></button>
                            </div>
                            
                            {invites.length === 0 ? (
                                <div className="text-center text-text-muted py-6 text-sm">Пусто...</div>
                            ) : (
                                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                                    {invites.map(inv => (
                                        <div key={inv.id} className="flex items-center justify-between bg-white/5 p-3 rounded-lg border border-white/5">
                                            <div className="flex items-center gap-3">
                                                {inv.sender?.avatar ? (
                                                    <img src={`https://cdn.discordapp.com/avatars/${inv.sender_id}/${inv.sender.avatar}.png`} className="w-8 h-8 rounded-full" />
                                                ) : (
                                                    <div className="w-8 h-8 bg-gray-700 rounded-full"></div>
                                                )}
                                                <span className="text-sm font-bold">{inv.sender?.username}</span>
                                            </div>
                                            <div className="flex gap-2">
                                                <button onClick={() => respondInvite(inv.id, 'accept')} className="p-1.5 bg-green-500/10 hover:bg-green-500/20 text-green-500 rounded transition-colors"><Check size={16}/></button>
                                                <button onClick={() => respondInvite(inv.id, 'reject')} className="p-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded transition-colors"><X size={16}/></button>
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

        <main className="p-4 md:p-8 max-w-7xl mx-auto animate-in fade-in duration-500 pt-20">
          <Outlet />
        </main>
      </div>

      {/* Custom Confirm Modal */}
      <AnimatePresence>
        {confirmModal && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                <motion.div 
                    initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
                    className="bg-[#111] border border-border-color rounded-2xl p-6 max-w-sm w-full shadow-2xl"
                >
                    <h3 className="text-lg font-bold text-white mb-2">{confirmModal.title}</h3>
                    <p className="text-text-muted text-sm mb-6">Вы уверены? Это действие нельзя отменить.</p>
                    <div className="flex gap-3 justify-end">
                        <button 
                            onClick={() => setConfirmModal(null)}
                            className="px-4 py-2 rounded-lg text-text-muted hover:text-white hover:bg-white/5 transition-colors text-sm"
                        >
                            Отмена
                        </button>
                        <button 
                            onClick={() => { confirmModal.onConfirm(); setConfirmModal(null); }}
                            className="px-4 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white text-sm font-bold transition-colors shadow-lg shadow-red-500/20"
                        >
                            Подтвердить
                        </button>
                    </div>
                </motion.div>
            </div>
        )}
      </AnimatePresence>

    </div>
  );
};
