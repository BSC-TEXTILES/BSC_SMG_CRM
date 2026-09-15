import React from 'react';
import DashboardLayout from '../components/layouts/DashboardLayout';
import { QrCode, ExternalLink, Smartphone, Sparkles, Copy, Check } from 'lucide-react';

export default function FeedbackQR() {
  const [copied, setCopied] = React.useState(false);
  const feedbackUrl = `${window.location.origin}/feedback-public`;

  const copyUrl = () => {
    navigator.clipboard.writeText(feedbackUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <DashboardLayout title="Feedback QR Code Portal" subtitle="POS & Checkout Counter Customer Survey QR Display">
      <div className="max-w-xl mx-auto space-y-6 text-center">
        <div className="card-glass p-8 space-y-6">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary text-accent text-xs font-extrabold uppercase tracking-widest">
            <Sparkles className="w-4 h-4" />
            <span>Store Tablet Kiosk Ready</span>
          </div>

          <h2 className="text-2xl font-black text-primary">Scan to Share Your Feedback</h2>
          <p className="text-gray-600 text-sm font-medium max-w-md mx-auto">
            Place this QR code display on POS billing counters for customers to scan using their smartphone camera.
          </p>

          {/* QR Code Container */}
          <div className="p-6 bg-white rounded-3xl shadow-xl border border-gray-200 inline-block mx-auto">
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(feedbackUrl)}`}
              alt="Feedback QR Code"
              className="w-60 h-60 object-contain mx-auto"
            />
            <div className="mt-4 font-black text-xs text-primary uppercase tracking-wider">
              BSC EXCLUSIVE DAVANAGERE
            </div>
          </div>

          {/* URL Controls */}
          <div className="flex items-center gap-2 bg-background p-3 rounded-xl border max-w-md mx-auto">
            <Smartphone className="w-5 h-5 text-gray-400 flex-shrink-0" />
            <input
              type="text"
              readOnly
              value={feedbackUrl}
              className="bg-transparent text-xs font-bold text-gray-700 flex-1 outline-none truncate"
            />
            <button
              onClick={copyUrl}
              className="p-2 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-700 text-xs font-bold transition-all flex items-center gap-1"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>
          </div>

          <div className="pt-4 border-t">
            <a
              href={feedbackUrl}
              target="_blank"
              rel="noreferrer"
              className="btn-gold inline-flex items-center gap-2 text-xs py-2.5 px-6"
            >
              <ExternalLink className="w-4 h-4" />
              <span>Open Live Public Feedback Page</span>
            </a>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
