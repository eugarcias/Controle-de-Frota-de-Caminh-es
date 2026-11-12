export interface DriverRank {
  level: number;
  title: string;
  badge: string;
  color: string;
  bgLight: string;
  bgDark: string;
  borderLight: string;
  borderDark: string;
  minLoads: number;
  bonusMultiplier: number; // Ex: 1.05 = 5% bônus de produção
  description: string;
}

export const DRIVER_RANKS: DriverRank[] = [
  {
    level: 1,
    title: 'Recruta da Estrada',
    badge: '🥉',
    color: 'text-amber-700 dark:text-amber-400',
    bgLight: 'bg-amber-50',
    bgDark: 'dark:bg-amber-950/40',
    borderLight: 'border-amber-200',
    borderDark: 'dark:border-amber-800/60',
    minLoads: 0,
    bonusMultiplier: 1.0,
    description: 'Iniciando trajetória na frota VSM Garcia.',
  },
  {
    level: 2,
    title: 'Piloto de Rota',
    badge: '🥈',
    color: 'text-slate-700 dark:text-slate-300',
    bgLight: 'bg-slate-100',
    bgDark: 'dark:bg-slate-800/50',
    borderLight: 'border-slate-300',
    borderDark: 'dark:border-slate-700',
    minLoads: 5,
    bonusMultiplier: 1.02,
    description: 'Motorista constante, pontual e com rotas consolidadas.',
  },
  {
    level: 3,
    title: 'Mestre da Boleia',
    badge: '🥇',
    color: 'text-amber-500 dark:text-amber-300',
    bgLight: 'bg-amber-100/70',
    bgDark: 'dark:bg-amber-900/40',
    borderLight: 'border-amber-300',
    borderDark: 'dark:border-amber-700',
    minLoads: 15,
    bonusMultiplier: 1.05,
    description: 'Alta produtividade, cuidado com o veículo e precisão.',
  },
  {
    level: 4,
    title: 'Lenda do Asfalto',
    badge: '👑',
    color: 'text-emerald-600 dark:text-emerald-400',
    bgLight: 'bg-emerald-50',
    bgDark: 'dark:bg-emerald-950/40',
    borderLight: 'border-emerald-300',
    borderDark: 'dark:border-emerald-800',
    minLoads: 30,
    bonusMultiplier: 1.08,
    description: 'Elite da frota! Referência em quilometragem e segurança.',
  },
  {
    level: 5,
    title: 'Comandante Supremo',
    badge: '💎',
    color: 'text-cyan-600 dark:text-cyan-300',
    bgLight: 'bg-cyan-50',
    bgDark: 'dark:bg-cyan-950/40',
    borderLight: 'border-cyan-300',
    borderDark: 'dark:border-cyan-800',
    minLoads: 50,
    bonusMultiplier: 1.10,
    description: 'Nível máximo de excelência, dedicação e faturamento.',
  },
];

export function getDriverRank(completedLoadsCount: number) {
  let currentRank = DRIVER_RANKS[0];
  let nextRank: DriverRank | null = DRIVER_RANKS[1];

  for (let i = 0; i < DRIVER_RANKS.length; i++) {
    if (completedLoadsCount >= DRIVER_RANKS[i].minLoads) {
      currentRank = DRIVER_RANKS[i];
      nextRank = DRIVER_RANKS[i + 1] ?? null;
    }
  }

  const loadsForNext = nextRank ? nextRank.minLoads - completedLoadsCount : 0;
  const progressPercent = nextRank
    ? Math.min(
        100,
        Math.max(
          0,
          Math.round(
            ((completedLoadsCount - currentRank.minLoads) /
              (nextRank.minLoads - currentRank.minLoads)) *
              100
          )
        )
      )
    : 100;

  return {
    currentRank,
    nextRank,
    loadsForNext,
    progressPercent,
  };
}
