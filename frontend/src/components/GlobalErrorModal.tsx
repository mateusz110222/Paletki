import React from 'react';
import { X, AlertCircle } from 'lucide-react';
import { useTranslation } from '../i18n/LanguageContext.tsx';

interface GlobalErrorModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  onClose: () => void;
}

export const GlobalErrorModal: React.FC<GlobalErrorModalProps> = ({ isOpen, title, message, onClose }) => {
  const { t } = useTranslation();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-brand-bg/80 backdrop-blur-sm" onClick={onClose}></div>
      <div className="relative bg-brand-surface border border-red-500/30 w-full max-w-md rounded-xl overflow-hidden shadow-2xl">
        <div className="bg-red-950/40 p-5 border-b border-red-500/20 flex justify-between items-center">
          <h3 className="text-base font-bold text-red-400 uppercase tracking-wider flex items-center gap-2">
            <AlertCircle size={18} />
            {title}
          </h3>
          <button className="text-brand-text-muted hover:text-red-400" onClick={onClose} title={t('btn_close')} aria-label={t('btn_close')}>
            <X size={18} />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <p className="text-sm text-brand-text">{message}</p>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="py-2.5 px-6 bg-red-600 text-white font-extrabold text-xs uppercase rounded hover:bg-red-700 transition-all"
            >
              {t('global_error_close_button')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
