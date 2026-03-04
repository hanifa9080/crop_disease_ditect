import React, { useState } from 'react';
import { Shield, Eye, EyeOff } from 'lucide-react';

export const AdminLogin: React.FC<{ onSuccess: () => void }> = ({ onSuccess }) => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPw, setShowPw] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleLogin = async () => {
        setLoading(true); setError('');
        try {
            const r = await fetch('/api/admin/login', {
                method: 'POST', credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password }),
            });
            if (!r.ok) { const e = await r.json(); setError(e.detail || 'Invalid credentials'); return; }
            onSuccess();
        } catch { setError('Connection error. Is the backend running?'); }
        finally { setLoading(false); }
    };

    return (
        <div className="min-h-screen bg-gray-900 flex items-center justify-center">
            <div className="bg-white rounded-3xl p-8 w-full max-w-sm shadow-2xl">
                <div className="flex flex-col items-center mb-8">
                    <div className="bg-emerald-100 p-4 rounded-2xl mb-4">
                        <Shield size={32} className="text-emerald-700" />
                    </div>
                    <h2 className="text-xl font-bold text-gray-800">Admin Access</h2>
                    <p className="text-gray-400 text-sm mt-1">UZHAVAN AI Control Panel</p>
                </div>
                {error && (
                    <div className="bg-red-50 border border-red-200 text-red-600 rounded-xl px-4 py-3 text-sm mb-4">{error}</div>
                )}
                <div className="space-y-4">
                    <div>
                        <label className="text-xs font-medium text-gray-500 mb-1 block">Username</label>
                        <input type="text" value={username} onChange={e => setUsername(e.target.value)}
                            className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-emerald-400"
                            placeholder="admin" />
                    </div>
                    <div>
                        <label className="text-xs font-medium text-gray-500 mb-1 block">Password</label>
                        <div className="relative">
                            <input type={showPw ? 'text' : 'password'} value={password}
                                onChange={e => setPassword(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleLogin()}
                                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-emerald-400 pr-10"
                                placeholder="••••••••" />
                            <button onClick={() => setShowPw(!showPw)} className="absolute right-3 top-3.5 text-gray-400">
                                {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                        </div>
                    </div>
                    <button onClick={handleLogin} disabled={loading}
                        className="w-full py-3 rounded-xl bg-emerald-600 text-white font-bold text-sm hover:bg-emerald-700 transition-colors disabled:opacity-50">
                        {loading ? 'Verifying...' : 'Sign In as Admin'}
                    </button>
                </div>
            </div>
        </div>
    );
};
