import { clamp } from '@/core/numbers';

export type NumberFormat = 'auto' | 'scientific' | 'engineering';

export interface FormatOptions {
  /** Significant digits, 1–15. */
  precision: number;
  numberFormat: NumberFormat;
  thousandsSeparator: boolean;
}

export const DEFAULT_FORMAT_OPTIONS: FormatOptions = {
  precision: 12,
  numberFormat: 'auto',
  thousandsSeparator: true,
};

/** Thresholds where auto mode switches to exponential notation. */
const AUTO_BIG = 1e15;
const AUTO_SMALL = 1e-9;

export function normaliseFormatOptions(options: Partial<FormatOptions> = {}): FormatOptions {
  const precision = Math.round(clamp(options.precision ?? DEFAULT_FORMAT_OPTIONS.precision, 1, 15));
  return {
    precision,
    numberFormat: options.numberFormat ?? DEFAULT_FORMAT_OPTIONS.numberFormat,
    thousandsSeparator: options.thousandsSeparator ?? DEFAULT_FORMAT_OPTIONS.thousandsSeparator,
  };
}

function group(intPart: string, enabled: boolean): string {
  if (!enabled) return intPart;
  const sign = intPart.startsWith('-') ? '-' : '';
  const digits = sign ? intPart.slice(1) : intPart;
  if (digits.length <= 3) return intPart;
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return sign + grouped;
}

function trimZeros(text: string): string {
  if (!text.includes('.')) return text;
  return text.replace(/\.?0+$/, '');
}

/** Moves the decimal point of a digit string without floating-point maths. */
function shiftDecimal(mantissa: string, places: number): string {
  if (places === 0) return mantissa;
  const negative = mantissa.startsWith('-');
  const body = negative ? mantissa.slice(1) : mantissa;
  const digits = body.replace('.', '');
  const intDigits = body.includes('.') ? body.indexOf('.') : body.length;
  const nextIntDigits = intDigits + places;
  const shifted =
    nextIntDigits >= digits.length
      ? digits + '0'.repeat(nextIntDigits - digits.length)
      : `${digits.slice(0, nextIntDigits)}.${digits.slice(nextIntDigits)}`;
  return negative ? `-${shifted}` : shifted;
}

function formatExponentialBody(mantissa: string, exponent: number): string {
  const sign = exponent < 0 ? '-' : '+';
  return `${mantissa}e${sign}${Math.abs(exponent)}`;
}

/**
 * Formats a number for display.
 * - Auto: fixed notation inside a readable range, exponential outside it.
 * - Scientific/engineering: always exponential (engineering uses multiples of 3).
 * Trailing zeros are removed so exact integers look exact.
 */
export function formatNumber(value: number, options: Partial<FormatOptions> = {}): string {
  const { precision, numberFormat, thousandsSeparator } = normaliseFormatOptions(options);

  if (Number.isNaN(value)) return 'NaN';
  if (!Number.isFinite(value)) return value > 0 ? '∞' : '-∞';
  if (value === 0) return '0';

  // Whole numbers up to 2^53 are printed exactly; snapping them through
  // toPrecision() would silently corrupt the value (e.g. 9007199254740991).
  const isExactInteger = Number.isInteger(value) && Math.abs(value) <= Number.MAX_SAFE_INTEGER;
  const snapped = isExactInteger ? value : Number(value.toPrecision(precision));
  if (snapped === 0) return '0';

  const abs = Math.abs(snapped);
  const magnitude = Math.floor(Math.log10(abs));
  const useExponential =
    numberFormat !== 'auto'
      ? true
      : !isExactInteger && (abs >= AUTO_BIG || abs <= AUTO_SMALL);

  if (useExponential) {
    // Round once, in exponential form, so notation modes agree with each other.
    const [mantissaRaw = '0', exponentRaw = '0'] = snapped.toExponential(precision - 1).split('e');
    const exponent = Number(exponentRaw);
    if (numberFormat === 'engineering') {
      const step = Math.floor(exponent / 3) * 3;
      return formatExponentialBody(trimZeros(shiftDecimal(mantissaRaw, exponent - step)), step);
    }
    return formatExponentialBody(trimZeros(mantissaRaw), exponent);
  }

  const decimals = Math.max(0, Math.min(100, precision - 1 - magnitude));
  const fixed = trimZeros(snapped.toFixed(decimals));
  const [intPart = '0', fracPart] = fixed.split('.');
  const groupedInt = group(intPart, thousandsSeparator);
  return fracPart ? `${groupedInt}.${fracPart}` : groupedInt;
}

export function formatExponential(value: number, digits = 6): string {
  if (!Number.isFinite(value)) return formatNumber(value);
  if (value === 0) return '0';
  const [mantissa = '0', exponent = '0'] = value.toExponential(Math.max(0, Math.min(20, digits - 1))).split('e');
  return formatExponentialBody(trimZeros(mantissa), Number(exponent));
}

/** Percentage-style rounding used by finance tools: 2 decimals, no grouping. */
export function formatFixed(value: number, decimals: number): string {
  if (!Number.isFinite(value)) return formatNumber(value);
  const safe = Math.max(0, Math.min(20, Math.round(decimals)));
  return value.toFixed(safe);
}
