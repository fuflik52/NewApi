import React, { useState, useEffect } from 'react';
import { Plus, Search, Shield, Sword, MoreVertical, LogOut, Trash2, Crown, Zap } from 'lucide-react';
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
                // if (!userData.user.steam_id) {
                //     setHasSteam(false);
                //     setLoading(false);
                //     return;
                // }
            }
            setHasSteam(true); // Bypass Steam check for now

            const res = await fetch('/api/invaders/state', { headers: { Authorization: `Bearer ${token}` } });
            const data = await res.json();
            setState(data);
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

    const members = state.team?.members || [];
    const captain = state.team?.captain;
    const isCaptain = state.team?.is_captain;

    if (loading) return <div className="text-center py-20">Загрузка лобби...</div>;

    if (!hasSteam) {
        return (
            <div className="min-h-[calc(100vh-100px)] flex flex-col items-center justify-center text-center">
                <motion.div 
                    initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                    className="glass-panel p-8 rounded-2xl max-w-md border border-accent-primary/30 shadow-[0_0_50px_rgba(0,0,0,0.5)]"
                >
                    <div className="w-20 h-20 bg-[#171a21] rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg">
                        <svg viewBox="0 0 24 24" className="w-10 h-10 fill-white" role="img" xmlns="http://www.w3.org/2000/svg"><path d="M11.979 0C5.678 0 .511 4.86.022 11.037l6.432 2.658c.566-1.055 1.666-1.797 2.94-1.846l4.553-6.747c-.25-.027-.502-.04-.756-.04a7.94 7.94 0 0 0-2.212.312L8.437 1.016A11.954 11.954 0 0 1 11.979 0zM.004 12.06C-.02 12.371 0 12.684 0 13a12 12 0 0 0 12 12c4.41 0 8.266-2.388 10.398-6.012l-5.99-4.17a5.016 5.016 0 0 1-1.94 2.722l1.565 6.033a7.96 7.96 0 0 0 2.965-1.14L21.79 25.4A11.942 11.942 0 0 1 12 24a11.954 11.954 0 0 1-5.54-1.36l1.614-3.87a4.972 4.972 0 0 1-2.68-1.83l-4.88 2.02A11.982 11.982 0 0 1 .004 12.06zm3.95 1.608l3.88 1.6a2.486 2.486 0 0 0 1.678 1.872 2.52 2.52 0 0 0 3.13-2.07l3.89-1.61c-.14.78-.48 1.5-.98 2.11l-2.6-1.81a1.506 1.506 0 0 1-1.28 1.68 1.5 1.5 0 0 1-1.66-1.26 1.484 1.484 0 0 1 .65-1.43l-2.03-4.87a6.483 6.483 0 0 0-4.67 5.788z"/></svg>
                    </div>
                    <h2 className="text-2xl font-bold text-white mb-2">Требуется Steam</h2>
                    <p className="text-text-muted mb-8">Для доступа к Base Invaders необходимо привязать ваш Steam аккаунт.</p>
                    <button 
                        onClick={handleSteamConnect}
                        className="w-full py-3 px-6 bg-[#171a21] hover:bg-[#2a475e] text-white font-bold rounded-xl transition-all flex items-center justify-center gap-3"
                    >
                        Войти через Steam
                    </button>
                </motion.div>
            </div>
        );
    }

    return (
        <div className="min-h-[calc(100vh-100px)] relative overflow-hidden">
            
            {/* Background Ambiance */}
            <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-accent-primary/20 rounded-full blur-[120px] animate-pulse pointer-events-none"></div>
            <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] bg-purple-500/10 rounded-full blur-[120px] animate-pulse pointer-events-none"></div>

            {/* Header - Team Management */}
            <div className="absolute top-0 left-0 flex items-center gap-3 mb-8 z-20">
                <div className="p-2 bg-accent-primary/10 rounded-xl text-accent-primary border border-accent-primary/20 shadow-[0_0_15px_rgba(var(--accent-primary-rgb),0.3)]">
                    <Shield className="w-6 h-6" />
                </div>
                <div>
                    <h1 className="text-xl font-bold text-white uppercase tracking-wider flex items-center gap-2">
                        Управление командой
                        <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse shadow-[0_0_8px_#22c55e]"></span>
                    </h1>
                    <p className="text-xs text-text-muted tracking-widest font-mono">LOBBY CONTROL // SQUAD ALPHA</p>
                </div>
            </div>
            
            <div className="flex justify-center items-center mb-12 pt-16 relative z-10"> 
                 {/* Optional Center Title */}
            </div>

            {/* TEAM GRID */}
            <div className="flex flex-nowrap justify-center items-center gap-6 mt-10 overflow-x-auto pb-12 px-8 pt-12 relative z-10 no-scrollbar">
                
                {/* Left Slots (Members 0 and 1) */}
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
                <motion.div 
                    initial={{ scale: 0.9, opacity: 0, y: 20 }} 
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    transition={{ type: "spring", stiffness: 260, damping: 20 }}
                    className="min-w-[280px] w-72 h-[420px] glass-panel border-2 border-accent-primary/50 rounded-3xl flex flex-col items-center justify-center relative overflow-hidden shadow-[0_0_50px_rgba(var(--accent-primary-rgb),0.2)] z-20 shrink-0 group"
                >
                    {/* Captain Glow Background */}
                    <div className="absolute inset-0 bg-gradient-to-b from-accent-primary/10 to-transparent opacity-50"></div>
                    <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-accent-primary to-transparent"></div>

                    <div className="absolute top-6 text-accent-primary animate-pulse"><Shield className="w-8 h-8 drop-shadow-[0_0_10px_rgba(var(--accent-primary-rgb),0.8)]" /></div>
                    
                    <div className="relative mb-8">
                        <div className="absolute inset-0 bg-accent-primary rounded-full blur-md opacity-40 animate-pulse"></div>
                        <div className="w-36 h-36 rounded-full border-4 border-accent-primary p-1 relative z-10 shadow-[0_0_20px_rgba(var(--accent-primary-rgb),0.4)]">
                            {captain?.avatar ? (
                                <img src={`https://cdn.discordapp.com/avatars/${captain.id}/${captain.avatar}.png`} className="w-full h-full rounded-full object-cover" />
                            ) : (
                                <div className="w-full h-full bg-gray-800 rounded-full flex items-center justify-center text-2xl font-bold text-white/20">?</div>
                            )}
                        </div>
                        {/* Crown Animation */}
                        <motion.div 
                            animate={{ y: [-5, 5, -5] }}
                            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                            className="absolute -top-8 left-1/2 -translate-x-1/2 text-yellow-400 drop-shadow-[0_0_15px_rgba(250,204,21,0.6)]"
                        >
                            <Crown size={40} fill="currentColor" />
                        </motion.div>
                    </div>

                    <h2 className="text-2xl font-black text-white tracking-wide uppercase relative z-10 drop-shadow-md">{captain?.username || 'Captain'}</h2>
                    <p className="text-accent-primary/80 text-sm font-mono mb-4">#{captain?.discriminator || '0000'}</p>
                    
                    <div className="mt-2 px-6 py-2 bg-accent-primary/20 text-accent-primary rounded-full text-xs font-black uppercase flex items-center gap-2 border border-accent-primary/40 shadow-[0_0_15px_rgba(var(--accent-primary-rgb),0.2)] backdrop-blur-md">
                        <Crown size={14} className="fill-accent-primary" />
                        Squad Leader
                    </div>
                </motion.div>

                {/* Right Slots (Members 2 and 3) */}
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

             {/* SEARCH MODAL - Improved Design */}
            <AnimatePresence>
                {isSearchOpen && (
                    <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-4">
                        <motion.div 
                            initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
                            className="bg-[#0f0f13] border border-white/10 w-full max-w-lg rounded-3xl p-0 shadow-[0_0_100px_rgba(var(--accent-primary-rgb),0.1)] overflow-hidden"
                        >
                            <div className="p-6 border-b border-white/5 bg-white/5 flex justify-between items-center">
                                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                    <Plus className="w-5 h-5 text-accent-primary" /> Добавить оперативника
                                </h3>
                                <button onClick={() => setIsSearchOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors text-text-muted hover:text-white">
                                    <Trash2 className="w-5 h-5 rotate-45" />
                                </button>
                            </div>
                            
                            <div className="p-6">
                                <div className="relative mb-6 group">
                                    <Search className="absolute left-4 top-4 text-text-muted w-5 h-5 group-focus-within:text-accent-primary transition-colors" />
                                    <input 
                                        type="text" 
                                        placeholder="Поиск по Discord нику..." 
                                        className="w-full bg-black/40 border border-white/10 rounded-2xl py-4 pl-12 text-white focus:border-accent-primary outline-none transition-all focus:bg-black/60"
                                        value={searchQuery}
                                        onChange={(e) => handleSearch(e.target.value)}
                                        autoFocus
                                    />
                                </div>

                                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                                    {searchResults.map(user => (
                                        <motion.div 
                                            initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                                            key={user.id} 
                                            className="flex items-center justify-between p-3 bg-white/5 rounded-xl hover:bg-white/10 transition-all border border-transparent hover:border-accent-primary/30 group cursor-pointer"
                                            onClick={() => sendInvite(user.id)}
                                        >
                                            <div className="flex items-center gap-4">
                                                <img src={`https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`} className="w-10 h-10 rounded-full object-cover border border-white/10 group-hover:border-accent-primary transition-colors" onError={(e) => e.target.src = 'https://via.placeholder.com/40'} />
                                                <div>
                                                    <div className="font-bold text-white group-hover:text-accent-primary transition-colors">{user.username}</div>
                                                    <div className="text-xs text-text-muted font-mono">#{user.discriminator}</div>
                                                </div>
                                            </div>
                                            <button className="p-2 bg-accent-primary/10 text-accent-primary rounded-lg group-hover:bg-accent-primary group-hover:text-white transition-all">
                                                <Plus className="w-5 h-5" />
                                            </button>
                                        </motion.div>
                                    ))}
                                    {searchQuery.length > 1 && searchResults.length === 0 && (
                                        <div className="text-center text-text-muted text-sm py-10 flex flex-col items-center gap-2">
                                            <Search className="w-8 h-8 opacity-20" />
                                            <span>Оперативник не найден</span>
                                        </div>
                                    )}
                                </div>
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
        <motion.div 
            initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
            whileHover={{ y: -5 }}
            className={`min-w-[220px] w-60 h-[340px] glass-panel border border-white/10 rounded-2xl flex flex-col items-center justify-center relative overflow-visible transition-all shrink-0 group ${!user ? 'border-dashed border-white/5 hover:border-accent-primary/30' : 'hover:border-accent-primary/50 hover:shadow-[0_0_30px_rgba(var(--accent-primary-rgb),0.15)]'}`}
            onMouseLeave={() => setShowMenu(false)}
        >
            {user ? (
                <>
                    {/* Status Indicator Line */}
                    <div className={`absolute top-0 left-0 right-0 h-1 rounded-t-2xl ${status === 'pending' ? 'bg-yellow-500 animate-pulse' : 'bg-emerald-500'}`}></div>

                    {isCaptain && !member.is_me && (
                        <div className="absolute top-3 right-3 z-20">
                            <button 
                                onClick={() => setShowMenu(!showMenu)}
                                className="p-2 hover:bg-white/10 rounded-lg text-text-muted hover:text-white transition-colors"
                            >
                                <MoreVertical size={18} />
                            </button>
                            <AnimatePresence>
                                {showMenu && (
                                    <motion.div 
                                        initial={{ opacity: 0, scale: 0.9, y: -10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0 }}
                                        className="absolute right-0 mt-2 w-40 bg-[#151518] border border-white/10 rounded-xl shadow-2xl overflow-hidden z-30"
                                    >
                                        <button 
                                            onClick={() => onKick(member.id || member.invite_id)}
                                            className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-500 hover:bg-red-500/10 transition-colors font-bold"
                                        >
                                            <Trash2 size={16} />
                                            ИСКЛЮЧИТЬ
                                        </button>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    )}

                    <div className="relative mb-6 group-hover:scale-105 transition-transform duration-300">
                        <div className={`absolute inset-0 rounded-full blur-md opacity-0 group-hover:opacity-50 transition-opacity ${status === 'pending' ? 'bg-yellow-500' : 'bg-emerald-500'}`}></div>
                        <div className={`w-28 h-28 rounded-full border-2 p-1 relative z-10 bg-[#0a0a0a] ${status === 'pending' ? 'border-yellow-500' : 'border-white/20 group-hover:border-accent-primary'}`}>
                            <img 
                                src={avatar ? `https://cdn.discordapp.com/avatars/${user.id}/${avatar}.png` : `https://ui-avatars.com/api/?name=${username}&background=random&color=fff`} 
                                className="w-full h-full rounded-full object-cover" 
                            />
                        </div>
                        {status === 'pending' && (
                            <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 px-3 py-1 bg-yellow-500 text-black text-[10px] font-black rounded-full uppercase z-20">
                                Pending
                            </div>
                        )}
                    </div>
                    
                    <h3 className="text-lg font-bold text-white mb-1">{username}</h3>
                    <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${status === 'pending' ? 'bg-yellow-500 animate-pulse' : 'bg-emerald-500'}`}></span>
                        <p className="text-text-muted text-xs font-mono uppercase">{status === 'pending' ? 'Waiting...' : 'Ready'}</p>
                    </div>
                </>
            ) : (
                canAdd ? (
                    <button onClick={onAdd} className="w-full h-full flex flex-col items-center justify-center group relative">
                        <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-accent-primary/20 transition-all mb-6 border border-white/10 group-hover:border-accent-primary/50 group-hover:scale-110 shadow-lg">
                            <Plus className="w-8 h-8 text-text-muted group-hover:text-accent-primary transition-colors" />
                        </div>
                        <span className="text-text-muted font-bold text-xs tracking-widest group-hover:text-white transition-colors">ПРИГЛАСИТЬ</span>
                        <div className="absolute inset-0 bg-accent-primary/5 opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl"></div>
                    </button>
                ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center opacity-30">
                        <div className="w-20 h-20 rounded-full bg-white/5 mb-6 flex items-center justify-center border border-white/5">
                            <div className="w-2 h-2 bg-white/20 rounded-full"></div>
                        </div>
                        <span className="text-text-muted font-bold text-xs tracking-widest">СВОБОДНО</span>
                    </div>
                )
            )}
        </motion.div>
    );
};

export default BaseInvaders;