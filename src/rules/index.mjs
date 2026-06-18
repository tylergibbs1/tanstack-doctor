import sfInputValidation from './sf-input-validation.mjs';
import sfWeakValidator from './sf-weak-validator.mjs';
import sfMethodSelection from './sf-method-selection.mjs';
import sfPreferServerFn from './sf-prefer-server-fn.mjs';
import apiInputValidation from './api-input-validation.mjs';
import envSecretExposure from './env-secret-exposure.mjs';
import authTokenStorage from './auth-token-storage.mjs';
import authCookieSecurity from './auth-cookie-security.mjs';
import ssrHydrationSafety from './ssr-hydration-safety.mjs';
import ssrStreaming from './ssr-streaming.mjs';
import ssrPrerender from './ssr-prerender.mjs';
import fileSeparation from './file-separation.mjs';

export const rules = [
  sfInputValidation,
  sfWeakValidator,
  apiInputValidation,
  envSecretExposure,
  authTokenStorage,
  authCookieSecurity,
  fileSeparation,
  ssrHydrationSafety,
  sfMethodSelection,
  sfPreferServerFn,
  ssrStreaming,
  ssrPrerender,
];

export const PRIORITY_ORDER = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'];

// Severity rank for --fail-on thresholds (higher = more severe).
export const PRIORITY_RANK = {
  CRITICAL: 4,
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1,
  INFO: 0,
};
