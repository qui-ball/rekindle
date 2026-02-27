import { createBrowserClient, createServerClient } from '@supabase/ssr';

const HOST_DOCKER_REGEX = /host\.docker\.internal/gi;

type CookieAdapter = {
  get: (name: string) => string | undefined;
  set: (name: string, value: string, options?: Record<string, unknown>) => void;
  remove: (name: string, options?: Record<string, unknown>) => void;
};

let cachedBrowserClient: ReturnType<typeof createBrowserClient> | null = null;
let cachedBrowserUrl: string | null = null;

function requireSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      'Missing Supabase environment variables. Please ensure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are set.'
    );
  }

  return { url, anonKey };
}

export function normalizeSupabaseUrl(url: string, hostname?: string): string {
  const resolvedHost =
    hostname ?? (typeof window !== 'undefined' ? window.location.hostname : undefined);

  if (resolvedHost && /^\d+\.\d+\.\d+\.\d+$/.test(resolvedHost)) {
    return url.replace(HOST_DOCKER_REGEX, resolvedHost);
  }

  if (resolvedHost === '127.0.0.1') {
    return url.replace(HOST_DOCKER_REGEX, '127.0.0.1');
  }

  return url.replace(HOST_DOCKER_REGEX, 'localhost');
}

export function normalizeSupabaseUrlForServer(url: string): string {
  return url.replace(HOST_DOCKER_REGEX, '127.0.0.1');
}

export function getSupabaseClient() {
  if (typeof window === 'undefined') {
    throw new Error('getSupabaseClient must be called in a browser environment.');
  }

  const { url, anonKey } = requireSupabaseEnv();
  const normalizedUrl = normalizeSupabaseUrl(url);

  if (!cachedBrowserClient || cachedBrowserUrl !== normalizedUrl) {
    cachedBrowserClient = createBrowserClient(normalizedUrl, anonKey);
    cachedBrowserUrl = normalizedUrl;
  }

  return cachedBrowserClient;
}

export function createSupabaseServerClient(cookieAdapter: CookieAdapter) {
  const { url, anonKey } = requireSupabaseEnv();
  const serverUrl = normalizeSupabaseUrlForServer(url);

  return createServerClient(serverUrl, anonKey, {
    cookies: cookieAdapter,
  });
}

