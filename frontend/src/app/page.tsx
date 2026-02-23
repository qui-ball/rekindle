'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { getSupabaseClient } from '@/lib/supabase';
import { Container, Section, Headline, Tagline, Body, Caption, Card, Button } from '@/components/ui';

function LandingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const [isProcessing, setIsProcessing] = useState(false);

  // Handle email confirmation links (both success and error cases)
  useEffect(() => {
    // Redirect HTTP to HTTPS if we're on HTTP but the server is running in HTTPS mode
    // This handles cases where Supabase redirects to HTTP URLs
    if (typeof window !== 'undefined' && window.location.protocol === 'http:') {
      // Check if we're in HTTPS mode by checking if the HTTPS server is available
      // We'll try to redirect to HTTPS
      const httpsUrl = window.location.href.replace('http://', 'https://');
      // Only redirect if we're not already processing a confirmation
      const hasCode = searchParams?.get('code') || 
        (typeof window !== 'undefined' && new URLSearchParams(window.location.hash.substring(1)).get('code'));
      const hasError = searchParams?.get('error') || 
        (typeof window !== 'undefined' && new URLSearchParams(window.location.hash.substring(1)).get('error'));
      
      // If we have a code or error, we need to redirect to HTTPS to process it
      if (hasCode || hasError) {
        window.location.replace(httpsUrl);
        return;
      }
    }

    // Don't process if auth is still loading
    if (authLoading) {
      return;
    }

    // Check both query parameters and hash fragments
    const getParam = (name: string) => {
      return searchParams?.get(name) || 
        (typeof window !== 'undefined' && new URLSearchParams(window.location.hash.substring(1)).get(name));
    };

    const code = getParam('code');
    const error = getParam('error');
    const errorCode = getParam('error_code');
    const errorDescription = getParam('error_description');

    // If we have a code, this is a successful email confirmation
    // Note: Email confirmation links from Supabase automatically create a session
    // We just need to check for the session, not exchange a code (PKCE is for OAuth, not email confirmations)
    if (code) {
      setIsProcessing(true);
      const handleEmailConfirmation = async () => {
        try {
          const supabase = getSupabaseClient();
          
          // Wait a moment for Supabase to process the confirmation and create the session
          // Email confirmations automatically create sessions, so we just need to check for it
          await new Promise(resolve => setTimeout(resolve, 500));
          
          // Check for existing session (Supabase creates it automatically on email confirmation)
          const { data: { session }, error: sessionError } = await supabase.auth.getSession();
          
          if (sessionError) {
            console.error('Error getting session:', sessionError);
          }
          
          if (session?.user) {
            // Email is confirmed and session is created
            console.log('Email confirmed successfully, user:', session.user.id);
            const hasAcceptedTerms = session.user.user_metadata?.accepted_terms === true;
            
            if (!hasAcceptedTerms) {
              router.replace('/auth/accept-terms');
            } else {
              router.replace('/upload');
            }
            return;
          }

          // No session found - try to exchange code for session (fallback for OAuth flows)
          // This might work for some flows, but email confirmations usually create sessions automatically
          try {
            const { error: exchangeError, data } = await supabase.auth.exchangeCodeForSession(code);
            
            if (!exchangeError && data?.user) {
              console.log('Code exchanged successfully, user:', data.user.id);
              const hasAcceptedTerms = data.user.user_metadata?.accepted_terms === true;
              router.replace(hasAcceptedTerms ? '/upload' : '/auth/accept-terms');
              return;
            }
          } catch {
            // exchangeCodeForSession requires PKCE which email confirmations don't use
            // This is expected to fail for email confirmations
            console.log('Code exchange not applicable (email confirmations use automatic session creation)');
          }

          // If we get here, the email might already be confirmed but no session was created
          // Redirect to sign-in with helpful message
          router.replace('/sign-in?info=Your email has been confirmed. Please sign in to continue.');
        } catch (err) {
          console.error('Unexpected error during email confirmation:', err);
          router.replace('/sign-in?info=There was an issue confirming your email. Please try signing in.');
        } finally {
          setIsProcessing(false);
        }
      };

      handleEmailConfirmation();
      return;
    }

    // Handle error cases from email confirmation
    if (error) {
      setIsProcessing(true);
      const handleError = async () => {
        try {
          // Check if user already has a session (email might already be confirmed)
          const supabase = getSupabaseClient();
          const { data: { session } } = await supabase.auth.getSession();
          
          if (session?.user) {
            // User has a session, email is already confirmed
            console.log('Error in confirmation link but user email is already confirmed');
            const hasAcceptedTerms = session.user.user_metadata?.accepted_terms === true;
            router.replace(hasAcceptedTerms ? '/upload' : '/auth/accept-terms');
            return;
          }

          // No session - handle specific error cases
          if (error === 'access_denied' && errorCode === 'otp_expired') {
            router.replace('/sign-in?info=The confirmation link has expired, but your email may already be confirmed. Please try signing in.');
          } else {
            // Generic error - redirect to sign-in with helpful message
            let errorMsg = errorDescription || error;
            try {
              // Try to decode if it's encoded
              errorMsg = decodeURIComponent(errorMsg);
            } catch {
              // If decoding fails, use as-is
            }
            router.replace(`/sign-in?info=There was an issue with the confirmation link: ${errorMsg}. Your email may already be confirmed. Please try signing in.`);
          }
        } catch (err) {
          console.error('Error handling confirmation error:', err);
          router.replace('/sign-in?info=There was an issue with the confirmation link. Please try signing in.');
        } finally {
          setIsProcessing(false);
        }
      };

      handleError();
      return;
    }
  }, [searchParams, user, authLoading, router]);

  // Show loading state while processing email confirmation
  if (isProcessing) {
    return (
      <div className="min-h-screen bg-cozy-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cozy-accent mx-auto mb-4"></div>
          <p className="text-cozy-textSecondary">Confirming your email...</p>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-cozy-background flex items-center justify-center">
      <Section variant="default" className="w-full flex items-center justify-center">
        <Container className="w-full max-w-2xl text-center">
          {/* Hero: logo, tagline, title, subtitle */}
          <div className="mb-12">
            <Headline level={1} className="mb-4 text-cozy-accent">Rekindle</Headline>
            <Tagline className="mb-2 block">Restore Your Memories</Tagline>
            <Body className="text-cozy-hero italic text-cozy-textSecondary">
              Transform old, damaged, or faded family photos into vibrant, restored memories with professional-grade AI.
            </Body>
          </div>

          {/* Value proposition: feature cards */}
          <div className="grid md:grid-cols-3 gap-6 mb-10">
            <Card hover className="p-6">
              <div className="text-3xl mb-2">✨</div>
              <Headline level={3} className="mb-2 text-cozy-heading">AI-Powered Restoration</Headline>
              <Caption>
                Advanced AI technology restores your photos to their original beauty
              </Caption>
            </Card>
            <Card hover className="p-6">
              <div className="text-3xl mb-2">🎨</div>
              <Headline level={3} className="mb-2 text-cozy-heading">Color & Enhance</Headline>
              <Caption>
                Add color to black and white photos and enhance image quality
              </Caption>
            </Card>
            <Card hover className="p-6">
              <div className="text-3xl mb-2">📸</div>
              <Headline level={3} className="mb-2 text-cozy-heading">Easy Upload</Headline>
              <Caption>
                Simple, secure photo upload and processing workflow
              </Caption>
            </Card>
          </div>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
            <Button href="/sign-up" variant="primary" size="large" fullWidth>
              Get Started Free
            </Button>
            <Button href="/sign-in" variant="secondary" size="large" fullWidth>
              Sign In
            </Button>
          </div>

          {/* Footer Note */}
          <Caption>
            Start with 3 free credits • No credit card required
          </Caption>
        </Container>
      </Section>
    </main>
  );
}

export default function LandingPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-cozy-background flex items-center justify-center"><div className="text-cozy-textSecondary">Loading...</div></main>}>
      <LandingContent />
    </Suspense>
  );
}
