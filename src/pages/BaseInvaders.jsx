import React, { useState, useEffect } from 'react';
import { Plus, Search, Shield, Sword, MoreVertical, LogOut, Trash2, Crown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const BaseInvaders = () => {
    const [state, setState] = useState({ team: [], captain: null, is_captain: false });
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [searchResults, setSearchResults] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(true);
    const [hasSteam, setHasSteam] = useState(true);
    const [currentUser, setCurrentUser] = useState(null);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const token = localStorage.getItem('auth_token');
            if (!token) return;

            const userRes = await fetch('/api/user/me', { headers: { Authorization: `Bearer ${token}` } });
            const userData = await userRes.json();

            if (userData.success) {
                setCurrentUser(userData.user);
            }
            setHasSteam(true); 

            const res = await fetch('/api/invaders/state', { headers: { Authorization: `Bearer ${token}` } });
            if (res.ok) {
                const data = await res.json();
                setState(data);
            } else {
                console.error('Failed to load team state');
            }
        } catch(e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleSteamConnect = () => {
        const token = localStorage.getItem('auth_token');
        const cleanToken = token.replace('Bearer ', '');
        window.location.href = `/api/auth/steam?token=${cleanToken}`;
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

    // FIX: Correctly map members from state.team which is an ARRAY now
    const members = Array.isArray(state.team) ? state.team : [];
    const captain = state.captain;
    const isCaptain = state.is_captain;

    if (loading) return <div className="text-center py-20">Загрузка лобби...</div>;

    if (!hasSteam) {
        return (
            <div className="min-h-[calc(100vh-100px)] flex flex-col items-center justify-center text-center">
                <button onClick={handleSteamConnect} className="btn-main">Connect Steam</button>
            </div>
        );
    }

    return (
        <div className="min-h-[calc(100vh-100px)] relative overflow-hidden bg-[#0a0a0a]">
            
            {/* Simple Grid Background */}
            <div className="absolute inset-0 bg-[radial-gradient(#ffffff15_1px,transparent_1px)] [background-size:20px_20px] opacity-50 pointer-events-none"></div>

            {/* Minimal Header */}
            <div className="absolute top-0 left-0 flex items-center gap-3 mb-8 z-20">
                <div className="p-2 bg-white/5 rounded-lg text-white border border-white/10">
                    <Shield className="w-5 h-5" />
                </div>
                <div>
                    <h1 className="text-lg font-bold text-white uppercase tracking-wider">Управление командой</h1>
                </div>
            </div>
            
            <div className="flex justify-center items-center mb-12 pt-16 relative z-10"></div>

            {/* TEAM GRID - Clean Layout */}
            <div className="flex flex-nowrap justify-center items-center gap-6 mt-10 overflow-x-auto pb-12 px-8 pt-12 relative z-10 no-scrollbar">
                
                {/* Left Slots */}
                {[0, 1].map(i => (
                    <SlotCard 
                        key={i} 
                        member={members[i]} 
                        isCaptain={isCaptain}
                        onAdd={() => setIsSearchOpen(true)} 
                        onKick={kickMember}
                        canAdd={isCaptain} 
                    />
                ))}

                {/* CENTER CAPTAIN */}
                <div className="min-w-[260px] w-64 h-[380px] bg-[#111] border border-white/10 rounded-2xl flex flex-col items-center justify-center relative shrink-0 shadow-2xl">
                    <div className="absolute top-4 text-accent-primary"><Crown className="w-6 h-6" /></div>
                    
                    <div className="w-32 h-32 rounded-full border-2 border-accent-primary p-1 mb-6 relative">
                        {captain?.avatar ? (
                            <img src={`https://cdn.discordapp.com/avatars/${captain.id}/${captain.avatar}.png`} className="w-full h-full rounded-full object-cover" />
                        ) : (
                            <div className="w-full h-full bg-gray-800 rounded-full flex items-center justify-center text-2xl font-bold text-white/20">?</div>
                        )}
                        <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-accent-primary text-black text-[10px] font-bold rounded-full uppercase">
                            LEADER
                        </div>
                    </div>

                    <h2 className="text-xl font-bold text-white mt-2">{captain?.username || 'Captain'}</h2>
                    <p className="text-text-muted text-xs font-mono">#{captain?.discriminator || '0000'}</p>
                </div>

                {/* Right Slots */}
                {[2, 3].map(i => (
                    <SlotCard 
                        key={i+2} 
                        member={members[i]} 
                        isCaptain={isCaptain}
                        onAdd={() => setIsSearchOpen(true)} 
                        onKick={kickMember}
                        canAdd={isCaptain}
                    />
                ))}

            </div>

             {/* SEARCH MODAL - Clean */}
            <AnimatePresence>
                {isSearchOpen && (
                    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                        <motion.div 
                            initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-[#111] border border-white/10 w-full max-w-md rounded-xl p-6 shadow-2xl"
                        >
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-lg font-bold text-white">Добавить игрока</h3>
                                <button onClick={() => setIsSearchOpen(false)} className="text-text-muted hover:text-white"><Trash2 className="w-5 h-5 rotate-45" /></button>
                            </div>
                            
                            <div className="relative mb-4">
                                <Search className="absolute left-3 top-3 text-text-muted w-5 h-5" />
                                <input 
                                    type="text" 
                                    placeholder="Поиск Discord..." 
                                    className="w-full bg-[#222] border border-white/10 rounded-lg py-2.5 pl-10 text-white focus:border-accent-primary outline-none transition-colors"
                                    value={searchQuery}
                                    onChange={(e) => handleSearch(e.target.value)}
                                    autoFocus
                                />
                            </div>

                            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                                {searchResults.map(user => (
                                    <div key={user.id} className="flex items-center justify-between p-3 bg-[#222] rounded-lg hover:bg-[#333] transition-colors cursor-pointer" onClick={() => sendInvite(user.id)}>
                                        <div className="flex items-center gap-3">
                                            <img src={`https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`} className="w-8 h-8 rounded-full" onError={(e) => e.target.src = 'https://via.placeholder.com/32'} />
                                            <div>
                                                <div className="font-bold text-white text-sm">{user.username}</div>
                                                <div className="text-xs text-text-muted">#{user.discriminator}</div>
                                            </div>
                                        </div>
                                        <Plus className="w-4 h-4 text-text-muted" />
                                    </div>
                                ))}
                                {searchQuery.length > 1 && searchResults.length === 0 && (
                                    <div className="text-center text-text-muted text-sm py-4">Ничего не найдено</div>
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
    
    const user = member?.receiver || (member?.is_me ? member : null);
    const avatar = user?.avatar;
    const username = user?.username;
    const status = member?.status || (member?.is_me ? 'accepted' : 'pending'); 

    return (
        <div 
            className={`min-w-[200px] w-56 h-80 bg-[#111] border border-white/10 rounded-xl flex flex-col items-center justify-center relative shrink-0 transition-all ${!user ? 'border-dashed hover:border-white/30' : 'hover:border-white/30'}`}
            onMouseLeave={() => setShowMenu(false)}
        >
            {user ? (
                <>
                    {isCaptain && !member.is_me && (
                        <div className="absolute top-3 right-3 z-20">
                            <button onClick={() => setShowMenu(!showMenu)} className="p-1.5 text-text-muted hover:text-white transition-colors">
                                <MoreVertical size={16} />
                            </button>
                            {showMenu && (
                                <div className="absolute right-0 mt-1 w-32 bg-[#222] border border-white/10 rounded-lg shadow-xl z-30 py-1">
                                    <button onClick={() => onKick(member.id || member.invite_id)} className="w-full text-left px-3 py-2 text-xs text-red-500 hover:bg-red-500/10 transition-colors">
                                        Исключить
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    <div className="relative mb-4">
                        <div className={`w-24 h-24 rounded-full border-2 p-1 bg-[#111] ${status === 'pending' ? 'border-yellow-500' : 'border-white/20'}`}>
                            <img src={avatar ? `https://cdn.discordapp.com/avatars/${user.id}/${avatar}.png` : `https://ui-avatars.com/api/?name=${username}&background=random&color=fff`} className="w-full h-full rounded-full object-cover" />
                        </div>
                    </div>
                    
                    <h3 className="text-md font-bold text-white mb-1">{username}</h3>
                    <p className={`text-xs font-mono uppercase ${status === 'pending' ? 'text-yellow-500' : 'text-emerald-500'}`}>
                        {status === 'pending' ? 'Ожидание...' : 'В строю'}
                    </p>
                </>
            ) : (
                canAdd ? (
                    <button onClick={onAdd} className="w-full h-full flex flex-col items-center justify-center group">
                        <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-white/10 transition-colors mb-3">
                            <Plus className="w-6 h-6 text-text-muted group-hover:text-white" />
                        </div>
                        <span className="text-text-muted font-bold text-xs tracking-widest group-hover:text-white">ДОБАВИТЬ</span>
                    </button>
                ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center opacity-30">
                        <span className="text-text-muted font-bold text-xs tracking-widest">ПУСТО</span>
                    </div>
                )
            )}
        </div>
    );
};

export default BaseInvaders;