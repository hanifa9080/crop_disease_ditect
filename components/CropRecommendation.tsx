import React, { useState } from 'react';
import { getCropRecommendation, CropInput, CropRecommendation as CropRec } from '../services/backendService';
import { Wheat, Loader2, Sprout, Droplets, Thermometer, Wind, FlaskConical, CloudRain, Lightbulb, ArrowRight, Leaf } from 'lucide-react';

export const CropRecommendation: React.FC = () => {
    const [formData, setFormData] = useState<CropInput>({
        N: 90,
        P: 42,
        K: 43,
        temperature: 25,
        humidity: 80,
        pH: 6.5,
        rainfall: 200,
    });

    const [result, setResult] = useState<CropRec | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleChange = (field: keyof CropInput, value: string) => {
        setFormData(prev => ({ ...prev, [field]: parseFloat(value) || 0 }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setResult(null);

        try {
            const data = await getCropRecommendation(formData);
            setResult(data);
        } catch (err: any) {
            setError(err.message || "Failed to get recommendation. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    const handleReset = () => {
        setFormData({
            N: 0,
            P: 0,
            K: 0,
            temperature: 0,
            humidity: 0,
            pH: 0,
            rainfall: 0
        });
        setResult(null);
        setError(null);
    };

    const inputFields: { key: keyof CropInput; label: string; icon: React.ReactNode; min: number; max: number; step: number; unit: string }[] = [
        { key: 'N', label: 'Nitrogen (N)', icon: <FlaskConical size={16} />, min: 0, max: 200, step: 1, unit: 'kg/ha' },
        { key: 'P', label: 'Phosphorus (P)', icon: <FlaskConical size={16} />, min: 0, max: 200, step: 1, unit: 'kg/ha' },
        { key: 'K', label: 'Potassium (K)', icon: <FlaskConical size={16} />, min: 0, max: 200, step: 1, unit: 'kg/ha' },
        { key: 'temperature', label: 'Temperature', icon: <Thermometer size={16} />, min: 0, max: 50, step: 0.5, unit: '°C' },
        { key: 'humidity', label: 'Humidity', icon: <Wind size={16} />, min: 0, max: 100, step: 1, unit: '%' },
        { key: 'pH', label: 'Soil pH', icon: <Droplets size={16} />, min: 0, max: 14, step: 0.1, unit: '' },
        { key: 'rainfall', label: 'Rainfall', icon: <CloudRain size={16} />, min: 0, max: 500, step: 5, unit: 'mm' },
    ];

    return (
        <div className="max-w-3xl mx-auto animate-fade-in-up pb-20">
            {/* Header */}
            <div className="text-center mb-10">
                <div className="inline-flex items-center gap-2 bg-amber-100 text-amber-800 px-4 py-1.5 rounded-full text-sm font-semibold mb-4 border border-amber-200">
                    <Wheat size={16} />
                    Crop Recommendation
                </div>
                <h2 className="text-3xl font-bold text-gray-900 mb-2">
                    What should you <span className="text-amber-600">grow</span>?
                </h2>
                <p className="text-gray-500">
                    Enter your soil & climate data and our AI will recommend the best crop for you.
                </p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="bg-white rounded-3xl shadow-xl border border-amber-50 p-6 sm:p-8 mb-8">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                    {inputFields.map(({ key, label, icon, min, max, step, unit }) => (
                        <div key={key} className="group">
                            <label className="text-sm font-semibold text-gray-700 mb-1.5 flex items-center gap-2">
                                <span className="text-amber-500">{icon}</span>
                                {label}
                                {unit && <span className="text-xs text-gray-400 font-normal">({unit})</span>}
                            </label>
                            <input
                                type="number"
                                value={formData[key]}
                                onChange={(e) => handleChange(key, e.target.value)}
                                min={min}
                                max={max}
                                step={step}
                                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-800 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 transition-all group-hover:border-amber-200"
                                required
                            />
                        </div>
                    ))}
                </div>

                <div className="flex flex-col sm:flex-row gap-4">
                    <button
                        type="button"
                        onClick={handleReset}
                        disabled={loading}
                        className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-4 px-8 rounded-2xl transition-all duration-300 flex items-center justify-center gap-2"
                    >
                        Clear
                    </button>
                    <button
                        type="submit"
                        disabled={loading}
                        className="flex-1 bg-amber-500 hover:bg-amber-600 disabled:bg-amber-300 text-white font-bold py-4 px-8 rounded-2xl transition-all duration-300 shadow-lg shadow-amber-200 hover:shadow-amber-300 hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center gap-3"
                    >
                        {loading ? (
                            <>
                                <Loader2 size={20} className="animate-spin" />
                                Analyzing...
                            </>
                        ) : (
                            <>
                                <Sprout size={20} />
                                Get Recommendation
                                <ArrowRight size={18} />
                            </>
                        )}
                    </button>
                </div>
            </form>

            {/* Error */}
            {error && (
                <div className="bg-red-50 border border-red-100 text-red-700 p-4 rounded-2xl mb-8 text-center animate-fade-in">
                    {error}
                </div>
            )}

            {/* Result */}
            {result && (
                <div className="bg-white rounded-3xl shadow-xl border border-amber-50 overflow-hidden animate-fade-in-up">
                    {/* Result Header */}
                    <div className="bg-amber-500 p-6 sm:p-8 text-white relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-6 opacity-10 pointer-events-none">
                            <Leaf size={100} />
                        </div>
                        <div className="relative z-10">
                            <span className="text-amber-100 text-sm font-semibold uppercase tracking-wider">Recommended Crop</span>
                            <h3 className="text-4xl font-bold mt-1 text-white">{result.recommended_crop}</h3>
                        </div>
                    </div>

                    {/* Reason */}
                    <div className="p-6 sm:p-8 space-y-6">
                        <div>
                            <h4 className="font-bold text-gray-800 mb-2 flex items-center gap-2">
                                <Lightbulb size={18} className="text-amber-500" /> Why This Crop?
                            </h4>
                            <p className="text-gray-600 leading-relaxed bg-amber-50 p-4 rounded-xl border border-amber-100">
                                {result.reason}
                            </p>
                        </div>

                        {/* Care Tips */}
                        {result.care_tips && result.care_tips.length > 0 && (
                            <div>
                                <h4 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
                                    <Sprout size={18} className="text-emerald-500" /> Care Tips
                                </h4>
                                <div className="space-y-2">
                                    {result.care_tips.map((tip, i) => (
                                        <div key={i} className="flex items-start gap-3 bg-emerald-50 p-3 rounded-xl border border-emerald-100">
                                            <span className="bg-emerald-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                                                {i + 1}
                                            </span>
                                            <span className="text-emerald-800 text-sm">{tip}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
