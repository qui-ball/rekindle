// Simple loading screen component (now used only for critical app failures)
'use client';

import React from 'react';
import { Headline } from './ui/Headline';
import { Body } from './ui/Body';
import { Button } from './ui/Button';
import { Card } from './ui/Card';

interface AppLoadingScreenProps {
  progress: number;
  message: string;
  status: 'loading' | 'ready' | 'fallback';
  error?: string;
}

export const AppLoadingScreen: React.FC<AppLoadingScreenProps> = ({
  message,
  error
}) => {
  return (
    <div className="fixed inset-0 bg-cozy-background flex items-center justify-center z-50">
      <div className="max-w-md w-full mx-4">
        <div className="text-center mb-8">
          <Headline level={1} className="text-cozy-heading mb-2">Rekindle</Headline>
          <Body className="text-cozy-textSecondary">Bring Your Memories to Life</Body>
        </div>

        <Card className="p-6 text-center shadow-cozy-card-hover">
          <div className="text-cozySemantic-error mb-4">
            <p className="mb-2 font-serif">⚠️ App Loading Issue</p>
            <Body className="text-sm !mb-0">{message}</Body>
            {error && (
              <p className="text-cozy-caption text-cozy-textMuted mt-2 font-serif">{error}</p>
            )}
          </div>
          <Button onClick={() => window.location.reload()} variant="primary">
            Reload App
          </Button>
        </Card>
      </div>
    </div>
  );
};