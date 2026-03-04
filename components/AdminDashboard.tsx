import React, { useEffect, useState } from 'react';
import { Users, Activity, MessageSquare, AlertTriangle, LogOut, Shield, TrendingUp } from 'lucide-react';

export const AdminDashboard: React.FC<{ onLogout: () => void }> = ({ onLogout }) => {
    const [activeTab, setActiveTab] = useState<'users' | 'scans' | 'metrics' | 'chats' | 'errors'>('users');
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(false);

    const fetchTab = async (tab: string) => {
        setLoading(true);
        try {
            const r = await fetch(`/api/admin/${tab}`, { credentials: 'include' });
            if (r.status === 401) { onLogout(); return; }
            setData(await r.json());
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    };

    useEffect(() => { fetchTab(activeTab); }, [activeTab]);

    const handleToggleUser = async (userId: string, isDisabled: boolean) => {
        const endpoint = isDisabled ? 'enable' : 'disable';
        await fetch(`/api/admin/users/${userId}/${endpoint}`, {
            method: 'POST', credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reason: 'Disabled by admin' })
        });
        fetchTab('users');
    };

    const handleLogout = async () => {
        await fetch('/api/admin/logout', { method: 'POST', credentials: 'include' });
        onLogout();
    };

    const tabs = [
        { id: 'users', label: 'Users', icon: <Users size={15} /> },
        { id: 'scans', label: 'Scans', icon: <TrendingUp size={15} /> },
        { id: 'metrics', label: 'Metrics', icon: <Activity size={15} /> },
        { id: 'chats', label: 'Chat Logs', icon: <MessageSquare size={15} /> },
        { id: 'errors', label: 'Errors', icon: <AlertTriangle size={15} /> },
    ];

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="bg-emerald-700 text-white px-6 py-4 flex justify-between items-center">
                <div className="flex items-center gap-3">
                    <Shield size={22} />
                    <div>
                        <h1 className="font-bold text-base">UZHAVAN AI — Admin Dashboard</h1>
                        <p className="text-emerald-200 text-xs">System Monitoring & Control</p>
                    </div>
                </div>
                <button onClick={handleLogout} className="flex items-center gap-2 bg-white/10 hover:bg-white/20 px-4 py-2 rounded-lg text-sm transition-colors">
                    <LogOut size={15} /> Logout
                </button>
            </div>

            <div className="bg-white border-b border-gray-200 px-6">
                <div className="flex gap-1">
                    {tabs.map(tab => (
                        <button key={tab.id} onClick={() => setActiveTab(tab.id as any)}
                            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === tab.id ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                            {tab.icon} {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            <div className="p-6 max-w-5xl mx-auto">
                {loading ? (
                    <div className="flex justify-center py-20">
                        <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : data ? (
                    <>
                        {activeTab === 'users' && (
                            <div>
                                <div className="grid grid-cols-2 gap-4 mb-6">
                                    <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
                                        <p className="text-gray-400 text-sm">Total Users</p>
                                        <p className="text-3xl font-bold text-emerald-600">{data.total_users}</p>
                                    </div>
                                    <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
                                        <p className="text-gray-400 text-sm">Failed Logins (24h)</p>
                                        <p className="text-3xl font-bold text-red-500">{data.failed_logins_24h}</p>
                                    </div>
                                </div>
                                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                                    <table className="w-full text-sm">
                                        <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                                            <tr>
                                                <th className="px-4 py-3 text-left">Name</th>
                                                <th className="px-4 py-3 text-left">Email</th>
                                                <th className="px-4 py-3 text-center">Scans</th>
                                                <th className="px-4 py-3 text-center">Status</th>
                                                <th className="px-4 py-3 text-center">Action</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-50">
                                            {data.users?.map((u: any) => (
                                                <tr key={u.id} className="hover:bg-gray-50">
                                                    <td className="px-4 py-3 font-medium text-gray-800">{u.name}</td>
                                                    <td className="px-4 py-3 text-gray-500">{u.email}</td>
                                                    <td className="px-4 py-3 text-center">{u.scan_count}</td>
                                                    <td className="px-4 py-3 text-center">
                                                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${u.is_disabled ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-600'}`}>
                                                            {u.is_disabled ? 'Disabled' : 'Active'}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3 text-center">
                                                        <button onClick={() => handleToggleUser(u.id, u.is_disabled)}
                                                            className={`px-3 py-1 rounded-lg text-xs font-medium ${u.is_disabled ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                                                            {u.is_disabled ? 'Enable' : 'Disable'}
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {activeTab === 'scans' && (
                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
                                        <p className="text-gray-400 text-sm">Scans Today</p>
                                        <p className="text-3xl font-bold text-emerald-600">{data.scans_today}</p>
                                    </div>
                                    <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
                                        <p className="text-gray-400 text-sm">Scans This Week</p>
                                        <p className="text-3xl font-bold text-blue-600">{data.scans_this_week}</p>
                                    </div>
                                </div>
                                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                                    <h3 className="font-bold text-gray-700 mb-3">Top Detected Diseases (7 days)</h3>
                                    {data.top_diseases?.map((d: any) => (
                                        <div key={d.plant_name} className="flex justify-between py-2 border-b border-gray-50 last:border-0 text-sm">
                                            <span className="text-gray-700">{d.plant_name}</span>
                                            <div className="flex gap-4">
                                                <span className="text-gray-400">{d.count} scans</span>
                                                <span className="text-emerald-600 font-medium">{Math.round(d.avg_confidence)}% avg</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {activeTab === 'metrics' && (
                            <div className="grid grid-cols-2 gap-4">
                                {[
                                    { label: 'Requests/Minute', value: data.requests_per_minute, color: 'text-blue-600' },
                                    { label: 'Avg Response (ms)', value: data.avg_response_ms, color: 'text-emerald-600' },
                                    { label: 'Max Response (ms)', value: data.max_response_ms, color: 'text-amber-600' },
                                    { label: 'Errors (1h)', value: data.error_count_1h, color: 'text-red-600' },
                                    { label: 'Total Requests (1h)', value: data.total_requests_1h, color: 'text-gray-700' },
                                ].map(m => (
                                    <div key={m.label} className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
                                        <p className="text-gray-400 text-sm">{m.label}</p>
                                        <p className={`text-3xl font-bold ${m.color}`}>{m.value}</p>
                                    </div>
                                ))}
                            </div>
                        )}

                        {activeTab === 'chats' && (
                            <div className="space-y-3">
                                {data?.map((log: any) => (
                                    <div key={log.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                                        <div className="flex justify-between items-start mb-2">
                                            <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">{log.user_name || 'Guest'}</span>
                                            <span className="text-xs text-gray-400">{new Date(log.created_at).toLocaleString()}</span>
                                        </div>
                                        <p className="text-sm font-medium text-gray-800 mb-1">Q: {log.user_message}</p>
                                        <p className="text-sm text-gray-500">A: {String(log.ai_response || '').substring(0, 200)}...</p>
                                    </div>
                                ))}
                            </div>
                        )}

                        {activeTab === 'errors' && (
                            <div className="space-y-2">
                                {data?.map((log: any) => (
                                    <div key={log.id} className={`rounded-xl p-4 border text-sm ${log.log_type === 'error' ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'}`}>
                                        <div className="flex justify-between mb-1">
                                            <span className={`text-xs font-bold uppercase ${log.log_type === 'error' ? 'text-red-600' : 'text-amber-600'}`}>{log.log_type}</span>
                                            <span className="text-xs text-gray-400">{new Date(log.created_at).toLocaleString()}</span>
                                        </div>
                                        <p className="text-gray-500 text-xs mb-1">Source: {log.source}</p>
                                        <p className="text-gray-700">{log.message}</p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </>
                ) : null}
            </div>
        </div>
    );
};
