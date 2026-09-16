// Phone number utility: enforce 10-digit Indian mobile with +91 prefix

// Strip everything except digits
export function stripPhone(value: string): string {
  return value.replace(/\D/g, '');
}

// Normalize to +91XXXXXXXXXX format (13 chars)
export function normalizePhone(value: string): string {
  const digits = stripPhone(value);
  // If already has +91 prefix (13 digits starting with 91)
  if (digits.length === 13 && digits.startsWith('91')) {
    return `+${digits}`;
  }
  // Take last 10 digits
  const ten = digits.slice(-10);
  if (ten.length === 10) {
    return `+91${ten}`;
  }
  // Return partial input with +91 prefix
  return `+91${ten}`;
}

// Extract just the 10 digits for display in input fields
export function extractDigits(value: string): string {
  const digits = stripPhone(value);
  // If starts with 91 (country code), strip it
  if (digits.length >= 12 && digits.startsWith('91')) {
    return digits.slice(-10);
  }
  return digits.slice(-10);
}

// Validate: exactly 10 digits
export function isValidPhone(value: string): boolean {
  const digits = stripPhone(value);
  return digits.length === 10;
}

// Format for display: +91 98765 43210
export function formatPhoneDisplay(value: string): string {
  const ten = extractDigits(value);
  if (ten.length !== 10) return `+91 ${ten}`;
  return `+91 ${ten.slice(0, 5)} ${ten.slice(5)}`;
}

// Handle input change: strip non-digits, max 10
export function handlePhoneInput(e: React.ChangeEvent<HTMLInputElement>, setter: (val: string) => void): void {
  const cleaned = stripPhone(e.target.value).slice(0, 10);
  setter(cleaned);
}
