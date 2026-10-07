'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function GalleryRedirectPage() {
  useEffect(() => {
    const timer = setTimeout(() => {
      window.location.href = '/index.html';
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Redirecting to Legacy Gallery...</h2>
        <p className="text-gray-600 mb-4">If you&apos;re not redirected, <a href="/index.html" className="text-indigo-600 hover:text-indigo-500 underline">click here</a>.</p>
        <Link href="/" className="text-sm text-gray-500 hover:text-gray-700">
          ← Back to Dashboard
        </Link>
      </div>
    </div>
  );
}
