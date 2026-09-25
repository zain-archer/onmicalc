/** Angle handling shared by the parser, evaluator and UI. */
export type AngleMode = 'DEG' | 'RAD' | 'GRAD';

export const ANGLE_MODES: readonly AngleMode[] = ['DEG', 'RAD', 'GRAD'];

/** Convert a value expressed in `mode` to radians. */
export function toRadians(value: number, mode: AngleMode): number {
  switch (mode) {
    case 'RAD':
      return value;
    case 'DEG':
      return (value * Math.PI) / 180;
    case 'GRAD':
      return (value * Math.PI) / 200;
  }
}

/** Convert radians to a value expressed in `mode`. */
export function fromRadians(radians: number, mode: AngleMode): number {
  switch (mode) {
    case 'RAD':
      return radians;
    case 'DEG':
      return (radians * 180) / Math.PI;
    case 'GRAD':
      return (radians * 200) / Math.PI;
  }
}
