/** IEC sRGB transfer functions; inputs and outputs are normalized channel values. */
export function srgbToLinear(value) {
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

export function linearToSrgb(value) {
  return value <= 0.0031308 ? value * 12.92 : 1.055 * value ** (1 / 2.4) - 0.055;
}

export function displayByte(value) {
  return Math.round(Math.min(1, Math.max(0, linearToSrgb(value))) * 255);
}
