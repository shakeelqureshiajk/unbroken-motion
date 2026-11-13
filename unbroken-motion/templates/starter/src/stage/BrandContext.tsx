import React, { createContext, useContext } from 'react';
import type { BrandTokens } from '../lib/types.ts';

const BrandContext = createContext<BrandTokens | null>(null);

export const BrandProvider: React.FC<{
  brand: BrandTokens;
  children: React.ReactNode;
}> = ({ brand, children }) => {
  return React.createElement(BrandContext.Provider, { value: brand }, children);
};

export function useBrand(): BrandTokens {
  const ctx = useContext(BrandContext);
  if (!ctx) {
    throw new Error('useBrand() must be used inside a <BrandProvider>.');
  }
  return ctx;
}
