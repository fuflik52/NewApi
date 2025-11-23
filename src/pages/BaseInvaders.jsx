import React, { useState, useEffect } from 'react';
import { Plus, Search, Shield, Sword, MoreVertical, LogOut, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const BaseInvaders = () => {
    const [state, setState] = useState({ team: [], captain: null, is_captain: false });
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [searchResults, setSearchResults] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        const token = localStorage.getItem('auth_token');
        const res = await fetch('/api/invaders/state', { headers: { Authorization: `Bearer ${token}` } });
        const data = await res.json();
        setState(data);
        setLoading(false);
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

    const kickMember = async (inviteId) => {
        if (!confirm('Выгнать игрока?')) return;
        const token = localStorage.getItem('auth_token');
        await fetch('/api/invaders/kick', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ invite_id: inviteId })
        });
        loadData();
    };

    const leaveTeam = async () => {
        if (!confirm('Покинуть команду?')) return;
        const token = localStorage.getItem('auth_token');
        await fetch('/api/invaders/leave', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
        });
        window.location.reload();
    };

    // Slots Logic: Center is Captain. Others are members.
    // We need to map members to slots.
    // Captain is ALWAYS center.
    const members = state.team || [];
    const captain = state.captain;
    
    // Prepare slots array: [0, 1] (left), Center, [2, 3] (right)
    // We fill slots with members.
    
    if (loading) return <div className="text-center py-20">Загрузка лобби...</div>;

    return (
        <div className="min-h-[calc(100vh-100px)] relative">
            {/* Header */}
            <div className="flex justify-between items-center mb-12">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-red-500/10 rounded-xl text-red-500 border border-red-500/20">
                        <Sword className="w-8 h-8" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-text-main tracking-wider">BASE INVADERS</h1>
                        <p className="text-text-muted text-sm">
                            {state.is_captain ? 'Управление командой' : `В гостях у ${captain?.username}`}
                        </p>
                    </div>
                </div>
            </div>

            {/* TEAM GRID */}
            <div className="flex flex-nowrap justify-center items-center gap-4 mt-20 overflow-x-auto pb-8 px-4">
                
                {/* Left Slots (Members 0 and 1) */}
                {[0, 1].map(i => (
                    <SlotCard 
                        key={i} 
                        member={members[i]} 
                        isCaptain={state.is_captain}
                        onAdd={() => setIsSearchOpen(true)} 
                        onKick={kickMember}
                        canAdd={state.is_captain} // Only captain can add
                    />
                ))}

                {/* CENTER CAPTAIN */}
                <motion.div 
                    initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                    className="min-w-[256px] w-64 h-96 glass-panel border-2 border-accent-primary rounded-2xl flex flex-col items-center justify-center relative overflow-hidden shadow-[0_0_50px_rgba(255,255,255,0.1)] z-10 shrink-0"
                >
                    <div className="absolute top-4 text-accent-primary"><Shield className="w-6 h-6" /></div>
                    
                    <div className="w-32 h-32 rounded-full border-4 border-accent-primary p-1 mb-6">
                        {captain?.avatar ? (
                            <img src={`https://cdn.discordapp.com/avatars/${captain.id}/${captain.avatar}.png`} className="w-full h-full rounded-full object-cover" />
                        ) : (
                            <div className="w-full h-full bg-gray-700 rounded-full"></div>
                        )}
                    </div>
                    <h2 className="text-xl font-bold text-white">{captain?.username || 'Captain'}</h2>
                    <p className="text-text-muted text-sm">#{captain?.discriminator || '0000'}</p>
                    <div className="mt-4 px-3 py-1 bg-accent-primary/20 text-accent-primary rounded-full text-xs font-bold uppercase">Captain</div>
                </motion.div>

                {/* Right Slots (Members 2 and 3) */}
                {[2, 3].map(i => (
                    <SlotCard 
                        key={i+2} 
                        member={members[i]} 
                        isCaptain={state.is_captain}
                        onAdd={() => setIsSearchOpen(true)} 
                        onKick={kickMember}
                        canAdd={state.is_captain}
                    />
                ))}

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
                                <button onClick={() => setIsSearchOpen(false)} className="text-text-muted hover:text-white">×</button>
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

const SlotCard = ({ member, isCaptain, onAdd, onKick, canAdd }) => {
    const [showMenu, setShowMenu] = useState(false);

    return (
        <motion.div 
            className="min-w-[200px] w-52 h-80 glass-panel border border-glass-border rounded-xl flex flex-col items-center justify-center relative overflow-visible hover:border-white/20 transition-colors shrink-0"
            onMouseLeave={() => setShowMenu(false)}
        >
            {member ? (
                <>
                    {/* Options Menu for Captain */}
                    {isCaptain && (
                        <div className="absolute top-2 right-2">
                            <button 
                                onClick={() => setShowMenu(!showMenu)}
                                className="p-1.5 hover:bg-white/10 rounded-lg text-text-muted hover:text-white transition-colors"
                            >
                                <MoreVertical size={16} />
                            </button>
                            <AnimatePresence>
                                {showMenu && (
                                    <motion.div 
                                        initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
                                        className="absolute right-0 mt-1 w-32 bg-[#1a1a1a] border border-glass-border rounded-lg shadow-xl overflow-hidden z-20"
                                    >
                                        <button 
                                            onClick={() => onKick(member.id)}
                                            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-500 hover:bg-red-500/10 transition-colors"
                                        >
                                            <Trash2 size={14} />
                                            Выгнать
                                        </button>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    )}

                    <div className="w-24 h-24 rounded-full border-2 border-white/20 p-1 mb-4">
                        <img src={`https://cdn.discordapp.com/avatars/${member.receiver_id}/${member.receiver?.avatar}.png`} className="w-full h-full rounded-full object-cover" />
                    </div>
                    <h3 className="text-lg font-bold text-white">{member.receiver?.username}</h3>
                    <p className="text-text-muted text-xs">{member.status === 'pending' ? 'Приглашен...' : 'В команде'}</p>
                    {member.status === 'pending' && <span className="mt-2 w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></span>}
                </>
            ) : (
                canAdd ? (
                    <button onClick={onAdd} className="w-full h-full flex flex-col items-center justify-center group">
                        <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-white/10 transition-colors mb-4">
                            <Plus className="w-8 h-8 text-text-muted group-hover:text-white" />
                        </div>
                        <span className="text-text-muted font-bold text-sm group-hover:text-white">ДОБАВИТЬ</span>
                    </button>
                ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center opacity-30">
                        <div className="w-16 h-16 rounded-full bg-white/5 mb-4"></div>
                        <span className="text-text-muted font-bold text-sm">ПУСТО</span>
                    </div>
                )
            )}
        </motion.div>
    );
};

export default BaseInvaders;
