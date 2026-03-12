import React, { useState } from 'react';
import { Leaf, Zap, Camera, MapPin, TrendingUp, Sprout, Sun, Droplets, Wind, ChevronRight, Shield, Star, Users, BarChart2 } from 'lucide-react';
import { AuthModal } from './AuthModal';

/* ── Tamil Nadu Farming Stats ─────────────────────────────────────────────── */
const TN_STATS = [
    { value: '62 Lakh+', label: 'Hectares of Farmland', icon: '🌾' },
    { value: '1.2 Cr+', label: 'Farming Families', icon: '👨‍🌾' },
    { value: '32%', label: 'of TN Workforce in Agri', icon: '📊' },
    { value: '₹1.8L Cr', label: 'Annual Agri GDP', icon: '💰' },
];

/* ── Supported Crops — exactly what the MobileNetV3 model covers ─────────── */
const CROPS = [
    { name: 'தக்காளி (Tomato)', emoji: '🍅', diseases: 9, note: 'Bacterial Spot, Early & Late Blight, Leaf Mold, Septoria, Spider Mites, Target Spot, TYLCV, Mosaic Virus' },
    { name: 'சோளம் (Corn)', emoji: '🌽', diseases: 3, note: 'Cercospora Leaf Spot, Common Rust, Northern Leaf Blight' },
    { name: 'திராட்சை (Grape)', emoji: '🍇', diseases: 3, note: 'Black Rot, Esca (Black Measles), Leaf Blight' },
    { name: 'மரவள்ளி (Potato)', emoji: '🥔', diseases: 2, note: 'Early Blight, Late Blight' },
    { name: 'ஆரஞ்சு (Orange)', emoji: '🍊', diseases: 1, note: 'Huanglongbing (Citrus Greening)' },
    { name: 'மிளகாய் (Bell Pepper)', emoji: '🫑', diseases: 1, note: 'Bacterial Spot' },
    { name: 'ஸ்ட்ராபெர்ரி (Strawberry)', emoji: '🍓', diseases: 1, note: 'Leaf Scorch' },
    { name: 'சோயா (Soybean)', emoji: '🌿', diseases: 0, note: 'Healthy detection' },
];

/* ── How It Works ─────────────────────────────────────────────────────────── */
const HOW_STEPS = [
    { step: '01', icon: <Camera size={24} />, title: 'Capture / Upload', desc: 'Take a photo of your crop leaf or upload from your gallery. Even a smartphone photo works perfectly.' },
    { step: '02', icon: <Zap size={24} />, title: 'AI Scans the Leaf', desc: 'Our MobileNetV3 model analyses visual patterns — spots, yellowing, blight — across 27+ disease types in seconds.' },
    { step: '03', icon: <Leaf size={24} />, title: 'Get Full Diagnosis', desc: 'Receive the disease name, severity, affected crops and a complete Tamil-language treatment plan powered by Gemma AI.' },
    { step: '04', icon: <TrendingUp size={24} />, title: 'Track & Manage', desc: 'Save your scan history, monitor crop health trends, and get seasonal recommendations tailored to Tamil Nadu.' },
];

/* ── Disease Categories — counts derived from the 27-class model ─────────── */
const DISEASE_GROUPS = [
    { category: 'Fungal Diseases', count: 14, examples: 'Corn GLS & NLB, Common Rust, Grape Black Rot & Esca, Potato/Tomato Early & Late Blight, Tomato Leaf Mold, Septoria, Target Spot, Strawberry Leaf Scorch', color: 'bg-orange-50 border-orange-200 text-orange-700' },
    { category: 'Bacterial Diseases', count: 3, examples: 'Orange Huanglongbing (Citrus Greening), Bell Pepper Bacterial Spot, Tomato Bacterial Spot', color: 'bg-red-50 border-red-200 text-red-700' },
    { category: 'Viral & Pest', count: 3, examples: 'Tomato Yellow Leaf Curl Virus, Tomato Mosaic Virus, Tomato Spider Mites', color: 'bg-purple-50 border-purple-200 text-purple-700' },
    { category: 'Healthy Detection', count: 7, examples: 'Confirms healthy leaves for Corn, Grape, Pepper, Potato, Soybean, Strawberry & Tomato', color: 'bg-emerald-50 border-emerald-200 text-emerald-700' },
];

