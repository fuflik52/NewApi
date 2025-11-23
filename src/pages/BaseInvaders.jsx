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

            // Check user me for Steam ID
            const userRes = await fetch('/api/user/me', { headers: { Authorization: `Bearer ${token}` } });
            const userData = await userRes.json();

            if (userData.success) {
                setCurrentUser(userData.user);
                if (!userData.user.steam_id) {
                    setHasSteam(false);
                    setLoading(false);
                    return;
                }
            }

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
        // Pass token as query param to link account
        // Use clean token without Bearer prefix if it exists, or take from api_token if user/me returned it.
        // localStorage usually stores clean token if we implemented it that way.
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
        <div className="min-h-[calc(100vh-100px)] relative">
            {/* Header - Team Management */}
            <div className="absolute top-0 left-0 flex items-center gap-3 mb-8 z-20">
                <div className="p-2 bg-accent-primary/10 rounded-lg text-accent-primary border border-accent-primary/20">
                    <Shield className="w-6 h-6" />
                </div>
                <div>
                    <h1 className="text-xl font-bold text-text-main uppercase tracking-wider">Управление командой</h1>
                    <p className="text-xs text-text-muted">Lobby Control</p>
                </div>
            </div>
            
            <div className="flex justify-center items-center mb-12 pt-16"> 
                 {/* Title area */}
            </div>

            {/* TEAM GRID */}
            <div className="flex flex-nowrap justify-center items-center gap-4 mt-10 overflow-x-auto pb-8 px-4 pt-12">
                
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
                    <div className="mt-4 px-4 py-1.5 bg-accent-primary/20 text-accent-primary rounded-full text-xs font-bold uppercase flex items-center gap-2 border border-accent-primary/30">
                        <Crown size={14} className="fill-accent-primary" />
                        Captain
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
    
    const user = member?.receiver || (member?.is_me ? member : null);
    const avatar = user?.avatar;
    const username = user?.username;
    const status = member?.status || (member?.is_me ? 'accepted' : 'pending'); 

    return (
        <motion.div 
            className="min-w-[200px] w-52 h-80 glass-panel border border-glass-border rounded-xl flex flex-col items-center justify-center relative overflow-visible hover:border-white/20 transition-colors shrink-0"
            onMouseLeave={() => setShowMenu(false)}
        >
            {user ? (
                <>
                    {isCaptain && !member.is_me && (
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
                                            onClick={() => onKick(member.id || member.invite_id)}
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
                        <img 
                            src={avatar ? `https://cdn.discordapp.com/avatars/${user.id}/${avatar}.png` : `https://ui-avatars.com/api/?name=${username}&background=random&color=fff`} 
                            className="w-full h-full rounded-full object-cover" 
                        />
                    </div>
                    <h3 className="text-lg font-bold text-white">{username}</h3>
                    <p className="text-text-muted text-xs">{status === 'pending' ? 'Приглашен...' : 'В команде'}</p>
                    {status === 'pending' && <span className="mt-2 w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></span>}
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