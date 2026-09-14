import React, { useState } from 'react';
import { X, Volume2, VolumeX, Bell, Sliders, ShieldCheck } from 'lucide-react';
import { NotificationService, NotificationSettings } from '../../services/notificationService';
import { showToast } from '../Toast';

interface NotificationPreferencesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function NotificationPreferencesModal({ isOpen, onClose }: NotificationPreferencesModalProps) {
  const [settings, setSettings] = useState<NotificationSettings>(NotificationService.getSettings());

  if (!isOpen) return null;

  const handleSave = () => {
    NotificationService.saveSettings(settings);
    showToast('Notification preferences saved!', 'success');
    onClose();
  };

  const handleTestSound = () => {
    NotificationService.playSound('high');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
      <div className="w-full max-w-md bg-white rounded-3xl p-6 space-y-5 shadow-2xl border border-[#EAE4DC] animate-fade-in">
        <div className="flex items-center justify-between border-b border-[#EAE4DC] pb-3">
          <div className="flex items-center gap-2.5">
            <Sliders className="w-5 h-5 text-[#C6A15B]" />
            <h3 className="font-extrabold text-[#4A1726] text-base">Notification &amp; Audio Preferences</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-[#888888] hover:text-[#4A1726]">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4 text-xs">
          {/* Sound Enable */}
          <div className="flex items-center justify-between p-3 rounded-2xl bg-[#F8F5F1] border border-[#EAE4DC]">
            <div>
              <span className="font-bold text-[#4A1726] block">Notification Audio Alerts</span>
              <span className="text-[11px] text-[#777777]">Play audio chime when new broadcasts or alerts arrive</span>
            </div>
            <input
              type="checkbox"
              checked={settings.soundEnabled}
              onChange={(e) => setSettings({ ...settings, soundEnabled: e.target.checked })}
              className="w-4 h-4 rounded accent-[#4A1726]"
            />
          </div>

          {/* Volume Slider */}
          {settings.soundEnabled && (
            <div className="p-3 rounded-2xl bg-[#F8F5F1] border border-[#EAE4DC] space-y-2">
              <div className="flex justify-between font-bold text-[#4A1726]">
                <span>Chime Volume</span>
                <span>{Math.round(settings.volume * 100)}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={settings.volume}
                onChange={(e) => setSettings({ ...settings, volume: parseFloat(e.target.value) })}
                className="w-full accent-[#4A1726]"
              />
              <button
                type="button"
                onClick={handleTestSound}
                className="text-[10.5px] font-extrabold text-[#C6A15B] hover:underline flex items-center gap-1 pt-1"
              >
                <Volume2 className="w-3.5 h-3.5" />
                <span>Test Audio Chime</span>
              </button>
            </div>
          )}

          {/* Toast Enable */}
          <div className="flex items-center justify-between p-3 rounded-2xl bg-[#F8F5F1] border border-[#EAE4DC]">
            <div>
              <span className="font-bold text-[#4A1726] block">Desktop Toast Popups</span>
              <span className="text-[11px] text-[#777777]">Show bottom-right toast notification banners</span>
            </div>
            <input
              type="checkbox"
              checked={settings.desktopToastEnabled}
              onChange={(e) => setSettings({ ...settings, desktopToastEnabled: e.target.checked })}
              className="w-4 h-4 rounded accent-[#4A1726]"
            />
          </div>

          {/* Toast Duration */}
          <div className="p-3 rounded-2xl bg-[#F8F5F1] border border-[#EAE4DC] space-y-1">
            <label className="font-bold text-[#4A1726] block">Toast Display Duration</label>
            <select
              value={settings.toastDuration}
              onChange={(e) => setSettings({ ...settings, toastDuration: parseInt(e.target.value) })}
              className="select-modern font-bold"
            >
              <option value={3}>3 Seconds</option>
              <option value={5}>5 Seconds (Default)</option>
              <option value={10}>10 Seconds</option>
            </select>
          </div>

          {/* Preview Toggle */}
          <div className="flex items-center justify-between p-3 rounded-2xl bg-[#F8F5F1] border border-[#EAE4DC]">
            <div>
              <span className="font-bold text-[#4A1726] block">Show Message Preview</span>
              <span className="text-[11px] text-[#777777]">Include text snippet in notification popups</span>
            </div>
            <input
              type="checkbox"
              checked={settings.showPreview}
              onChange={(e) => setSettings({ ...settings, showPreview: e.target.checked })}
              className="w-4 h-4 rounded accent-[#4A1726]"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-3 border-t border-[#EAE4DC]">
          <button onClick={onClose} className="px-4 py-2 rounded-xl border border-[#EAE4DC] font-bold text-xs">
            Cancel
          </button>
          <button onClick={handleSave} className="btn-primary text-xs shadow-md">
            Save Preferences
          </button>
        </div>
      </div>
    </div>
  );
}
