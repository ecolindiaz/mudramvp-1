'use client';

import React from 'react';
import Image from 'next/image';
import { ExternalLink } from 'lucide-react';

interface CompetitorCellProps {
  name: string;
  isOwn?: boolean;
  description?: string;
  favicon?: string;
  url?: string;
}

export const CompetitorCell: React.FC<CompetitorCellProps> = ({
  name,
  isOwn = false,
  description,
  favicon,
  url
}) => {
  const [faviconError, setFaviconError] = React.useState(false);
  
  // Generate favicon URL if not provided
  const faviconUrl = favicon || (url ? `https://www.google.com/s2/favicons?domain=${url}&sz=64` : null);
  
  return (
    <div className="flex items-center gap-2 p-3 hover:bg-gray-50">
      <div className="w-6 h-6 flex items-center justify-center rounded overflow-hidden flex-shrink-0">
        {faviconUrl && !faviconError ? (
          <Image
            src={faviconUrl}
            alt={`${name} logo`}
            width={24}
            height={24}
            className="object-contain"
            onError={() => setFaviconError(true)}
          />
        ) : (
          <div className="w-6 h-6 bg-gray-200 rounded flex items-center justify-center">
            <span className="text-gray-600 font-semibold text-xs">
              {name.charAt(0).toUpperCase()}
            </span>
          </div>
        )}
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-1.5">
          {url && !isOwn ? (
            <a 
              href={url.startsWith('http') ? url : `https://${url}`}
              target="_blank"
              rel="noopener noreferrer"
              className={`text-sm font-medium hover:underline ${isOwn ? 'text-orange-600' : 'text-gray-900 hover:text-blue-600'} flex items-center gap-1`}
              onClick={(e) => e.stopPropagation()}
            >
              {name}
              <ExternalLink className="w-3.5 h-3.5 text-gray-400" />
            </a>
          ) : (
            <h3 className={`text-sm font-medium ${isOwn ? 'text-orange-600' : 'text-gray-900'}`}>
              {name}
            </h3>
          )}
        </div>
        {description && (
          <p className="text-sm text-gray-500">{description}</p>
        )}
      </div>
    </div>
  );
};