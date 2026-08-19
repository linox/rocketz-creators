/**
 * Brazilian CPF validation and formatting utilities
 */

/**
 * Formats a raw string into a CPF mask: 000.000.000-00
 */
export function formatCPF(value: string): string {
  if (!value) return '';
  const digits = value.replace(/\D/g, '').slice(0, 11);
  
  if (digits.length <= 3) {
    return digits;
  }
  if (digits.length <= 6) {
    return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  }
  if (digits.length <= 9) {
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  }
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9, 11)}`;
}

/**
 * Strips all non-digit characters from a CPF
 */
export function cleanCPF(value: string): string {
  if (!value) return '';
  return value.replace(/\D/g, '');
}

/**
 * Validates a Brazilian CPF using format length and check digit verification algorithm (Módulo 11)
 */
export function isValidCPF(cpf: string): boolean {
  if (!cpf) return false;
  
  const clean = cleanCPF(cpf);
  
  // Must have exactly 11 digits
  if (clean.length !== 11) {
    return false;
  }
  
  // Reject known invalid sequences of identical numbers (00000000000, 11111111111, etc.)
  if (/^(\d)\1{10}$/.test(clean)) {
    return false;
  }
  
  // Validate first check digit
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(clean.charAt(i), 10) * (10 - i);
  }
  let firstCheck = (sum * 10) % 11;
  if (firstCheck === 10 || firstCheck === 11) {
    firstCheck = 0;
  }
  if (firstCheck !== parseInt(clean.charAt(9), 10)) {
    return false;
  }
  
  // Validate second check digit
  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(clean.charAt(i), 10) * (11 - i);
  }
  let secondCheck = (sum * 10) % 11;
  if (secondCheck === 10 || secondCheck === 11) {
    secondCheck = 0;
  }
  if (secondCheck !== parseInt(clean.charAt(10), 10)) {
    return false;
  }
  
  return true;
}
