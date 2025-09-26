'use client';

import Link from 'next/link';
import { useState } from 'react';

export const DevMenu: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);

  // Only show in development
  if (process.env.NODE_ENV === 'production') {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {/* Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-12 h-12 bg-gray-800 text-white rounded-full shadow-lg hover:bg-gray-700 transition-colors flex items-center justify-center"
        title="Development Menu"
      >
        🛠️
      </button>

      {/* Menu */}
      {isOpen && (
        <div className="absolute bottom-16 right-0 bg-white rounded-lg shadow-xl border p-4 min-w-64">
          <h3 className="font-semibold text-gray-800 mb-3">Development Tests</h3>
          <div className="space-y-2">
            <Link 
              href="/native-camera-test" 
              className="block px-3 py-2 bg-green-100 text-green-800 rounded hover:bg-green-200 transition-colors"
              onClick={() => setIsOpen(false)}
            >
              🔬 Native Camera Test
            </Link>
            <Link 
              href="/camera-test" 
              className="block px-3 py-2 bg-blue-100 text-blue-800 rounded hover:bg-blue-200 transition-colors"
              onClick={() => setIsOpen(false)}
            >
              📷 Camera Test (Old)
            </Link>
            <Link 
              href="/test-cropper" 
              className="block px-3 py-2 bg-purple-100 text-purple-800 rounded hover:bg-purple-200 transition-colors"
              onClick={() => setIsOpen(false)}
            >
              ✂️ Cropper Test
            </Link>
            <Link 
              href="/" 
              className="block px-3 py-2 bg-gray-100 text-gray-800 rounded hover:bg-gray-200 transition-colors"
              onClick={() => setIsOpen(false)}
            >
              🏠 Home
            </Link>
          </div>
        </div>
      )}
    </div>
  );
};

export default DevMenu;