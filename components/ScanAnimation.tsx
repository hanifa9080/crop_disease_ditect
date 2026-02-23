import React from 'react';
import { Leaf, Search, Sparkles, ScanLine } from 'lucide-react';

export const ScanAnimation: React.FC = () => {
    return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] w-full animate-fade-in relative overflow-hidden">

            {/* Ambient Background Glow */}
            <div className="absolute w-[500px] h-[500px] bg-emerald-400/10 rounded-full blur-[100px] animate-pulse" />

            {/* Main Scanner Container */}
            <div className="relative w-64 h-64 mb-10 flex items-center justify-center">

                {/* Pulsing Rings */}
                <div className="absolute inset-0 border-2 border-emerald-100/50 rounded-full animate-ping opacity-20 duration-[3s]" />
                <div className="absolute inset-4 border border-emerald-200/40 rounded-full animate-ping opacity-30 delay-300 duration-[2s]" />

                {/* Rotating Segmented Ring */}
                <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-emerald-400/50 border-r-emerald-300/30 animate-spin duration-[3s]" />
                <div className="absolute inset-2 rounded-full border-2 border-transparent border-b-teal-400/40 border-l-teal-300/20 animate-spin duration-[5s] direction-reverse" />

                {/* Central Hexagon/Grid Background */}
                <div className="absolute inset-8 bg-white/40 backdrop-blur-md rounded-full shadow-2xl flex items-center justify-center border border-white/60">
                    {/* Static Plant Icon */}
                    <div className="relative z-10 text-emerald-600 drop-shadow-lg">
                        <Leaf size={64} strokeWidth={1.5} className="animate-pulse" />

                        {/* Sparkles */}
                        <Sparkles size={16} className="absolute -top-2 -right-2 text-yellow-400 animate-bounce delay-100" />
                        <Sparkles size={12} className="absolute bottom-1 -left-2 text-teal-400 animate-bounce delay-700" />
                    </div>

                    {/* Scanning Beam (Moving Up and Down) */}
                    <div className="absolute inset-0 rounded-full overflow-hidden">
                        <div className="w-full h-1 bg-gradient-to-r from-transparent via-emerald-500 to-transparent shadow-[0_0_15px_rgba(16,185,129,0.8)] absolute top-0 animate-scan" style={{
                            animation: 'scan 2.5s ease-in-out infinite'
                        }} />
                    </div>
                </div>
            </div>

            {/* Text Content */}
            <div className="text-center z-10 space-y-3">
                <h2 className="text-3xl font-bold bg-gradient-to-r from-emerald-600 via-teal-500 to-emerald-600 bg-clip-text text-transparent bg-[length:200%_auto] animate-shimmer">
                    Analyzing Plant
                </h2>

                <div className="flex items-center justify-center gap-2 text-gray-500 text-sm font-medium">
                    <ScanLine size={16} className="animate-pulse text-emerald-400" />
                    <span className="typing-text">Identifying species and health status...</span>
                </div>
            </div>

            {/* Inline Styles for Custom Keyframes not in Tailwind */}
            <style>{`
        @keyframes scan {
          0%, 100% { top: 10%; opacity: 0; }
          10% { opacity: 1; }
          50% { top: 90%; opacity: 1; }
          90% { opacity: 1; }
        }
        @keyframes shimmer {
          0% { background-position: 0% 50%; }
          100% { background-position: 200% 50%; }
        }
        .animate-scan {
          animation: scan 3s ease-in-out infinite;
        }
        .animate-shimmer {
          animation: shimmer 3s linear infinite;
        }
      `}</style>
        </div>
    );
};
