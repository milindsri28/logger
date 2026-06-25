'use client';

import { Suspense } from 'react';
import { OAuthTokenHandler } from '@/components/setup/OAuthTokenHandler';

export function OAuthTokenHandlerRoot() {
  return (
    <Suspense fallback={null}>
      <OAuthTokenHandler />
    </Suspense>
  );
}
