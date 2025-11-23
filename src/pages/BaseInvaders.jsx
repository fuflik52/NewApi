import React, { useState, useEffect } from 'react';
import { Plus, Search, Bell, Check, X, User, Shield, Sword } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const BaseInvaders = () => {
    const [state, setState] = useState({ invites: [], team: [] });
    const [currentUser, setCurrentUser] = useState(null);
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [searchResults, setSearchResults] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [notificationsOpen, setNotificationsOpen] = useState(false);

    useEffect(() => {
        loadData();
        loadUser();
    }, []);

    const loadUser = async () => {
        const token = localStorage.getItem('auth_token');
        const res = await fetch('/api/user/me', { headers: { Authorization: `Bearer ${token}` } });
        const data = await res.json();
        if (data.success) setCurrentUser(data.user);
    };

    const loadData = async () => {
        const token = localStorage.getItem('auth_token');
        const res = await fetch('/api/invaders/state', { headers: { Authorization: `Bearer ${token}` } });
        const data = await res.json();
        setState(data);
    };

    const handleSearch = async (q) => {
        setSearchQuery(q);
        if (q.length < 2) { setSearchResults([]); return; }
        const token = localStorage.getItem('auth_token');
        const res = await fetch(`/api/users/search?q=${q}`, { headers: { Authorization: `Bearer ${token}` } });
        const data = await res.json();
        setSearchResults(data);
    };

    const sendInvite = async (receiverId) => {
        const token = localStorage.getItem('auth_token');
        await fetch('/api/invaders/invite', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ receiver_id: receiverId })
        });
        setIsSearchOpen(false);
        setSearchQuery('');
        loadData();
    };

    const respondInvite = async (id, action) => {
        const token = localStorage.getItem('auth_token');
        await fetch('/api/invaders/respond', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ invite_id: id, action })
        });
        loadData();
    };

    // Build slots (5 total: 2 left, Center Captain, 2 right)
    // For simplicity, we just fill slots with invited people
    const slots = [0, 1, 2, 3]; // 4 empty slots
    const teamMembers = state.team || [];

    return (
        <div className="min-h-[calc(100vh-100px)] relative">
            {/* Header / Notifications */}
            <div className="flex justify-between items-center mb-12">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-red-500/10 rounded-xl text-red-500 border border-red-500/20">
                        <Sword className="w-8 h-8" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-text-main tracking-wider">BASE INVADERS</h1>
                        <p className="text-text-muted text-sm">Собери свою команду</p>
                    </div>
                </div>

                <div className="relative">
                    <button 
                        onClick={() => setNotificationsOpen(!notificationsOpen)}
                        className="p-3 glass-panel rounded-xl border border-border-color hover:border-accent-primary transition-colors relative"
                    >
                        <Bell className={`w-6 h-6 ${state.invites.length > 0 ? 'text-green-400 fill-green-400/20' : 'text-text-muted'}`} />
                        {state.invites.length > 0 && (
                            <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full animate-pulse"></span>
                        )}
                    </button>

                    <AnimatePresence>
                        {notificationsOpen && (
                            <motion.div 
                                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}
                                className="absolute right-0 mt-2 w-80 glass-panel border border-border-color rounded-xl p-4 z-50 shadow-2xl"
                            >
                                <h3 className="text-sm font-bold text-text-muted uppercase mb-3">Приглашения</h3>
                                {state.invites.length === 0 ? (
                                    <div className="text-center text-text-muted py-4 text-sm">Нет новых приглашений</div>
                                ) : (
                                    <div className="space-y-2">
                                        {state.invites.map(inv => (
                                            <div key={inv.id} className="flex items-center justify-between bg-bg-main/50 p-2 rounded-lg">
                                                <div className="flex items-center gap-2">
                                                    {inv.sender?.avatar ? (
                                                        <img src={`https://cdn.discordapp.com/avatars/${inv.sender_id}/${inv.sender.avatar}.png`} className="w-8 h-8 rounded-full" />
                                                    ) : (
                                                        <div className="w-8 h-8 bg-gray-700 rounded-full"></div>
                                                    )}
                                                    <span className="text-sm font-bold">{inv.sender?.username}</span>
                                                </div>
                                                <div className="flex gap-1">
                                                    <button onClick={() => respondInvite(inv.id, 'accept')} className="p-1 hover:bg-green-500/20 text-green-500 rounded"><Check size={16}/></button>
                                                    <button onClick={() => respondInvite(inv.id, 'reject')} className="p-1 hover:bg-red-500/20 text-red-500 rounded"><X size={16}/></button>
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

            {/* TEAM GRID */}
            <div className="flex flex-wrap justify-center items-center gap-6 mt-20">
                
                {/* Left Slots */}
                {[0, 1].map(i => {
                    const member = teamMembers[i];
                    return (
                        <SlotCard 
                            key={i} 
                            member={member} 
                            onAdd={() => setIsSearchOpen(true)} 
                        />
                    );
                })}

                {/* CENTER CAPTAIN (YOU) */}
                <motion.div 
                    initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                    className="w-64 h-96 glass-panel border-2 border-accent-primary rounded-2xl flex flex-col items-center justify-center relative overflow-hidden shadow-[0_0_50px_rgba(255,255,255,0.1)] z-10"
                >
                    <div className="absolute top-4 text-accent-primary"><Shield className="w-6 h-6" /></div>
                    <div className="w-32 h-32 rounded-full border-4 border-accent-primary p-1 mb-6">
                        {currentUser?.avatar ? (
                            <img src={`https://cdn.discordapp.com/avatars/${currentUser.id}/${currentUser.avatar}.png`} className="w-full h-full rounded-full object-cover" />
                        ) : (
                            <div className="w-full h-full bg-gray-700 rounded-full"></div>
                        )}
                    </div>
                    <h2 className="text-xl font-bold text-white">{currentUser?.username || 'Captain'}</h2>
                    <p className="text-text-muted text-sm">#{currentUser?.discriminator || '0000'}</p>
                    <div className="mt-4 px-3 py-1 bg-accent-primary/20 text-accent-primary rounded-full text-xs font-bold uppercase">Captain</div>
                </motion.div>

                {/* Right Slots */}
                {[2, 3].map(i => {
                    const member = teamMembers[i];
                    return (
                        <SlotCard 
                            key={i+2} 
                            member={member} 
                            onAdd={() => setIsSearchOpen(true)} 
                        />
                    );
                })}

            </div>

            {/* SEARCH MODAL */}
            <AnimatePresence>
                {isSearchOpen && (
                    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                        <motion.div 
                            initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}
                            className="bg-[#0a0a0a] border border-glass-border w-full max-w-md rounded-2xl p-6 shadow-2xl"
                        >
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-lg font-bold">Добавить игрока</h3>
                                <button onClick={() => setIsSearchOpen(false)}><X className="text-text-muted hover:text-white" /></button>
                            </div>
                            
                            <div className="relative mb-4">
                                <Search className="absolute left-3 top-3 text-text-muted w-5 h-5" />
                                <input 
                                    type="text" 
                                    placeholder="Введите Discord имя..." 
                                    className="w-full bg-bg-main border border-glass-border rounded-xl py-3 pl-10 text-white focus:border-accent-primary outline-none"
                                    value={searchQuery}
                                    onChange={(e) => handleSearch(e.target.value)}
                                />
                            </div>

                            <div className="space-y-2 max-h-60 overflow-y-auto">
                                {searchResults.map(user => (
                                    <div key={user.id} className="flex items-center justify-between p-3 bg-bg-main rounded-xl hover:bg-glass-panel transition-colors">
                                        <div className="flex items-center gap-3">
                                            <img src={`https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`} className="w-8 h-8 rounded-full" onError={(e) => e.target.src = 'https://via.placeholder.com/32'} />
                                            <div>
                                                <div className="font-bold text-sm">{user.username}</div>
                                                <div className="text-xs text-text-muted">#{user.discriminator}</div>
                                            </div>
                                        </div>
                                        <button onClick={() => sendInvite(user.id)} className="p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors">
                                            <Plus className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))}
                                {searchQuery.length > 1 && searchResults.length === 0 && (
                                    <div className="text-center text-text-muted text-sm py-4">Никого не найдено</div>
                                )}
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};

const SlotCard = ({ member, onAdd }) => {
    return (
        <motion.div 
            whileHover={{ y: -5 }}
            className="w-56 h-80 glass-panel border border-glass-border rounded-xl flex flex-col items-center justify-center relative overflow-hidden hover:border-white/20 transition-colors"
        >
            {member ? (
                <>
                    <div className="w-24 h-24 rounded-full border-2 border-white/20 p-1 mb-4">
                        <img src={`https://cdn.discordapp.com/avatars/${member.receiver_id}/${member.receiver?.avatar}.png`} className="w-full h-full rounded-full object-cover" />
                    </div>
                    <h3 className="text-lg font-bold text-white">{member.receiver?.username}</h3>
                    <p className="text-text-muted text-xs">{member.status === 'pending' ? 'Приглашен...' : 'В команде'}</p>
                    {member.status === 'pending' && <span className="mt-2 w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></span>}
                </>
            ) : (
                <button onClick={onAdd} className="w-full h-full flex flex-col items-center justify-center group">
                    <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-white/10 transition-colors mb-4">
                        <Plus className="w-8 h-8 text-text-muted group-hover:text-white" />
                    </div>
                    <span className="text-text-muted font-bold text-sm group-hover:text-white">ДОБАВИТЬ</span>
                </button>
            )}
        </motion.div>
    );
};

export default BaseInvaders;

