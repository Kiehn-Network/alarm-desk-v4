const AUTH_MINIMUM_LENGTH = 6;
const INVISIBLE_PASSWORD_PADDING = "\u2063";

/**
 * The auth service enforces six code points. AlarmDesk intentionally accepts
 * four-character passwords, so only shorter values receive invisible padding.
 * The user continues to enter the original password when signing in.
 */
export function toAuthPassword(password: string): string {
  return password.padEnd(AUTH_MINIMUM_LENGTH, INVISIBLE_PASSWORD_PADDING);
}