import React, { useState, useEffect } from 'react';
import { Trash2, Users, Shield, UserX } from 'lucide-react';
import { motion } from 'framer-motion';

const AdminTeams = () => {
    const [teams, setTeams] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isAdmin, setIsAdmin] = useState(false);

    useEffect(() => {
        loadTeams();
    }, []);

    const loadTeams = async () => {
        try {
            const token = localStorage.getItem('auth_token');
            // Check admin first (optional, backend handles it too)
            const userRes = await fetch('/api/user/me', { headers: { 'Authorization': `Bearer ${token}` } });
            const userData = await userRes.json();
            if (userData.user?.is_admin) {
                setIsAdmin(true);
                const res = await fetch('/api/admin/teams', { headers: { 'Authorization': `Bearer ${token}` } });
                const data = await res.json();
                setTeams(data);
            }
        } catch(e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const disbandTeam = async (teamId) => {
        if (!confirm('Удалить команду? Все участники будут исключены.')) return;
        const token = localStorage.getItem('auth_token');
        await fetch(`/api/admin/teams/${teamId}`, { 
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        loadTeams();
    };

    const kickMember = async (inviteId) => {
        if (!confirm('Исключить участника?')) return;
        const token = localStorage.getItem('auth_token');
        await fetch(`/api/admin/invites/${inviteId}`, { 
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        loadTeams();
    };

    if (loading) return <div className="text-center py-10 text-text-muted">Загрузка...</div>;
    if (!isAdmin) return <div className="text-center py-10 text-red-500">Доступ запрещен</div>;

    return (
        <div className="max-w-6xl mx-auto">
            <div className="flex items-center gap-4 mb-8">
                <div className="p-3 bg-accent-primary/10 rounded-xl text-accent-primary">
                    <Shield className="w-8 h-8" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-text-main">Управление Командами</h1>
                    <p className="text-text-muted">Список всех активных команд Base Invaders</p>
                </div>
            </div>

            {teams.length === 0 ? (
                <div className="text-center py-20 text-text-muted glass-panel rounded-2xl">Нет активных команд</div>
            ) : (
                <div className="grid gap-6">
                    {teams.map(team => (
                        <motion.div 
                            key={team.id}
                            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                            className="glass-panel p-6 rounded-2xl border border-border-color"
                        >
                            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 bg-accent-primary/20 rounded-lg flex items-center justify-center text-accent-primary font-bold text-xl">
                                        {team.members.length + 1}
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                            {team.name}
                                            <span className="text-xs px-2 py-0.5 bg-white/10 rounded-full text-text-muted font-normal">ID: {team.id.slice(0,8)}</span>
                                        </h3>
                                        <div className="text-sm text-text-muted">Captain: {team.captain.username}</div>
                                    </div>
                                </div>
                                <button 
                                    onClick={() => disbandTeam(team.id)}
                                    className="px-4 py-2 bg-red-500/10 text-red-500 hover:bg-red-500/20 rounded-lg transition-colors flex items-center gap-2 text-sm font-bold"
                                >
                                    <Trash2 size={16} />
                                    Расформировать
                                </button>
                            </div>

                            <div className="space-y-3">
                                {/* Captain Row */}
                                <div className="flex items-center justify-between bg-white/5 p-3 rounded-xl border border-white/5">
                                    <div className="flex items-center gap-3">
                                        <img 
                                            src={team.captain.avatar ? `https://cdn.discordapp.com/avatars/${team.captain.id}/${team.captain.avatar}.png` : `https://ui-avatars.com/api/?name=${team.captain.username}`} 
                                            className="w-10 h-10 rounded-full object-cover border border-accent-primary"
                                        />
                                        <div>
                                            <div className="font-bold text-white flex items-center gap-2">
                                                {team.captain.username}
                                                <span className="text-xs text-accent-primary border border-accent-primary px-1.5 rounded">CAPTAIN</span>
                                            </div>
                                            <div className="text-xs text-text-muted flex gap-2">
                                                <span>Discord: {team.captain.username}#{team.captain.discriminator}</span>
                                                {team.captain.steam_name && <span className="text-blue-400">Steam: {team.captain.steam_name}</span>}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Members Rows */}
                                {team.members.map(member => (
                                    <div key={member.id} className="flex items-center justify-between bg-bg-main/50 p-3 rounded-xl border border-white/5">
                                        <div className="flex items-center gap-3">
                                            <img 
                                                src={member.avatar ? `https://cdn.discordapp.com/avatars/${member.id}/${member.avatar}.png` : `https://ui-avatars.com/api/?name=${member.username}`} 
                                                className="w-10 h-10 rounded-full object-cover"
                                            />
                                            <div>
                                                <div className="font-bold text-white">{member.username}</div>
                                                <div className="text-xs text-text-muted flex gap-2">
                                                    <span>Discord: {member.username}#{member.discriminator}</span>
                                                    {member.steam_name && <span className="text-blue-400">Steam: {member.steam_name}</span>}
                                                </div>
                                            </div>
                                        </div>
                                        <button 
                                            onClick={() => kickMember(member.invite_id)}
                                            className="p-2 text-text-muted hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                                            title="Исключить"
                                        >
                                            <UserX size={18} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </motion.div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default AdminTeams;
