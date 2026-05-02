/**
 * Validates an Israeli ID number (Teudat Zehut)
 * Checks for 9 digits and validates the check digit using the Luhn algorithm variant
 * @param id - The ID number to validate
 * @returns true if valid, false otherwise
 */
export function validateIsraeliID(id: string): boolean {
  // Remove any non-digit characters
  const cleanId = id.replace(/\D/g, '');
  
  // Must be exactly 9 digits
  if (cleanId.length !== 9) {
    return false;
  }
  
  // Pad with zeros if needed (for IDs that are less than 9 digits when written)
  const paddedId = cleanId.padStart(9, '0');
  
  // Reject all-zeros ID (000000000)
  if (/^0+$/.test(paddedId)) {
    return false;
  }

  // Israeli IDs always start with digit 0-3 (after padding to 9 digits).
  // Any ID whose first digit is 4 or higher is invalid.
  if (parseInt(paddedId[0], 10) >= 4) {
    return false;
  }

  // Calculate checksum using Israeli ID algorithm
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    let digit = parseInt(paddedId[i]);
    
    // Multiply by 1 or 2 alternately (starting with 1 for index 0)
    const multiplier = (i % 2) + 1;
    let result = digit * multiplier;
    
    // If result is two digits, add them together
    if (result > 9) {
      result = Math.floor(result / 10) + (result % 10);
    }
    
    sum += result;
  }
  
  // Valid if sum is divisible by 10
  return sum % 10 === 0;
}

/**
 * Formats an Israeli ID for display
 * @param id - The ID number to format
 * @returns Formatted ID (XXX-XXXXX-X)
 */
export function formatIsraeliID(id: string): string {
  const cleanId = id.replace(/\D/g, '');
  if (cleanId.length !== 9) return id;
  
  return `${cleanId.slice(0, 3)}-${cleanId.slice(3, 8)}-${cleanId.slice(8)}`;
}