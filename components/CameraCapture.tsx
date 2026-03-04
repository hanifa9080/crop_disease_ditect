import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, RefreshCw } from 'lucide-react';

interface CameraCaptureProps {
    onCapture: (base64Image: string) => void;
    onClose: () => void;
}

export const CameraCapture: React.FC<CameraCaptureProps> = ({ onCapture, onClose }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [stream, setStream] = useState<MediaStream | null>(null);
    const [permissionError, setPermissionError] = useState(false);
    const [captured, setCaptured] = useState<string | null>(null);
    const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');

    const startCamera = async (mode: 'environment' | 'user') => {
        try {
            const mediaStream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: mode }
            });
            setStream(mediaStream);
            if (videoRef.current) videoRef.current.srcObject = mediaStream;
        } catch {
            setPermissionError(true);
        }
    };

    useEffect(() => {
        startCamera(facingMode);
        return () => { stream?.getTracks().forEach(t => t.stop()); };
    }, [facingMode]);

    const handleCapture = () => {
        if (!videoRef.current) return;
        const canvas = document.createElement('canvas');
        canvas.width = videoRef.current.videoWidth;
        canvas.height = videoRef.current.videoHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(videoRef.current, 0, 0);
        const base64 = canvas.toDataURL('image/jpeg', 0.9);
        stream?.getTracks().forEach(t => t.stop());
        setCaptured(base64);
    };

    const handleConfirm = () => {
        if (captured) {
            onCapture(captured); // same callback as ImageUpload — goes to analyzeImage()
            onClose();
        }
    };

    const handleRetake = () => {
        setCaptured(null);
        startCamera(facingMode);
    };

    return (
        <div className="fixed inset-0 z-50 bg-black flex flex-col">
            {/* Header */}
            <div className="absolute top-0 left-0 right-0 p-4 z-20 flex justify-between items-center bg-gradient-to-b from-black/70 to-transparent">
                <button onClick={onClose} className="p-3 rounded-full bg-white/20 text-white">
                    <ArrowLeft size={22} />
                </button>
                <span className="text-white font-bold text-sm">
                    {captured ? 'Review Photo' : 'Position plant in frame'}
                </span>
                {!captured && (
                    <button
                        onClick={() => {
                            stream?.getTracks().forEach(t => t.stop());
                            setFacingMode(f => f === 'environment' ? 'user' : 'environment');
                        }}
                        className="p-3 rounded-full bg-white/20 text-white"
                    >
                        <RefreshCw size={18} />
                    </button>
                )}
            </div>

            {/* Camera / Preview */}
            <div className="flex-1 relative overflow-hidden bg-black">
                {permissionError ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-white text-center p-8">
                        <p className="text-xl font-bold mb-2">Camera Access Required</p>
                        <p className="text-gray-400 mb-6">Allow camera access to capture plant photos.</p>
                        <button onClick={onClose} className="bg-white text-black px-6 py-3 rounded-full font-bold">
                            Go Back
                        </button>
                    </div>
                ) : captured ? (
                    <img src={captured} alt="Captured" className="w-full h-full object-contain" />
                ) : (
                    <>
                        <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                        {/* Corner guide frame */}
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <div className="w-64 h-64 relative">
                                <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-emerald-400 rounded-tl-xl" />
                                <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-emerald-400 rounded-tr-xl" />
                                <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-emerald-400 rounded-bl-xl" />
                                <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-emerald-400 rounded-br-xl" />
                            </div>
                        </div>
                    </>
                )}
            </div>

            {/* Controls */}
            <div className="p-8 flex justify-center items-center gap-8 bg-black">
                {captured ? (
                    <>
                        <button onClick={handleRetake} className="px-6 py-3 rounded-full border-2 border-white/30 text-white font-semibold">
                            Retake
                        </button>
                        <button onClick={handleConfirm} className="px-8 py-3 rounded-full bg-emerald-600 text-white font-bold hover:bg-emerald-700 transition-colors">
                            Analyze Plant
                        </button>
                    </>
                ) : (
                    <button onClick={handleCapture} className="w-20 h-20 rounded-full border-4 border-white flex items-center justify-center">
                        <div className="w-16 h-16 bg-white rounded-full" />
                    </button>
                )}
            </div>
        </div>
    );
};
