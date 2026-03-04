import React, { useState } from 'react';
import { Leaf, Zap, Wifi } from 'lucide-react';
import { AuthModal } from './AuthModal';

export const LandingPage: React.FC = () => {
    const [showAuth, setShowAuth] = useState(false);
    const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');

    const openLogin = () => { setAuthMode('login'); setShowAuth(true); };
    const openSignup = () => { setAuthMode('signup'); setShowAuth(true); };

    return (
        <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-teal-50 flex flex-col">

            {/* ── Navbar ────────────────────────────────────────────────────────── */}
            <nav className="flex items-center justify-between px-6 py-4 border-b border-emerald-100 bg-white/80 backdrop-blur-sm sticky top-0 z-40">
                <div className="flex items-center gap-3">
                    <div className="bg-gradient-to-br from-emerald-500 to-emerald-700 p-2.5 rounded-2xl shadow-md shadow-emerald-200">
                        <Leaf size={22} className="text-white" />
                    </div>
                    <div>
                        <h1 className="font-bold text-gray-900 text-lg leading-none tracking-tight">UZHAVAN AI</h1>
                        <p className="text-[10px] text-emerald-600 font-bold tracking-[0.15em] uppercase">AI Crop Disease Expert</p>
                    </div>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={openLogin}
                        className="px-5 py-2 rounded-full text-sm font-semibold text-emerald-700 border-2 border-emerald-200 hover:border-emerald-400 hover:bg-emerald-50 transition-all duration-200"
                    >
                        Sign In
                    </button>
                    <button
                        onClick={openSignup}
                        className="px-5 py-2 rounded-full text-sm font-semibold bg-emerald-600 text-white hover:bg-emerald-700 transition-all shadow-md shadow-emerald-200 hover:scale-[1.02] active:scale-[0.98]"
                    >
                        Get Started
                    </button>
                </div>
            </nav>

            {/* ── Hero ──────────────────────────────────────────────────────────── */}
            <div className="flex-1 flex flex-col items-center justify-center text-center px-6 py-16">

                {/* Badge */}
                <div className="inline-flex items-center gap-2 bg-emerald-100 text-emerald-700 px-4 py-1.5 rounded-full text-sm font-semibold mb-6 border border-emerald-200 animate-bounce-slow">
                    <Zap size={14} className="fill-emerald-500" />
                    Powered by MobileNetV3 + Gemma 3 1B — 100% Offline
                </div>

                {/* Heading */}
                <h2 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-4 max-w-2xl leading-tight">
                    Heal your crops with{' '}
                    <span className="text-emerald-600">UZHAVAN</span> AI.
                </h2>

                <p className="text-gray-500 text-lg max-w-xl mb-10 leading-relaxed">
                    Instant plant disease detection for Tamil farmers.
                    Upload a photo — get a diagnosis, treatment plan, and crop advice in seconds.
                    No internet required.
                </p>

                {/* CTA Buttons */}
                <div className="flex flex-col sm:flex-row gap-4 mb-16">
                    <button
                        onClick={openSignup}
                        className="px-8 py-4 rounded-2xl text-base font-bold bg-emerald-600 text-white hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-200 hover:scale-[1.02] active:scale-[0.98]"
                    >
                        🌱 Create Free Account
                    </button>
                    <button
                        onClick={openLogin}
                        className="px-8 py-4 rounded-2xl text-base font-bold text-gray-700 border-2 border-gray-200 hover:border-emerald-400 hover:text-emerald-600 transition-all"
                    >
                        Sign In
                    </button>
                </div>

                {/* Feature Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl w-full mb-16">
                    {[
                        {
                            icon: <Leaf size={20} />,
                            title: '27 Crop Diseases',
                            desc: 'Detects diseases across corn, tomato, grape, potato and more',
                        },
                        {
                            icon: <Zap size={20} />,
                            title: 'Instant Results',
                            desc: 'AI diagnosis in under 3 seconds using local MobileNetV3 model',
                        },
                        {
                            icon: <Wifi size={20} />,
                            title: '100% Offline',
                            desc: 'No internet needed — runs entirely on your local machine',
                        },
                    ].map((f, i) => (
                        <div key={i} className="bg-white rounded-2xl p-5 border border-emerald-50 shadow-sm text-left hover:shadow-md hover:border-emerald-200 transition-all duration-200">
                            <div className="text-emerald-500 mb-3 bg-emerald-50 w-10 h-10 rounded-xl flex items-center justify-center">{f.icon}</div>
                            <h4 className="font-bold text-gray-800 text-sm mb-1">{f.title}</h4>
                            <p className="text-gray-500 text-xs leading-relaxed">{f.desc}</p>
                        </div>
                    ))}
                </div>

                {/* Thiruvalluvar Kural — cultural identity */}
                <div className="bg-white/60 backdrop-blur-sm border border-emerald-100 rounded-2xl px-8 py-5 max-w-lg shadow-sm">
                    <p className="text-emerald-700 font-medium text-sm italic mb-1" style={{ fontFamily: "'Noto Sans Tamil', sans-serif" }}>
                        "உழுவார் உலகத்தார்க்கு ஆணிக்கல் — ஆகலால்"
                    </p>
                    <p className="text-gray-400 text-xs">
                        "Farmers are the linchpin of the world" — Thiruvalluvar, Kural 1031
                    </p>
                </div>
            </div>

            {/* ── Footer ────────────────────────────────────────────────────────── */}
            <div className="text-center py-4 text-xs text-gray-400 border-t border-gray-100">
                UZHAVAN AI — உழவன் AI &nbsp;|&nbsp; Final Year Project &nbsp;|&nbsp; Built for Tamil Farmers
            </div>

            {/* Auth Modal — triggered by Sign In / Get Started buttons */}
            <AuthModal
                isOpen={showAuth}
                onClose={() => setShowAuth(false)}
                initialMode={authMode}
            />
        </div>
    );
};
