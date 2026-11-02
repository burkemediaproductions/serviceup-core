import React from 'react';
import { useSettings } from '../context/SettingsContext';

export default function LoadingPanel({ label = 'Loading…' }) {
  const { settings } = useSettings();
  const image = settings?.loadingImageUrl || '';
  return (
    <div className="su-page">
      <div className="su-card su-loading-panel" role="status">
        {image ? <img className="su-loading-mark" src={image} alt="" /> : (
          <svg className="su-loading-mark su-loading-mark--default" viewBox="0 0 64 64" aria-hidden="true">
            <path className="su-loading-mark-ring" d="M49 18A23 23 0 1 0 54 36" />
            <path className="su-loading-mark-arrow" d="M43 8l14 5-5 14-4-7-8-4z" />
          </svg>
        )}
        <span>{label}</span>
      </div>
    </div>
  );
}
