import React from 'react';
import { Globe, Loader2 } from 'lucide-react';

interface UrlInputSectionProps {
  url: string;
  urlValid: boolean | null;
  loading: boolean;
  analyzing: boolean;
  onUrlChange: (url: string) => void;
  onSubmit: () => void;
}

export function UrlInputSection({
  url,
  urlValid,
  loading,
  analyzing,
  onUrlChange,
  onSubmit
}: UrlInputSectionProps) {
  return (
    <div className="flex items-center justify-center animate-panel-in pb-12">
      <div className="w-full max-w-5xl px-6">
          <div className="relative">
            <Globe className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-black" />
            <input
              type="text"
              className={`w-full pl-12 pr-16 h-14 text-base border-2 rounded-xl focus:outline-none focus:ring-2 transition-all ${
                urlValid === false 
                  ? 'border-red-300 focus:ring-red-500 focus:border-transparent' 
                  : urlValid === true 
                  ? 'border-orange-300 focus:ring-orange-500 focus:border-transparent'
                  : 'border-gray-300 focus:ring-orange-500 focus:border-transparent'
              }`}
              placeholder="Enter your website URL (e.g., example.com)"
              value={url}
              onChange={(e) => onUrlChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !loading && !analyzing && url) {
                  onSubmit();
                }
              }}
              onFocus={(e) => {
                if (!url) {
                  e.target.placeholder = "example.com";
                }
              }}
              onBlur={(e) => {
                e.target.placeholder = "Enter your website URL (e.g., example.com)";
              }}
              disabled={loading || analyzing}
            />
            
            {/* Arrow button inside input */}
            <button
              onClick={onSubmit}
              disabled={loading || analyzing || !url || urlValid === false}
              className="absolute right-2 top-1/2 transform -translate-y-1/2 h-10 w-10 rounded-lg flex items-center justify-center transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50 bg-[#36322F] hover:bg-[#4a4542] disabled:bg-gray-300 disabled:hover:bg-gray-300"
              aria-label="Analyze website"
            >
              {loading ? (
                <Loader2 className="h-5 w-5 animate-spin text-white" />
              ) : (
                <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              )}
            </button>
          </div>
      </div>
    </div>
  );
}