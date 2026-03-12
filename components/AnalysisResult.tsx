import React, { useState, useEffect, useRef } from 'react';
import { PlantAnalysisResult, IssueCheck } from '../types';
import {
  CheckCircle,
  AlertTriangle,
  Droplets,
  Sun,
  Bug,
  Sprout,
  ThermometerSun,
  Activity,
  HeartPulse,
  Leaf,
  ShieldCheck,
  Stethoscope,
  BookOpen,
  ExternalLink,
  Share2,
  Copy,
  X,
  Twitter,
  MessageCircle,
  Volume2,
  VolumeX,
  Download,
  FileDown,
  FileText
} from 'lucide-react';

interface AnalysisResultProps {
  results: PlantAnalysisResult[];
  onReset: () => void;
  image?: string | null;
}

// ── Download Utility Functions (exported for HistoryView) ─────────────────

export function buildReportHTML(
  result: PlantAnalysisResult,
  imageUrl?: string | null
): string {
  const isHealthy = !result.issues?.diseases?.detected;
  const statusLabel = isHealthy
    ? '✓ Healthy'
    : (result.diagnosis?.split('.')[0] || 'Disease Detected');
  const statusColor = isHealthy ? '#059669' : '#dc2626';
  const statusBg = isHealthy ? 'rgba(16,185,129,0.18)' : 'rgba(239,68,68,0.18)';

  const issueRows = result.issues
    ? Object.entries(result.issues).map(([key, val]) => {
      const issue = val as any;
      const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase());
      return `<tr>
          <td style="padding:10px 14px;border-bottom:1px solid #f3f4f6;
                     font-weight:600;color:#374151;width:36%">${label}</td>
          <td style="padding:10px 14px;border-bottom:1px solid #f3f4f6;
                     color:${issue.detected ? '#dc2626' : '#059669'}">
            ${issue.detected ? '⚠ ' + issue.details : '✓ ' + issue.details}
          </td>
        </tr>`;
    }).join('') : '';

  const treatmentHTML = result.treatmentPlan?.map((step, i) => `
    <div style="display:flex;gap:14px;margin-bottom:18px;align-items:flex-start">
      <div style="background:#059669;color:white;min-width:28px;height:28px;
                  border-radius:50%;display:flex;align-items:center;
                  justify-content:center;font-weight:700;font-size:13px;
                  flex-shrink:0">${i + 1}</div>
      <div>
        <div style="font-weight:700;color:#1f2937;margin-bottom:3px">${step.title}</div>
        <div style="color:#4b5563;font-size:14px;line-height:1.6">${step.instruction}</div>
      </div>
    </div>`).join('') || '';

  const tipsHTML = result.preventionTips?.map(tip => {
    const isObj = typeof tip !== 'string';
    const text = isObj ? `<strong>${(tip as any).title || ''}:</strong> ${(tip as any).instruction || ''}` : tip;
    return `<div style="display:flex;gap:10px;padding:9px 0;border-bottom:1px solid #d1fae5">
      <span style="color:#059669;font-size:18px;line-height:1;flex-shrink:0">•</span>
      <span style="color:#065f46;font-size:14px;line-height:1.5">${text}</span>
    </div>`;
  }).join('') || '';

  const resourcesHTML = result.expertResources?.map(r =>
    `<div style="background:#f0fdf4;border:1px solid #6ee7b7;border-radius:10px;
                 padding:13px;margin-bottom:9px">
      <div style="font-weight:700;color:#065f46;margin-bottom:3px">${r.title}</div>
      <div style="font-size:13px;color:#6b7280;margin-bottom:5px">${r.description}</div>
      <a href="${r.url}" style="font-size:12px;color:#059669;word-break:break-all">${r.url}</a>
    </div>`).join('') || '';

  const imgHTML = imageUrl
    ? `<img src="${imageUrl}" style="width:100%;max-height:220px;object-fit:cover;
                                      border-radius:12px;margin-bottom:22px" />`
    : '';

  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">
