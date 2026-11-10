export type PeriodPreset =
  | 'ALL'
  | 'THIS_MONTH'
  | 'LAST_30_DAYS'
  | 'LAST_90_DAYS'
  | 'THIS_YEAR'
  | 'CUSTOM';

export interface DashboardFilters {
  period: PeriodPreset;
  /** yyyy-mm-dd, usados quando period === 'CUSTOM' */
  dateFrom: string;
  dateTo: string;
  truckIds: string[];
  driverIds: string[];
}

export const defaultDashboardFilters: DashboardFilters = {
  period: 'ALL',
  dateFrom: '',
  dateTo: '',
  truckIds: [],
  driverIds: [],
};

export const periodLabels: Record<PeriodPreset, string> = {
  ALL: 'Todo o histórico',
  THIS_MONTH: 'Mês atual',
  LAST_30_DAYS: 'Últimos 30 dias',
  LAST_90_DAYS: 'Últimos 90 dias',
  THIS_YEAR: 'Este ano',
  CUSTOM: 'Personalizado',
};

export function hasActiveFilters(f: DashboardFilters): boolean {
  return f.period !== 'ALL' || f.truckIds.length > 0 || f.driverIds.length > 0;
}

/** Intervalo [from, to] em ms (inclusive); null = sem limite naquele lado. */
export function resolveRange(f: DashboardFilters, now = new Date()): [number | null, number | null] {
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const DAY = 86_400_000;
  switch (f.period) {
    case 'THIS_MONTH':
      return [new Date(now.getFullYear(), now.getMonth(), 1).getTime(), null];
    case 'LAST_30_DAYS':
      return [startOfDay(now) - 30 * DAY, null];
    case 'LAST_90_DAYS':
      return [startOfDay(now) - 90 * DAY, null];
    case 'THIS_YEAR':
      return [new Date(now.getFullYear(), 0, 1).getTime(), null];
    case 'CUSTOM': {
      // yyyy-mm-dd interpretado como data local (evita deslocar por fuso)
      const parse = (s: string, endOfDay: boolean) => {
        if (!s) return null;
        const [y, m, d] = s.split('-').map(Number);
        if (!y || !m || !d) return null;
        return new Date(y, m - 1, d, endOfDay ? 23 : 0, endOfDay ? 59 : 0, endOfDay ? 59 : 0, endOfDay ? 999 : 0).getTime();
      };
      return [parse(f.dateFrom, false), parse(f.dateTo, true)];
    }
    default:
      return [null, null];
  }
}

export function isDateInFilter(dateStr: string, f: DashboardFilters, now = new Date()): boolean {
  const [from, to] = resolveRange(f, now);
  if (from === null && to === null) return true;
  const t = new Date(dateStr).getTime();
  if (Number.isNaN(t)) return true;
  if (from !== null && t < from) return false;
  if (to !== null && t > to) return false;
  return true;
}
