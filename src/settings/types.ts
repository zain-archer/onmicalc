import type { AngleMode } from '@/core/numbers/angle';

export type ThemeMode = 'light' | 'dark' | 'system';
export type NumberFormat = 'auto' | 'scientific' | 'engineering';
export type FractionMode = 'auto' | 'decimal' | 'fraction';
export type GraphQuality = 'performance' | 'balanced' | 'quality';
export type ProgrammerBase = 'bin' | 'oct' | 'dec' | 'hex';
export type BitWidth = 8 | 16 | 32 | 64;

export interface Settings {
  theme: ThemeMode;
  palette: string;
  accent: string;
  angleMode: AngleMode;
  precision: number;
  numberFormat: NumberFormat;
  fractionMode: FractionMode;
  thousandsSeparator: boolean;
  persistHistory: boolean;
  reducedMotion: boolean;
  contrast: 'normal' | 'high';
  // Extended per-section settings
  graphDefaultMode: 'cartesian' | 'parametric' | 'polar' | 'implicit';
  graphGrid: boolean;
  graphAxes: boolean;
  graphLabels: boolean;
  graphQuality: GraphQuality;
  graphLineThickness: number;
  threeDQuality: GraphQuality;
  threeDFps: number;
  threeDGrid: boolean;
  threeDAxes: boolean;
  programmerBase: ProgrammerBase;
  programmerBitWidth: BitWidth;
  programmerSigned: boolean;
  financeCurrency: string;
  financePrecision: number;
  historySize: number;
  keyboardShortcutsEnabled: boolean;
  touchGesturesEnabled: boolean;
  performanceMode: 'auto' | 'performance' | 'balanced' | 'quality';
  showTips: boolean;
  onboardingCompleted: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  palette: 'classic',
  accent: '#6366f1',
  angleMode: 'DEG',
  precision: 12,
  numberFormat: 'auto',
  fractionMode: 'auto',
  thousandsSeparator: true,
  persistHistory: true,
  reducedMotion: false,
  contrast: 'normal',
  graphDefaultMode: 'cartesian',
  graphGrid: true,
  graphAxes: true,
  graphLabels: true,
  graphQuality: 'balanced',
  graphLineThickness: 2,
  threeDQuality: 'balanced',
  threeDFps: 60,
  threeDGrid: true,
  threeDAxes: true,
  programmerBase: 'dec',
  programmerBitWidth: 32,
  programmerSigned: true,
  financeCurrency: 'USD',
  financePrecision: 2,
  historySize: 1000,
  keyboardShortcutsEnabled: true,
  touchGesturesEnabled: true,
  performanceMode: 'auto',
  showTips: true,
  onboardingCompleted: false,
};
