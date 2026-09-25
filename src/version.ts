/**
 * Single source of truth for the app version.
 *
 * The value is injected at build time from `package.json` (see `vite.config.ts`),
 * so a release only has to bump one file. The fallback keeps unit tests and any
 * tool that imports this module outside Vite working.
 */
declare const __APP_VERSION__: string | undefined;

export const APP_VERSION: string =
  typeof __APP_VERSION__ === 'string' && __APP_VERSION__.length > 0 ? __APP_VERSION__ : '1.0.0';

/** `1.0.0` → `1.0`, used where a short label reads better. */
export const APP_VERSION_SHORT: string = APP_VERSION.split('.').slice(0, 2).join('.');

export const APP_NAME = 'OmniCalc';
export const APP_TAGLINE = 'Free, offline scientific, engineering and graphing calculator';
export const APP_LICENSE = 'MIT';
export const REPO_URL = 'https://github.com/omnica/omnica';
