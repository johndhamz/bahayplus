/**
 * Money value object. Amounts are integer centavos; currency is always PHP.
 * Never construct Money from a float — parse user input with `parsePesoInput`.
 */
export const CURRENCY = "PHP" as const;
export type Currency = typeof CURRENCY;

export type Money = Readonly<{ amountCentavos: number; currency: Currency }>;

export class MoneyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MoneyError";
  }
}

function assertCentavos(value: number): void {
  if (!Number.isSafeInteger(value)) {
    throw new MoneyError(`Centavo amount must be a safe integer, received ${value}`);
  }
}

export function money(amountCentavos: number): Money {
  assertCentavos(amountCentavos);
  return Object.freeze({ amountCentavos, currency: CURRENCY });
}

export const ZERO: Money = money(0);

export function add(...values: Money[]): Money {
  return money(values.reduce((sum, v) => sum + v.amountCentavos, 0));
}

export function subtract(a: Money, b: Money): Money {
  return money(a.amountCentavos - b.amountCentavos);
}

export function isNegative(m: Money): boolean {
  return m.amountCentavos < 0;
}

export function compare(a: Money, b: Money): -1 | 0 | 1 {
  return a.amountCentavos === b.amountCentavos ? 0 : a.amountCentavos < b.amountCentavos ? -1 : 1;
}

/**
 * Multiply by a rate expressed in basis points (1 bp = 0.01%), rounding half away from zero.
 * Uses BigInt so intermediate products cannot lose precision.
 */
export function applyBasisPoints(m: Money, basisPoints: number): Money {
  assertCentavos(basisPoints);
  const product = BigInt(m.amountCentavos) * BigInt(basisPoints);
  const divisor = 10_000n;
  const quotient = product / divisor;
  const remainder = product % divisor;
  const absRemainder = remainder < 0n ? -remainder : remainder;
  let rounded = quotient;
  if (absRemainder * 2n >= divisor) rounded += product < 0n ? -1n : 1n;
  return money(Number(rounded));
}

/**
 * Split an amount into `parts` near-equal shares whose sum equals the original exactly.
 * Earlier shares receive the leftover centavos.
 */
export function allocateEvenly(m: Money, parts: number): Money[] {
  if (!Number.isInteger(parts) || parts <= 0) throw new MoneyError("parts must be a positive integer");
  const base = Math.trunc(m.amountCentavos / parts);
  let remainder = m.amountCentavos - base * parts;
  const step = remainder < 0 ? -1 : 1;
  return Array.from({ length: parts }, () => {
    if (remainder !== 0) {
      remainder -= step;
      return money(base + step);
    }
    return money(base);
  });
}

const PESO_INPUT = /^\s*(?:₱|PHP\s*)?(-)?\s*(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d{1,2}))?\s*$/i;

/** Parse a user-entered peso amount ("1,234.5", "₱99", "PHP 10.05") into Money without floats. */
export function parsePesoInput(input: string): Money | null {
  const match = PESO_INPUT.exec(input);
  if (!match) return null;
  const [, sign, wholeRaw, fractionRaw = ""] = match;
  const whole = wholeRaw!.replaceAll(",", "");
  const centavos = Number(whole) * 100 + Number(fractionRaw.padEnd(2, "0"));
  if (!Number.isSafeInteger(centavos)) return null;
  return money(sign ? -centavos : centavos);
}

const pesoFormatter = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: CURRENCY,
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Format for display, e.g. ₱1,234.50. Formatting is the only place centavos become a decimal. */
export function formatPeso(m: Money | number): string {
  const centavos = typeof m === "number" ? m : m.amountCentavos;
  assertCentavos(centavos);
  const negative = centavos < 0;
  const abs = Math.abs(centavos);
  const pesos = Math.trunc(abs / 100);
  const cents = abs % 100;
  // Build from integer parts so no binary-float rounding is involved.
  const formatted = pesoFormatter.format(pesos).replace(/\.00$/, `.${String(cents).padStart(2, "0")}`);
  return negative ? `-${formatted}` : formatted;
}
