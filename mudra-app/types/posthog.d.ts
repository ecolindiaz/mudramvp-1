// PostHog type declarations
declare module 'posthog-js' {
  export interface PostHogConfig {
    api_host?: string;
    loaded?: (posthog: any) => void;
    capture_pageview?: boolean;
    capture_pageleave?: boolean;
    autocapture?: boolean | Record<string, any>;
    session_recording?: Record<string, any>;
    persistence?: 'localStorage' | 'cookie' | 'memory';
    [key: string]: any;
  }

  export interface PostHog {
    init(apiKey: string, config?: PostHogConfig): void;
    identify(distinctId: string, properties?: Record<string, any>): void;
    capture(eventName: string, properties?: Record<string, any>): void;
    reset(): void;
    debug(enable?: boolean): void;
    register(properties: Record<string, any>): void;
    setPersonProperties(properties: Record<string, any>): void;
    [key: string]: any;
  }

  const posthog: PostHog;
  export default posthog;
}

declare module 'posthog-js/react' {
  import { ReactNode } from 'react';

  export interface PostHogProviderProps {
    client: any;
    children: ReactNode;
  }

  export function PostHogProvider(props: PostHogProviderProps): JSX.Element;
  export const usePostHog: () => any;
  export const useFeatureFlagEnabled: (flag: string) => boolean | undefined;
  export const useFeatureFlagPayload: (flag: string) => any;
  export const useFeatureFlagVariantKey: (flag: string) => string | boolean | undefined;
  export const useActiveFeatureFlags: () => string[];
}