export const LandingPage: React.FC = () => {
    const [showAuth, setShowAuth] = useState(false);
    const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');

    const openLogin = () => { setAuthMode('login'); setShowAuth(true); };
    const openSignup = () => { setAuthMode('signup'); setShowAuth(true); };

    return (
        <div className="min-h-screen bg-white flex flex-col font-sans">

            {/* ══ NAVBAR ══════════════════════════════════════════════════════════ */}
            <nav className="flex items-center justify-between px-6 py-4 border-b border-emerald-100 bg-white/90 backdrop-blur-sm sticky top-0 z-40 shadow-sm">
                <div className="flex items-center gap-3">
                    <div className="bg-gradient-to-br from-emerald-500 to-emerald-700 p-2.5 rounded-2xl shadow-md shadow-emerald-200">
                        <Leaf size={22} className="text-white" />
                    </div>
                    <div>
                        <h1 className="font-bold text-gray-900 text-lg leading-none tracking-tight">UZHAVAN AI</h1>
                        <p className="text-[10px] text-emerald-600 font-bold tracking-[0.15em] uppercase">உழவன் AI — Tamil Agri Intelligence</p>
                    </div>
                </div>
                <div className="hidden md:flex items-center gap-6 text-sm font-medium text-gray-600">
                    <a href="#crops" className="hover:text-emerald-600 transition-colors">Crops</a>
                    <a href="#howit" className="hover:text-emerald-600 transition-colors">How It Works</a>
                    <a href="#diseases" className="hover:text-emerald-600 transition-colors">Diseases</a>
                </div>
                <div className="flex gap-3">
                    <button onClick={openLogin} className="px-5 py-2 rounded-full text-sm font-semibold text-emerald-700 border-2 border-emerald-200 hover:border-emerald-400 hover:bg-emerald-50 transition-all duration-200">
                        Sign In
                    </button>
                    <button onClick={openSignup} className="px-5 py-2 rounded-full text-sm font-semibold bg-emerald-600 text-white hover:bg-emerald-700 transition-all shadow-md shadow-emerald-200 hover:scale-[1.02] active:scale-[0.98]">
                        Get Started
                    </button>
                </div>
            </nav>

            {/* ══ HERO — Full-width Farming Imagery ═══════════════════════════════ */}
            <section className="relative min-h-[92vh] flex items-center overflow-hidden">
                {/* Background farming image */}
                <div className="absolute inset-0 z-0">
                    <img
                        src="/assets/images/hero-bg.jpg"
                        alt="Tamil Nadu paddy fields"
                        className="w-full h-full object-cover object-center"
                    />
                    <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/40 to-transparent" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
                </div>

                {/* Hero Content */}
                <div className="relative z-10 flex flex-col lg:flex-row items-center justify-between w-full max-w-7xl mx-auto px-6 py-20 gap-12">
                    {/* Left — Text */}
                    <div className="flex-1 text-left max-w-2xl">
                        {/* Badge */}
                        <div className="inline-flex items-center gap-2 bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 px-4 py-1.5 rounded-full text-sm font-semibold mb-6 backdrop-blur-sm">
                            <Zap size={13} className="fill-emerald-400" />
                            Powered by MobileNetV3 + Gemma 3 AI
                        </div>

                        <h2 className="text-5xl sm:text-6xl font-extrabold text-white mb-5 leading-tight">
                            Protect Tamil Nadu's<br />
                            <span className="text-emerald-400">Farmlands</span> with AI
                        </h2>

                        <p className="text-gray-200 text-lg leading-relaxed mb-8 max-w-xl">
                            UZHAVAN AI brings cutting-edge plant disease detection to Tamil Nadu's 1.2 crore farming families.
                            Scan any crop leaf — get an instant diagnosis, treatment plan, and agri advice in Tamil and English.
                        </p>

                        {/* Quick Stats Row */}
                        <div className="flex flex-wrap gap-4 mb-8">
                            {[
                                { label: '27+ Diseases', sub: 'Detectable' },
                                { label: '8 Major Crops', sub: 'Supported' },
                                { label: '< 3 Seconds', sub: 'Diagnosis Time' },
                            ].map((s, i) => (
                                <div key={i} className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl px-4 py-2.5 text-white">
                                    <div className="font-bold text-base">{s.label}</div>
                                    <div className="text-xs text-gray-300">{s.sub}</div>
                                </div>
                            ))}
                        </div>

                        {/* CTA */}
                        <div className="flex flex-col sm:flex-row gap-4">
                            <button onClick={openSignup} className="flex items-center justify-center gap-2 px-8 py-4 rounded-2xl text-base font-bold bg-emerald-500 text-white hover:bg-emerald-400 transition-all shadow-2xl hover:scale-[1.02] active:scale-[0.98]">
                                🌱 Start Free — உழவரின் தொழில்நுட்பம்
                                <ChevronRight size={18} />
                            </button>
                            <button onClick={openLogin} className="px-8 py-4 rounded-2xl text-base font-bold text-white border-2 border-white/40 hover:border-white hover:bg-white/10 transition-all backdrop-blur-sm">
                                Sign In
                            </button>
                        </div>
                    </div>

                    {/* Right — Farmer Card */}
                    <div className="hidden lg:block flex-shrink-0 w-80">
                        <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-3xl overflow-hidden shadow-2xl">
                            <img
                                src="/assets/images/farmer-card.jpg"
                                alt="Farmer in Tamil Nadu rice field"
                                className="w-full h-52 object-cover"
                            />
                            <div className="p-5">
                                <div className="flex items-center gap-2 mb-2">
                                    <MapPin size={14} className="text-emerald-400" />
                                    <span className="text-emerald-300 text-xs font-semibold">Tamil Nadu, India</span>
                                </div>
                                <p className="text-white font-bold text-sm mb-1">தஞ்சாவூர் — Rice Bowl</p>
                                <p className="text-gray-300 text-xs leading-relaxed">Paddy cultivation across the Cauvery delta — the heartland of Tamil agriculture for over 2000 years.</p>
                                <div className="mt-3 flex gap-2">
                                    <span className="bg-emerald-500/30 text-emerald-300 text-[10px] font-semibold px-2 py-1 rounded-full border border-emerald-500/40">🌾 Paddy</span>
                                    <span className="bg-blue-500/30 text-blue-300 text-[10px] font-semibold px-2 py-1 rounded-full border border-blue-500/40">💧 Cauvery</span>
                                    <span className="bg-amber-500/30 text-amber-300 text-[10px] font-semibold px-2 py-1 rounded-full border border-amber-500/40">☀️ Samba</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Bottom wave */}
                <div className="absolute bottom-0 left-0 right-0 z-10">
                    <svg viewBox="0 0 1440 60" className="w-full" preserveAspectRatio="none">
                        <path fill="white" d="M0,40 C360,80 1080,0 1440,40 L1440,60 L0,60 Z" />
                    </svg>
                </div>
            </section>

            {/* ══ TAMIL NADU AGRICULTURE STATS BAR ════════════════════════════════ */}
            <section className="bg-white py-10 px-6">
                <p className="text-center text-xs font-bold tracking-widest text-emerald-600 uppercase mb-6">Tamil Nadu Agriculture at a Glance</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-4xl mx-auto">
                    {TN_STATS.map((s, i) => (
                        <div key={i} className="text-center bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-100 rounded-2xl py-5 px-3 shadow-sm hover:shadow-md transition-all">
                            <div className="text-3xl mb-2">{s.icon}</div>
                            <div className="text-2xl font-extrabold text-gray-900 leading-none">{s.value}</div>
                            <div className="text-xs text-gray-500 mt-1 leading-snug">{s.label}</div>
                        </div>
                    ))}
                </div>
            </section>

            {/* ══ FARMING GALLERY STRIP ════════════════════════════════════════════ */}
            <section className="py-12 px-6 bg-gradient-to-br from-emerald-50 to-teal-50 overflow-hidden">
                <p className="text-center text-xs font-bold tracking-widest text-emerald-600 uppercase mb-6">Across Tamil Nadu's Fields</p>
                <div className="flex gap-4 max-w-6xl mx-auto flex-wrap justify-center">
                    {[
                        { url: '/assets/images/gallery-1.jpg', caption: 'Paddy Fields — Thanjavur' },
                        { url: '/assets/images/gallery-2.jpg', caption: 'Farmer Planting Seedlings' },
                        { url: '/assets/images/gallery-3.jpg', caption: 'Lush Crop Rows' },
                        { url: '/assets/images/farmer-card.jpg', caption: 'Rice Harvest Season' },
                        { url: '/assets/images/gallery-4.jpg', caption: 'Vegetable Cultivation' },
                    ].map((img, i) => (
                        <div key={i} className="relative rounded-2xl overflow-hidden shadow-lg group flex-shrink-0" style={{ width: 180, height: 140 }}>
                            <img src={img.url} alt={img.caption} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                            <p className="absolute bottom-2 left-2 right-2 text-white text-[9px] font-semibold leading-tight">{img.caption}</p>
                        </div>
                    ))}
                </div>
            </section>

            {/* ══ HOW IT WORKS ════════════════════════════════════════════════════ */}
            <section id="howit" className="py-20 px-6 bg-white">
                <div className="max-w-5xl mx-auto">
                    <p className="text-center text-xs font-bold tracking-widest text-emerald-600 uppercase mb-3">How It Works</p>
                    <h3 className="text-3xl font-extrabold text-gray-900 text-center mb-12">
                        Diagnosis in <span className="text-emerald-600">4 Simple Steps</span>
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                        {HOW_STEPS.map((s) => (
                            <div key={s.step} className="relative bg-gradient-to-br from-emerald-50 to-white border border-emerald-100 rounded-3xl p-6 shadow-sm hover:shadow-xl hover:border-emerald-300 transition-all duration-300 text-left group">
                                <div className="absolute top-4 right-4 text-4xl font-black text-emerald-100 group-hover:text-emerald-200 transition-colors">{s.step}</div>
                                <div className="bg-emerald-500 text-white w-12 h-12 rounded-2xl flex items-center justify-center mb-4 shadow-md shadow-emerald-200 group-hover:scale-110 transition-transform">
                                    {s.icon}
                                </div>
                                <h4 className="font-bold text-gray-900 mb-2">{s.title}</h4>
                                <p className="text-gray-500 text-sm leading-relaxed">{s.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ══ SUPPORTED CROPS ════════════════════════════════════════════════ */}
            <section id="crops" className="py-20 px-6 bg-gradient-to-br from-amber-50 via-white to-emerald-50">
                <div className="max-w-5xl mx-auto">
                    <p className="text-center text-xs font-bold tracking-widest text-amber-600 uppercase mb-3">Detection Coverage</p>
                    <h3 className="text-3xl font-extrabold text-gray-900 text-center mb-4">
                        Major Tamil Nadu <span className="text-amber-600">Crops Supported</span>
                    </h3>
                    <p className="text-center text-gray-500 text-sm mb-10 max-w-xl mx-auto">
                        Built for the crops grown across Tamil Nadu's districts — from the Cauvery delta to the Nilgiri hills.
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        {CROPS.map((c, i) => (
                            <div key={i} className="bg-white border border-amber-100 rounded-2xl p-4 shadow-sm hover:shadow-md hover:border-amber-300 transition-all group text-left">
                                <div className="text-3xl mb-2 group-hover:scale-110 transition-transform inline-block">{c.emoji}</div>
                                <h4 className="font-bold text-gray-800 text-sm mb-1">{c.name}</h4>
                                {c.diseases > 0 ? (
                                    <p className="text-[10px] text-red-500 font-bold mb-1">{c.diseases} disease{c.diseases > 1 ? 's' : ''} detected</p>
                                ) : (
                                    <p className="text-[10px] text-emerald-600 font-bold mb-1">Healthy check only</p>
                                )}
                                <p className="text-[10px] text-gray-400 leading-relaxed">{c.note}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ══ DISEASE CATEGORIES ═════════════════════════════════════════════ */}
            <section id="diseases" className="py-16 px-6 bg-white">
                <div className="max-w-4xl mx-auto">
                    <p className="text-center text-xs font-bold tracking-widest text-red-500 uppercase mb-3">Disease Intelligence</p>
                    <h3 className="text-3xl font-extrabold text-gray-900 text-center mb-10">
                        27 Classes Across <span className="text-red-500">4 Categories</span>
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {DISEASE_GROUPS.map((d, i) => (
                            <div key={i} className={`border rounded-2xl p-5 ${d.color} transition-all hover:scale-[1.01]`}>
                                <div className="flex items-center justify-between mb-2">
                                    <h4 className="font-bold text-base">{d.category}</h4>
                                    <span className="text-2xl font-black opacity-40">{d.count}</span>
                                </div>
                                <p className="text-xs opacity-80 leading-relaxed">{d.examples}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ══ AGRI CONDITIONS SECTION ════════════════════════════════════════ */}
            <section className="py-16 px-6 bg-white">
                <div className="max-w-4xl mx-auto">
                    <p className="text-center text-xs font-bold tracking-widest text-emerald-600 uppercase mb-8">Tamil Nadu Growing Conditions</p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        {[
                            { icon: <Sun size={20} className="text-yellow-500" />, label: 'Tropical Climate', value: '27–35°C', desc: 'Ideal for paddy & sugarcane', bg: 'bg-yellow-50 border-yellow-200' },
                            { icon: <Droplets size={20} className="text-blue-500" />, label: 'Annual Rainfall', value: '925 mm', desc: 'NE & SW monsoons', bg: 'bg-blue-50 border-blue-200' },
                            { icon: <Wind size={20} className="text-teal-500" />, label: 'Crop Seasons', value: '3 Seasons', desc: 'Kuruvai, Samba, Navarai', bg: 'bg-teal-50 border-teal-200' },
                            { icon: <Sprout size={20} className="text-emerald-500" />, label: 'Irrigation Coverage', value: '57%', desc: 'Canal, tank & well irrigation', bg: 'bg-emerald-50 border-emerald-200' },
                        ].map((item, i) => (
                            <div key={i} className={`border rounded-2xl p-4 ${item.bg} text-left hover:scale-[1.02] transition-transform`}>
                                <div className="mb-2">{item.icon}</div>
                                <div className="text-xl font-extrabold text-gray-900 leading-none">{item.value}</div>
                                <div className="text-xs font-bold text-gray-700 mt-1">{item.label}</div>
                                <div className="text-[10px] text-gray-500 mt-0.5">{item.desc}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ══ FEATURES DETAIL ════════════════════════════════════════════════ */}
            <section className="py-20 px-6 bg-gradient-to-br from-emerald-700 to-teal-800 text-white">
                <div className="max-w-5xl mx-auto">
                    <p className="text-center text-xs font-bold tracking-widest text-emerald-300 uppercase mb-3">Platform Features</p>
                    <h3 className="text-3xl font-extrabold text-center mb-12">
                        Everything a Tamil Farmer Needs
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                        {[
                            { icon: <Camera size={20} />, title: 'Smart Leaf Scanner', desc: 'Point your phone at any crop leaf — our MobileNetV3 AI reads disease symptoms across 8 plants with high accuracy.' },
                            { icon: <BarChart2 size={20} />, title: 'Crop Health History', desc: 'Track your farm\'s disease patterns over weeks and seasons to plan preventive action early.' },
                            { icon: <Sprout size={20} />, title: 'Seasonal Crop Advice', desc: 'Timely recommendations for Kuruvai, Samba and Navarai seasons based on your location.' },
                            { icon: <Users size={20} />, title: 'Multi-Farm Management', desc: 'Manage multiple fields and crops from a single dashboard — ideal for farmer groups and cooperatives.' },
                            { icon: <Star size={20} />, title: 'AI Agri Chat', desc: 'Ask any farming question and get detailed answers from our Gemma 3 AI tuned for Tamil Nadu agriculture.' },
                            { icon: <Shield size={20} />, title: 'Disease Treatment Guide', desc: 'Get organic and chemical treatment options for each detected disease with prevention tips.' },
                        ].map((f, i) => (
                            <div key={i} className="bg-white/10 backdrop-blur-sm border border-white/15 rounded-2xl p-5 hover:bg-white/15 transition-all">
                                <div className="bg-emerald-500 text-white w-10 h-10 rounded-xl flex items-center justify-center mb-3 shadow-md">
                                    {f.icon}
                                </div>
                                <h4 className="font-bold text-white mb-1.5">{f.title}</h4>
                                <p className="text-emerald-100 text-sm leading-relaxed">{f.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ══ KURAL + CTA ════════════════════════════════════════════════════ */}
            <section className="relative py-24 px-6 overflow-hidden">
                <div className="absolute inset-0 z-0">
                    <img
                        src="/assets/images/cta-bg.jpg"
                        alt="Tamil Nadu farmland"
                        className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/65" />
                </div>
                <div className="relative z-10 max-w-3xl mx-auto text-center">
                    {/* Kural */}
                    <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-3xl px-8 py-7 mb-10 shadow-2xl inline-block max-w-xl">
                        <div className="text-emerald-300 text-4xl mb-3">❝</div>
                        <p className="text-white font-bold text-xl leading-relaxed mb-2" style={{ fontFamily: "'Noto Sans Tamil', sans-serif" }}>
                            உழுவார் உலகத்தார்க்கு ஆணிக்கல் ஆகலால்
                        </p>
                        <p className="text-emerald-200 font-medium text-sm mb-1">ஏனை யவர்க்கு அதனை தாங்கி நிற்பவர்.</p>
                        <p className="text-gray-400 text-xs mt-2">
                            "Farmers are the linchpin of the world — for they sustain all others." — Thiruvalluvar, Kural 1031
                        </p>
                    </div>

                    <h3 className="text-4xl font-extrabold text-white mb-4">
                        Join Tamil Nadu's <span className="text-emerald-400">Farming Revolution</span>
                    </h3>
                    <p className="text-gray-300 text-lg mb-8 max-w-xl mx-auto leading-relaxed">
                        Free for every farmer. Help your crops thrive this season with AI-powered disease detection built for Tamil Nadu's fields.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-4 justify-center">
                        <button onClick={openSignup} className="flex items-center justify-center gap-2 px-10 py-4 rounded-2xl text-base font-bold bg-emerald-500 text-white hover:bg-emerald-400 transition-all shadow-2xl hover:scale-[1.02]">
                            🌾 உழவரின் கணக்கை உருவாக்குக
                            <ChevronRight size={18} />
                        </button>
                        <button onClick={openLogin} className="px-10 py-4 rounded-2xl text-base font-bold text-white border-2 border-white/40 hover:border-white hover:bg-white/10 transition-all">
                            Sign In
                        </button>
                    </div>
                </div>
            </section>

            {/* ══ FOOTER ══════════════════════════════════════════════════════════ */}
            <footer className="bg-gray-900 text-gray-400 px-6 py-10">
                <div className="max-w-5xl mx-auto">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 mb-8">
                        <div className="flex items-center gap-3">
                            <div className="bg-gradient-to-br from-emerald-500 to-emerald-700 p-2 rounded-xl">
                                <Leaf size={18} className="text-white" />
                            </div>
                            <div>
                                <p className="font-bold text-white text-base leading-none">UZHAVAN AI — உழவன் AI</p>
                                <p className="text-[10px] text-emerald-500 mt-0.5">Tamil Agri Intelligence Platform</p>
                            </div>
                        </div>
                        <div className="flex flex-wrap gap-4 text-xs">
                            {['Tomato', 'Corn', 'Grape', 'Potato', 'Orange', 'Bell Pepper', 'Strawberry', 'Soybean'].map(c => (
                                <span key={c} className="bg-gray-800 px-3 py-1 rounded-full text-gray-300 text-[10px]">{c}</span>
                            ))}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8 text-xs leading-6">
                        <div>
                            <p className="text-white font-semibold mb-2">About the Project</p>
                            <p>Built as a final year engineering project to bring AI-powered crop disease detection to Tamil Nadu's farming communities using MobileNetV3 and Gemma 3 AI.</p>
                        </div>
                        <div>
                            <p className="text-white font-semibold mb-2">Agro-Climatic Zones</p>
                            <p>Covers all 7 agro-climatic zones of Tamil Nadu — Northern, North-Western, Western, Southern, Cauvery Delta, Hilly, and High Rainfall zones.</p>
                        </div>
                        <div>
                            <p className="text-white font-semibold mb-2">Disease Focus</p>
                            <p>Identifies fungal, bacterial, and viral diseases affecting the major crops grown across Tamil Nadu's 38 districts throughout all three crop seasons.</p>
                        </div>
                    </div>

                    <div className="border-t border-gray-800 pt-5 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px]">
                        <p>UZHAVAN AI &nbsp;|&nbsp; உழவன் AI &nbsp;|&nbsp; Final Year Project &nbsp;|&nbsp; Built for Tamil Farmers 🌾</p>
                        <p className="text-gray-600">MobileNetV3 + Gemma 3 1B &nbsp;·&nbsp; Disease Detection Platform</p>
                    </div>
                </div>
            </footer>

            {/* Auth Modal */}
            <AuthModal
                isOpen={showAuth}
                onClose={() => setShowAuth(false)}
                initialMode={authMode}
            />
        </div>
    );
};
