import React, { useState, useEffect } from 'react';
import { Plus, Search, Shield, Sword, MoreVertical, LogOut, Trash2, Crown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const BaseInvaders = () => {
    const [state, setState] = useState({ team: [], captain: null, is_captain: false });
// ... existing code ...
    return (
        <div className="min-h-[calc(100vh-100px)] relative">
            {/* Header - Team Management */}
            <div className="absolute top-0 left-0 flex items-center gap-3 mb-8">
                <div className="p-2 bg-accent-primary/10 rounded-lg text-accent-primary border border-accent-primary/20">
                    <Shield className="w-6 h-6" />
                </div>
                <div>
                    <h1 className="text-xl font-bold text-text-main uppercase tracking-wider">Управление командой</h1>
                    <p className="text-xs text-text-muted">Lobby Control</p>
                </div>
            </div>

            {/* Header - Old (Keep or Remove? User said "sleva sverhu" - top left. I added absolute above. The old header was centered/justified. I will keep the structure but maybe simplify or remove duplicate if needed. Let's keep the grid layout clean.) */}
            {/* Actually, the user asked for "Управление командой" specifically. */}
            
            <div className="flex justify-center items-center mb-12 pt-16"> 
                 {/* Title was here, removed or changed? Let's keep the main title "BASE INVADERS" maybe centered? */}
                 {/* User said: "сделай BASE INVADERS Управление командой слева сверзу" */}
                 {/* So "BASE INVADERS" title can stay or move. Let's keep "BASE INVADERS" center or large. */}
            </div>

            {/* TEAM GRID */}
            <div className="flex flex-nowrap justify-center items-center gap-4 mt-10 overflow-x-auto pb-8 px-4 pt-12">
                
                {/* Left Slots (Members 0 and 1) */}
                {[0, 1].map(i => (
                    <SlotCard 
                        key={i} 
                        member={members[i]} 
                        isCaptain={state.is_captain}
                        onAdd={() => setIsSearchOpen(true)} 
                        onKick={kickMember}
                        canAdd={state.is_captain} 
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
                        isCaptain={state.is_captain}
                        onAdd={() => setIsSearchOpen(true)} 
                        onKick={kickMember}
                        canAdd={state.is_captain}
                    />
                ))}

            </div>
            {/* ... */}
        </div>
    );
};

const SlotCard = ({ member, isCaptain, onAdd, onKick, canAdd }) => {
    const [showMenu, setShowMenu] = useState(false);
    
    // Fix: Correctly resolve user object from invite or member entry
    // 'member' can be:
    // 1. Invite object: { id, status, receiver: { id, username, avatar } }
    // 2. "Me" object: { id, username, avatar, is_me: true, invite_id }
    
    const user = member?.receiver || (member?.is_me ? member : null);
    // If member exists but no receiver and not is_me? fallback to member (if backend sends direct user obj)
    // But let's stick to what we know.
    
    const avatarId = user?.id || member?.receiver_id; 
    // For "Me" object, id is top level. For invite, receiver.id.
    
    const username = user?.username;
    const avatar = user?.avatar;
    const status = member?.status || (member?.is_me ? 'accepted' : 'pending'); // Me is always accepted

    return (
        <motion.div 
            className="min-w-[200px] w-52 h-80 glass-panel border border-glass-border rounded-xl flex flex-col items-center justify-center relative overflow-visible hover:border-white/20 transition-colors shrink-0"
            onMouseLeave={() => setShowMenu(false)}
        >
            {user ? (
                <>
                    {/* Options Menu for Captain (can kick anyone except self, but this is slotcard so not self) */}
                    {/* Only captain can kick. And cannot kick "Me" if "Me" is shown in slot? Wait. */}
                    {/* If I am captain, I see members in slots. I can kick them. */}
                    {/* If I am member, I see captain (center) and other members. I cannot kick. */}
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
                                            onClick={() => onKick(member.id || member.invite_id)} // Invite ID for kicking
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
                // Empty Slot Logic ...
