import React, { useEffect, useState } from 'react';
import { Copy } from 'lucide-react';

const AdminUsers = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const token = localStorage.getItem('auth_token');
        const res = await fetch('/api/admin/users', {
           headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
            const data = await res.json();
            setUsers(data);
        } else {
            // Handle forbidden or error
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchUsers();
  }, []);

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    // Could show toast here
  };

  if (loading) return <div className="p-8">Loading users...</div>;

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold text-text-main mb-2">Пользователи и ключи</h1>
        <p className="text-text-muted">Полный список всех зарегистрированных пользователей.</p>
      </header>

      <div className="glass-panel rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border-color bg-bg-main/50">
                <th className="p-4 font-medium text-text-muted">Пользователь</th>
                <th className="p-4 font-medium text-text-muted">Email</th>
                <th className="p-4 font-medium text-text-muted">API Token</th>
                <th className="p-4 font-medium text-text-muted">Роль</th>
                <th className="p-4 font-medium text-text-muted">Дата регистрации</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-b border-border-color hover:bg-white/5 transition-colors">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      {user.avatar && (
                        <img 
                          src={`https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`} 
                          alt="Avatar" 
                          className="w-8 h-8 rounded-full"
                        />
                      )}
                      <span className="font-medium text-text-main">{user.username}</span>
                    </div>
                  </td>
                  <td className="p-4 text-text-muted">{user.email}</td>
                  <td className="p-4">
                    <div className="flex items-center gap-2 font-mono text-sm bg-bg-main px-2 py-1 rounded border border-border-color max-w-[200px] overflow-hidden text-ellipsis whitespace-nowrap relative group">
                       <span className="truncate">{user.api_token}</span>
                       <button 
                         onClick={() => copyToClipboard(user.api_token)}
                         className="opacity-0 group-hover:opacity-100 absolute right-0 bg-bg-main p-1 text-accent-primary"
                       >
                         <Copy className="w-3 h-3" />
                       </button>
                    </div>
                  </td>
                  <td className="p-4">
                    {user.is_admin ? (
                        <span className="px-2 py-1 text-xs rounded-full bg-accent-primary/20 text-accent-primary border border-accent-primary/50">
                            Admin
                        </span>
                    ) : (
                        <span className="px-2 py-1 text-xs rounded-full bg-gray-500/20 text-gray-400 border border-gray-500/50">
                            User
                        </span>
                    )}
                  </td>
                  <td className="p-4 text-text-muted text-sm">
                    {new Date(user.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminUsers;

