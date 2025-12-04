const SOL_ADDRESS_REGEX = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export function isSolAddress(value: string): boolean {
  return SOL_ADDRESS_REGEX.test(value.trim());
}
