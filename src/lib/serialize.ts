import { Prisma } from '@prisma/client';

/**
 * Converte linhas do Prisma em JSON "limpo" para o front-end:
 * Decimal -> number e Date -> string ISO.
 */
export function serialize<T = unknown>(value: unknown): T {
  return JSON.parse(
    JSON.stringify(value, function (this: Record<string, unknown>, key: string, v: unknown) {
      const raw = this[key];
      if (raw instanceof Prisma.Decimal) return raw.toNumber();
      return v;
    })
  ) as T;
}
