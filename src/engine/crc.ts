/**
 * CRC-32 Engine
 * Precomputed lookup table for O(n) CRC calculation.
 * Used for every packet to demonstrate error detection.
 */

const CRC_TABLE: number[] = [];

// Build CRC-32 lookup table (IEEE 802.3 polynomial)
(function buildTable() {
  for (let i = 0; i < 256; i++) {
    let crc = i;
    for (let j = 0; j < 8; j++) {
      crc = (crc & 1) ? (0xEDB88320 ^ (crc >>> 1)) : (crc >>> 1);
    }
    CRC_TABLE[i] = crc >>> 0;
  }
})();

/**
 * Compute CRC-32 for a string payload.
 * Returns hex string (8 chars).
 */
export function computeCRC32(data: string): string {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < data.length; i++) {
    const byte = data.charCodeAt(i) & 0xFF;
    crc = CRC_TABLE[(crc ^ byte) & 0xFF] ^ (crc >>> 8);
  }
  return ((crc ^ 0xFFFFFFFF) >>> 0).toString(16).padStart(8, '0');
}

/**
 * Verify CRC-32 against expected value.
 */
export function verifyCRC32(data: string, expected: string): boolean {
  return computeCRC32(data) === expected;
}

/**
 * Corrupt data by flipping random characters.
 * Used to simulate bit errors.
 */
export function corruptData(data: string, flips: number = 1): string {
  const arr = data.split('');
  for (let i = 0; i < flips && arr.length > 0; i++) {
    const idx = Math.floor(Math.random() * arr.length);
    // Flip a bit in the character code
    const original = arr[idx].charCodeAt(0);
    const bit = 1 << Math.floor(Math.random() * 8);
    arr[idx] = String.fromCharCode(original ^ bit);
  }
  return arr.join('');
}