<title>UZHAVAN AI — ${result.plantName}</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'Segoe UI',Arial,sans-serif;color:#1f2937;background:#f3f4f6}
  @media print{
    body{background:white}
    .no-print{display:none!important}
    .page{box-shadow:none!important;margin:0!important}
  }
  .no-print{background:#059669;padding:14px;text-align:center}
  .save-btn{background:white;color:#059669;border:none;padding:10px 26px;
            border-radius:8px;font-size:14px;font-weight:700;cursor:pointer}
  .hint{color:rgba(255,255,255,0.75);font-size:11px;margin-top:5px}
  .page{max-width:780px;margin:0 auto;background:white;
        box-shadow:0 4px 28px rgba(0,0,0,0.1)}
  .hdr{background:linear-gradient(135deg,#059669,#064e3b);
       padding:30px 34px;color:white;position:relative;overflow:hidden}
  .hdr-label{font-size:11px;font-weight:700;letter-spacing:2px;
             text-transform:uppercase;color:rgba(255,255,255,0.65);margin-bottom:7px}
  .plant-name{font-size:34px;font-weight:900;margin-bottom:13px}
  .badges{display:flex;gap:9px;flex-wrap:wrap}
  .badge{padding:4px 13px;border-radius:20px;font-size:12px;font-weight:700;
         border:1px solid rgba(255,255,255,0.3)}
  .b-conf{background:rgba(255,255,255,0.15)}
  .b-status{background:${statusBg};color:${statusColor};border-color:${statusColor}}
  .hdr-date{position:absolute;top:26px;right:30px;text-align:right;
            font-size:11px;color:rgba(255,255,255,0.6);line-height:1.7}
  .body{padding:26px 34px}
  .sec{margin-bottom:24px}
  .sec-title{font-size:12px;font-weight:800;color:#374151;text-transform:uppercase;
             letter-spacing:1.2px;display:flex;align-items:center;gap:7px;
             padding-bottom:9px;border-bottom:2px solid #f3f4f6;margin-bottom:13px}
  .diag{background:#f0fdf4;border-left:4px solid #059669;padding:14px 18px;
        border-radius:0 10px 10px 0;font-size:15px;line-height:1.7}
  table{width:100%;border-collapse:collapse;border:1px solid #f3f4f6;
        border-radius:10px;overflow:hidden}
  thead th{background:#f9fafb;padding:9px 14px;font-size:11px;font-weight:700;
           color:#6b7280;text-transform:uppercase;text-align:left}
  .footer{background:#064e3b;color:rgba(255,255,255,0.65);
          padding:18px 34px;text-align:center;font-size:12px}
  .footer-tamil{font-size:13px;color:rgba(255,255,255,0.88);
                margin-bottom:4px;font-weight:600}
</style></head><body>
<div class="no-print">
  <button class="save-btn" onclick="window.print()">⬇ Save as PDF</button>
  <p class="hint">Choose "Save as PDF" in the print dialog</p>
</div>
<div class="page">
  <div class="hdr">
    <div class="hdr-date">
      Generated<br>${new Date().toLocaleDateString()}<br>${new Date().toLocaleTimeString()}
    </div>
    <div class="hdr-label">🌿 UZHAVAN AI — AI Crop Disease Expert</div>
    <div style="display:flex;flex-direction:column;gap:4px;margin-bottom:13px">
      <div style="font-size:11px;font-weight:700;letter-spacing:1px;color:rgba(255,255,255,0.7)">PLANT</div>
      <div class="plant-name" style="margin-bottom:8px">${result.plantName}</div>
      <div style="font-size:11px;font-weight:700;letter-spacing:1px;color:rgba(255,255,255,0.7)">DISEASE</div>
      <div style="font-size:24px;font-weight:700;color:white">${result.diseaseName}</div>
    </div>
    <div class="badges">
      <span class="badge b-conf">${Number(result.confidence).toFixed(1)}% Confidence</span>
      <span class="badge b-status">${statusLabel}</span>
    </div>
  </div>
  <div class="body">
    ${imgHTML}
    <div class="sec">
      <div class="sec-title"><span>🩺</span> Doctor's Diagnosis</div>
      <div class="diag">${result.diagnosis}</div>
    </div>
    ${result.issues ? `<div class="sec">
      <div class="sec-title"><span>🔍</span> Health Check Results</div>
      <table><thead><tr><th>Category</th><th>Status</th></tr></thead>
      <tbody>${issueRows}</tbody></table>
    </div>` : ''}
    ${result.treatmentPlan?.length ? `<div class="sec">
      <div class="sec-title"><span>💊</span> Treatment Plan</div>
      <div style="background:#f0fdf4;border-radius:11px;padding:18px">
        ${treatmentHTML}
      </div>
    </div>` : ''}
    ${result.preventionTips?.length ? `<div class="sec">
      <div class="sec-title"><span>🛡</span> Prevention &amp; Care Tips</div>
      <div style="background:#f9fafb;border-radius:11px;padding:14px">
        ${tipsHTML}
      </div>
    </div>` : ''}
    ${result.expertResources?.length ? `<div class="sec">
      <div class="sec-title"><span>📚</span> Expert Resources</div>
      ${resourcesHTML}
    </div>` : ''}
  </div>
  <div class="footer">
    <div class="footer-tamil">
      உழுதுண்டு வாழ்வாரே வாழ்வார் — Thiruvalluvar (Kural 1033)
    </div>
    © ${new Date().getFullYear()} UZHAVAN AI &nbsp;|&nbsp; AI advice is a guide only
  </div>
</div>
</body></html>`;
}

export function buildReportTXT(result: PlantAnalysisResult): string {
  const isHealthy = !result.issues?.diseases?.detected;
  const line = '─'.repeat(54);
  let t = `UZHAVAN AI — Crop Disease Report\nGenerated : ${new Date().toLocaleString()}\n${line}\n\n`;
  t += `PLANT     : ${result.plantName}\n`;
  t += `DISEASE   : ${result.diseaseName}\n`;
  t += `CONFIDENCE: ${Number(result.confidence).toFixed(1)}%\n`;
  t += `STATUS    : ${isHealthy ? '✓ Healthy' : (result.diagnosis?.split('.')[0] || 'Disease Detected')}\n\n`;
  t += `DIAGNOSIS\n${line}\n${result.diagnosis}\n\n`;
  if (result.issues) {
    t += `HEALTH CHECKS\n${line}\n`;
    Object.entries(result.issues).forEach(([key, val]) => {
      const issue = val as any;
      const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()).padEnd(22);
      t += `${label}${issue.detected ? '⚠  ' + issue.details : '✓  ' + issue.details}\n`;
    });
    t += '\n';
  }
  if (result.treatmentPlan?.length) {
    t += `TREATMENT PLAN\n${line}\n`;
    result.treatmentPlan.forEach((s, i) => { t += `${i + 1}. ${s.title}\n   ${s.instruction}\n`; });
    t += '\n';
  }
  if (result.preventionTips?.length) {
    t += `PREVENTION TIPS\n${line}\n`;
    result.preventionTips.forEach((tip, i) => {
      const text = typeof tip === 'string' ? tip : `${(tip as any).title || ''}: ${(tip as any).instruction || ''}`;
      t += `${i + 1}. ${text}\n`;
    });
    t += '\n';
  }
  if (result.expertResources?.length) {
    t += `EXPERT RESOURCES\n${line}\n`;
    result.expertResources.forEach(r => { t += `• ${r.title}\n  ${r.url}\n`; });
  }
  t += `\n${line}\n© ${new Date().getFullYear()} UZHAVAN AI — உழவன் AI\n`;
  return t;
}

export function downloadAsPDF(result: PlantAnalysisResult, imageUrl?: string | null) {
  const win = window.open('', '_blank');
  if (win) {
    win.document.write(buildReportHTML(result, imageUrl));
    win.document.close();
  }
}

export function downloadAsTXT(result: PlantAnalysisResult) {
  const filename = `UZHAVAN_${result.plantName.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.txt`;
  const blob = new Blob([buildReportTXT(result)], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Download Modal (exported for HistoryView) ──────────────────────────────

export const DownloadModal: React.FC<{
  result: PlantAnalysisResult;
  imageUrl?: string | null;
  onClose: () => void;
}> = ({ result, imageUrl, onClose }) => {
  const [busy, setBusy] = useState<'pdf' | 'txt' | null>(null);

  const go = (type: 'pdf' | 'txt') => {
    setBusy(type);
    setTimeout(() => {
      if (type === 'pdf') downloadAsPDF(result, imageUrl);
      else downloadAsTXT(result);
      setBusy(null);
      onClose();
    }, 280);
  };

  return (
    <div
      className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center
                 p-4 bg-black/50 backdrop-blur-sm animate-fade-in"
    >
      <div className="absolute inset-0" onClick={onClose} />

      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-sm
                      overflow-hidden animate-scale-up">

        <div className="bg-gradient-to-br from-emerald-600 to-emerald-800
                        px-6 pt-6 pb-8 text-white">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-white/60 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-white/20 p-2.5 rounded-xl backdrop-blur-sm">
              <Download size={20} />
            </div>
            <h3 className="text-lg font-bold">Download Report</h3>
          </div>
          <p className="text-emerald-100 text-sm">
            {result.plantName}
            <span className="ml-2 opacity-70">
              · {Number(result.confidence).toFixed(1)}% confidence
            </span>
          </p>
        </div>

        <div className="relative -mt-4 mx-4 bg-white rounded-2xl shadow-lg
                        border border-gray-100 overflow-hidden">

          <button
            onClick={() => go('pdf')}
            disabled={busy !== null}
            className="w-full flex items-center gap-4 px-5 py-4 hover:bg-emerald-50
                       transition-colors group border-b border-gray-100 disabled:opacity-50"
          >
            <div className="bg-red-50 text-red-500 p-2.5 rounded-xl
                            group-hover:scale-110 transition-transform shrink-0">
              <FileDown size={22} />
            </div>
            <div className="flex-1 text-left">
              <p className="font-bold text-gray-800 text-sm">Save as PDF</p>
              <p className="text-xs text-gray-400 mt-0.5">Beautifully designed report — print ready</p>
            </div>
            {busy === 'pdf'
              ? <div className="w-4 h-4 border-2 border-emerald-400 border-t-transparent
                               rounded-full animate-spin shrink-0" />
              : <span className="text-gray-300 group-hover:text-emerald-500 font-bold">›</span>
            }
          </button>

          <button
            onClick={() => go('txt')}
            disabled={busy !== null}
            className="w-full flex items-center gap-4 px-5 py-4 hover:bg-blue-50
                       transition-colors group disabled:opacity-50"
          >
            <div className="bg-blue-50 text-blue-500 p-2.5 rounded-xl
                            group-hover:scale-110 transition-transform shrink-0">
              <FileText size={22} />
            </div>
            <div className="flex-1 text-left">
              <p className="font-bold text-gray-800 text-sm">Download Text (.txt)</p>
              <p className="text-xs text-gray-400 mt-0.5">Plain text — opens in any app instantly</p>
            </div>
            {busy === 'txt'
              ? <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent
                               rounded-full animate-spin shrink-0" />
              : <span className="text-gray-300 group-hover:text-blue-400 font-bold">›</span>
            }
          </button>
        </div>

        <p className="text-center text-xs text-gray-400 py-4">
          Includes diagnosis, health checks, treatment &amp; tips
        </p>
      </div>
    </div>
  );
};

// ── Health Indicator ──────────────────────────────────────────────────────

const HealthIndicator: React.FC<{ label: string; issue: IssueCheck; icon: React.ReactNode }> = ({ label, issue, icon }) => {
  return (
    <div className={`flex items-start gap-3 p-4 rounded-xl border ${issue.detected ? 'bg-red-50 border-red-100' : 'bg-emerald-50 border-emerald-100'} transition-all`}>
      <div className={`mt-0.5 ${issue.detected ? 'text-red-500' : 'text-emerald-500'}`}>
        {issue.detected ? <AlertTriangle size={20} /> : icon}
      </div>
      <div>
        <h4 className={`font-semibold text-sm uppercase tracking-wide mb-1 ${issue.detected ? 'text-red-800' : 'text-emerald-800'}`}>
          {label}
        </h4>
        <p className={`text-sm ${issue.detected ? 'text-red-700' : 'text-emerald-700'}`}>
          {issue.details}
        </p>
      </div>
    </div>
  );
};

const SinglePlantResult: React.FC<{ result: PlantAnalysisResult, index: number, image?: string | null }> = ({ result, index, image }) => {
  const [showShare, setShowShare] = useState(false);
  const [showDownload, setShowDownload] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voicesReady, setVoicesReady] = useState(false);
  const voicesRef = useRef<SpeechSynthesisVoice[]>([]);

  // Preload voices — Chrome loads them asynchronously
  useEffect(() => {
    const loadVoices = () => {
      const v = window.speechSynthesis.getVoices();
      if (v.length > 0) {
        voicesRef.current = v;
        setVoicesReady(true);
      }
    };
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
    return () => {
      window.speechSynthesis.onvoiceschanged = null;
      window.speechSynthesis.cancel();
    };
  }, []);

  // Calculate overall health score visually based on number of issues
  const issues = result.issues ? (Object.values(result.issues) as IssueCheck[]) : [];
  const detectedIssuesCount = issues.filter(i => i.detected).length;
  const isHealthy = detectedIssuesCount === 0;

  // Share logic
  const shareText = `I just analyzed my ${result.plantName} with UZHAVAN AI! 🌾\n\nDiagnosis: ${result.diagnosis}\n\nGet expert crop advice: ${window.location.origin}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(shareText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Build speech text from the full result
  const buildSpeechText = (): string => {
    let text = `Plant identified: ${result.plantName}. `;
    text += `Confidence: ${result.confidence} percent. `;
    text += `Diagnosis: ${result.diagnosis}. `;

    if (result.issues) {
      const detected = Object.entries(result.issues)
        .filter(([, check]) => (check as IssueCheck).detected)
        .map(([key, check]) => `${key}: ${(check as IssueCheck).details}`);
      if (detected.length > 0) {
        text += `Issues found: ${detected.join('. ')}. `;
      } else {
        text += 'No issues detected. The plant looks healthy. ';
      }
    }

    if (result.treatmentPlan && result.treatmentPlan.length > 0) {
      text += 'Treatment plan: ';
      result.treatmentPlan.forEach((step, i) => {
        text += `Step ${i + 1}: ${step.title}. ${step.instruction}. `;
      });
    }

    if (result.preventionTips && result.preventionTips.length > 0) {
      const tipsText = result.preventionTips.map(tip =>
        typeof tip === 'string' ? tip : `${(tip as any).title || ''}: ${(tip as any).instruction || ''}`
      ).join('. ');
      text += 'Prevention tips: ' + tipsText + '.';
    }

    return text;
  };

  // TTS — Text-to-Speech
  const handleSpeak = () => {
    // If already speaking, stop
    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }

    // Chrome bug workaround: cancel any stale speech first
    window.speechSynthesis.cancel();

    const speechText = buildSpeechText();
    const utterance = new SpeechSynthesisUtterance(speechText);
    utterance.rate = 0.95;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;
    utterance.lang = 'en-US';

    // Pick best available voice
    const voices = voicesRef.current.length > 0 ? voicesRef.current : window.speechSynthesis.getVoices();
    const preferred = voices.find(v => v.name.includes('Google US English'))
      || voices.find(v => v.name.includes('Google') && v.lang.startsWith('en'))
      || voices.find(v => v.lang.startsWith('en-') && !v.localService)
      || voices.find(v => v.lang.startsWith('en'));
    if (preferred) {
      utterance.voice = preferred;
    }

    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = (e) => {
      console.error('TTS Error:', e);
      setIsSpeaking(false);
    };

    setIsSpeaking(true);
    window.speechSynthesis.speak(utterance);

    // Chrome bug: speechSynthesis pauses after ~15s. This keeps it alive.
    const keepAlive = setInterval(() => {
      if (!window.speechSynthesis.speaking) {
        clearInterval(keepAlive);
        return;
      }
      window.speechSynthesis.pause();
      window.speechSynthesis.resume();
    }, 10000);

    utterance.onend = () => {
      clearInterval(keepAlive);
      setIsSpeaking(false);
    };
    utterance.onerror = () => {
      clearInterval(keepAlive);
      setIsSpeaking(false);
    };
  };

  return (
    <div className="bg-white rounded-3xl shadow-xl overflow-hidden border border-emerald-50 mb-12 last:mb-0 relative">
      <div className={`p-6 sm:p-10 text-white relative overflow-hidden ${!image ? 'bg-emerald-600' : 'bg-gray-900'}`}>

        {image && (
          <>
            <img
              src={image}
              alt={result.plantName}
              className="absolute inset-0 w-full h-full object-cover opacity-60"
              onError={(e) => {
                // Hide image gracefully if file was deleted from disk or URL is broken
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-gray-900/90 via-gray-900/40 to-transparent"></div>
          </>
        )}

        {!image && (
          <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
            <Leaf size={120} />
          </div>
        )}

        {/* Share & TTS Buttons */}
        <div className="absolute top-6 right-6 z-20 flex gap-2">
          <button
            onClick={handleSpeak}
            className={`p-2 rounded-full backdrop-blur-sm transition-all text-white ${isSpeaking
              ? 'bg-amber-500/80 hover:bg-amber-500 animate-pulse'
              : 'bg-white/20 hover:bg-white/30'
              }`}
            title={isSpeaking ? 'Stop Reading' : 'Listen to Diagnosis'}
          >
            {isSpeaking ? <VolumeX size={20} /> : <Volume2 size={20} />}
          </button>
          <button
            onClick={() => setShowShare(true)}
            className="bg-white/20 hover:bg-white/30 p-2 rounded-full backdrop-blur-sm transition-colors text-white"
            title="Share Report"
          >
            <Share2 size={20} />
          </button>
          <button
            onClick={() => setShowDownload(true)}
            className="bg-white/20 hover:bg-white/30 p-2 rounded-full backdrop-blur-sm transition-colors text-white"
            title="Download Report"
          >
            <Download size={20} />
          </button>
        </div>

        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-2 text-emerald-100">
            <Sprout size={18} />
            <span className="uppercase tracking-wider text-xs font-bold">Plant Analysis Report</span>
          </div>

          <div className="space-y-1 mb-4">
            <h1 className="text-2xl sm:text-3xl font-black pr-12 text-shadow-sm flex items-baseline gap-2">
              <span className="text-sm uppercase tracking-[0.2em] font-bold text-emerald-300/80">plant</span>
              <span className="uppercase">{result.plantName}</span>
            </h1>
            <h2 className="text-xl sm:text-2xl font-bold pr-12 text-shadow-sm flex items-baseline gap-2">
              <span className="text-xs uppercase tracking-[0.2em] font-bold text-emerald-300/80">disease</span>
              <span className="text-emerald-50">{result.diseaseName}</span>
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-emerald-50 text-sm">
            <span className="bg-emerald-500/50 px-3 py-1 rounded-full border border-emerald-400/30 backdrop-blur-sm">
              {result.confidence}% Confidence
            </span>
            {result.alternatives && result.alternatives.length > 0 && (
              <span className="drop-shadow-md">Could also be: {result.alternatives.slice(0, 2).join(", ")}</span>
            )}
          </div>
        </div>
      </div>

      {/* Diagnosis Summary */}
      <div className="p-6 sm:p-10">
        <div className="flex items-start gap-4 mb-6">
          <div className={`p-3 rounded-full shrink-0 ${isHealthy ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}`}>
            <Stethoscope size={24} />
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-bold text-gray-800 mb-2">Doctor's Diagnosis</h2>
            <p className="text-gray-600 leading-relaxed text-lg">{result.diagnosis}</p>
          </div>
        </div>

        {/* Big Listen Button */}
        <button
          onClick={handleSpeak}
          className={`w-full flex items-center justify-center gap-3 py-3.5 px-6 rounded-2xl font-semibold text-base transition-all duration-300 mb-6 ${isSpeaking
            ? 'bg-amber-500 text-white shadow-lg shadow-amber-200 animate-pulse'
            : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-2 border-emerald-200 hover:border-emerald-300 hover:shadow-md'
            }`}
        >
          {isSpeaking ? (
            <>
              <VolumeX size={22} />
              <span>Stop Reading</span>
              <span className="ml-2 flex gap-1">
                <span className="w-1.5 h-4 bg-white/80 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                <span className="w-1.5 h-5 bg-white/80 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                <span className="w-1.5 h-3 bg-white/80 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
              </span>
            </>
          ) : (
            <>
              <Volume2 size={22} />
              <span>🔊 Listen to Full Diagnosis</span>
            </>
          )}
        </button>

        {/* Health Check Grid — all 8 fields shown individually, matches the PDF report */}
        {result.issues && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
            <HealthIndicator label="Diseases" issue={result.issues.diseases} icon={<Activity size={20} />} />
            <HealthIndicator label="Pests" issue={result.issues.pests} icon={<Bug size={20} />} />
            <HealthIndicator label="Overwatering" issue={result.issues.overwatering} icon={<Droplets size={20} />} />
            <HealthIndicator label="Underwatering" issue={result.issues.underwatering} icon={<Droplets size={20} />} />
            <HealthIndicator label="Sunlight" issue={result.issues.sunlight} icon={<Sun size={20} />} />
            <HealthIndicator label="Nutrients" issue={result.issues.nutrientDeficiency} icon={<HeartPulse size={20} />} />
            <HealthIndicator label="Soil" issue={result.issues.soil} icon={<Sprout size={20} />} />
            <HealthIndicator label="General Stress" issue={result.issues.generalStress} icon={<ThermometerSun size={20} />} />
          </div>
        )}

        {/* Treatment Plan */}
        {!isHealthy && result.treatmentPlan && (
          <div className="bg-emerald-50/50 rounded-3xl p-6 sm:p-8 mb-8 border border-emerald-100">
            <div className="flex items-center gap-3 mb-6">
              <div className="bg-blue-100 p-2 rounded-lg text-blue-600">
                <ShieldCheck size={24} />
              </div>
              <h2 className="text-2xl font-bold text-gray-800">Treatment Plan</h2>
            </div>

            <div className="space-y-6 relative before:absolute before:left-4 before:top-4 before:bottom-4 before:w-0.5 before:bg-emerald-100">
              {result.treatmentPlan.map((step, idx) => (
                <div key={idx} className="relative pl-12">
                  <div className="absolute left-0 top-0 w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-sm shadow-md z-10">
                    {idx + 1}
                  </div>
                  <h3 className="text-lg font-bold text-gray-800 mb-1">{step.title}</h3>
                  <p className="text-gray-600">{step.instruction}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Prevention Tips */}
        {result.preventionTips && (
          <div className="mb-8">
            <h2 className="text-xl font-bold text-emerald-900 mb-6 flex items-center gap-2">
              <CheckCircle size={20} className="text-emerald-600" />
              Prevention & Care Tips
            </h2>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {result.preventionTips.map((tip: any, idx) => (
                <li key={idx} className="flex items-start gap-3 bg-white p-4 rounded-xl shadow-sm border border-emerald-100/50">
                  <span className="block w-2 h-2 mt-2 rounded-full bg-emerald-400 shrink-0" />
                  <span className="text-emerald-800">
                    {typeof tip === 'string' ? tip : (
                      <>
                        {tip.title && <strong className="mr-1">{tip.title}:</strong>}
                        {tip.instruction}
                      </>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Expert Resources Section */}
        {result.expertResources && result.expertResources.length > 0 && (
          <div className="bg-emerald-900 rounded-3xl p-6 sm:p-8 text-emerald-50">
            <div className="flex items-center gap-3 mb-6">
              <BookOpen size={24} className="text-emerald-300" />
              <h2 className="text-xl font-bold">Expert Reading & Resources</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {result.expertResources.map((res, idx) => (
                <a
                  key={idx}
                  href={res.url && res.url.startsWith('http') ? res.url : `https://www.google.com/search?q=${encodeURIComponent(res.title + ' ' + result.plantName)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-white/10 hover:bg-white/20 p-5 rounded-xl transition-all border border-emerald-500/30 flex flex-col h-full group"
                >
                  <div className="flex justify-between items-start gap-2 mb-3">
                    <h3 className="font-bold text-lg text-white group-hover:text-emerald-200 transition-colors">
                      {res.title}
                    </h3>
                    <ExternalLink size={16} className="shrink-0 opacity-50 group-hover:opacity-100 transition-opacity mt-1" />
                  </div>
                  <p className="text-sm text-emerald-200/80 leading-relaxed flex-grow">
                    {res.description}
                  </p>
                  <div className="mt-4 text-xs font-semibold uppercase tracking-wider text-emerald-400/80">
                    Read Article
                  </div>
                </a>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Share Modal */}
      {showShare && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-scale-up relative p-6">
            <button
              onClick={() => setShowShare(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors p-2"
            >
              <X size={20} />
            </button>

            <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
              <Share2 size={24} className="text-emerald-600" />
              Share Report
            </h3>

            <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 mb-6">
              <p className="text-gray-600 text-sm italic leading-relaxed">
                "{shareText}"
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3">
              <button
                onClick={handleCopy}
                className="flex items-center justify-center gap-2 w-full p-3 rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors font-medium text-gray-700"
              >
                {copied ? <CheckCircle size={18} className="text-emerald-500" /> : <Copy size={18} />}
                {copied ? "Copied!" : "Copy to Clipboard"}
              </button>

              <a
                href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full p-3 rounded-xl bg-black text-white hover:bg-gray-800 transition-colors font-medium"
              >
                <Twitter size={18} />
                Share on X
              </a>

              <a
                href={`https://wa.me/?text=${encodeURIComponent(shareText)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full p-3 rounded-xl bg-[#25D366] text-white hover:bg-[#20bd5a] transition-colors font-medium"
              >
                <MessageCircle size={18} />
                Share on WhatsApp
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Download Modal */}
      {showDownload && (
        <DownloadModal
          result={result}
          imageUrl={image}
          onClose={() => setShowDownload(false)}
        />
      )}
    </div>
  );
};

export const AnalysisResult: React.FC<AnalysisResultProps> = ({ results, onReset, image }) => {
  // Guard against null/undefined/empty result
  if (!results || results.length === 0) return null;

  // Filter out non-plant detections unless everything is marked as not a plant
  const validPlants = results.filter(r => r.isPlant);
  const displayPlants = validPlants.length > 0 ? validPlants : results;

  // If no valid plants found and result says so
  if (displayPlants.length === 1 && !displayPlants[0].isPlant) {
    return (
      <div className="max-w-md mx-auto text-center p-8 bg-white rounded-3xl shadow-xl border border-red-100 mt-10">
        <div className="bg-red-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 text-red-500">
          <AlertTriangle size={40} />
        </div>
        <h2 className="text-2xl font-bold text-gray-800 mb-4">Not a Plant?</h2>
        <p className="text-gray-600 mb-8 leading-relaxed">
          I'm having trouble identifying a plant in this photo. I work best with clear photos of leaves, flowers, or whole plants.
        </p>
        <button
          onClick={onReset}
          className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-3 px-8 rounded-full transition-colors shadow-lg shadow-emerald-200"
        >
          Try Another Photo
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto animate-fade-in pb-20 space-y-8">

      {displayPlants.map((plant, index) => (
        <SinglePlantResult key={index} result={plant} index={index} image={image} />
      ))}

      {/* Floating Action Button for New Scan - Moved to left to avoid Chat FAB */}
      <div className="fixed bottom-6 left-6 z-50">
        <button
          onClick={onReset}
          className="bg-gray-900 hover:bg-black text-white px-6 py-4 rounded-full shadow-2xl flex items-center gap-2 font-semibold transition-transform hover:scale-105"
        >
          <Sprout size={20} />
          Scan Another Plant
        </button>
      </div>

    </div>
  );
};