export type AdvanceType = 'DINHEIRO' | 'PIX' | 'CARTAO_COMBUSTIVEL' | 'OUTRO';

export type TripExpenseCategory =
  | 'PEDAGIO'
  | 'CHAPA'
  | 'ESTADIA'
  | 'ALIMENTACAO'
  | 'BORRACHARIA'
  | 'BALSA'
  | 'LAVAGEM'
  | 'MULTA'
  | 'OUTROS';

export const expenseCategoryLabels: Record<TripExpenseCategory, string> = {
  PEDAGIO: 'Pedágio',
  CHAPA: 'Chapa (carga/descarga)',
  ESTADIA: 'Estadia',
  ALIMENTACAO: 'Alimentação',
  BORRACHARIA: 'Borracharia',
  BALSA: 'Balsa',
  LAVAGEM: 'Lavagem',
  MULTA: 'Multa',
  OUTROS: 'Outros',
};

export const advanceTypeLabels: Record<AdvanceType, string> = {
  DINHEIRO: 'Dinheiro',
  PIX: 'PIX',
  CARTAO_COMBUSTIVEL: 'Cartão combustível',
  OUTRO: 'Outro',
};

export interface SettlementAdvance {
  id: string;
  date: string;
  type: AdvanceType;
  amount: number;
}

export interface SettlementExpense {
  id: string;
  date: string;
  category: TripExpenseCategory;
  description?: string;
  amount: number;
  /** true = motorista pagou do bolso (reembolsável) */
  paidByDriver: boolean;
  approved: boolean;
}

export interface SettlementDeduction {
  id: string;
  label: string;
  amount: number;
}

/** Remuneração do motorista, vinda da tabela de frete do motorista. */
export type DriverPay =
  | { mode: 'PERCENT'; percent: number }
  | { mode: 'FIXED'; value: number };

export interface SettlementInput {
  grossFreight: number;
  driverPay: DriverPay;
  advances: SettlementAdvance[];
  expenses: SettlementExpense[];
  deductions: SettlementDeduction[];
}

export interface SettlementResult {
  grossFreight: number;
  driverShare: number;
  totalAdvances: number;
  /** Despesas pagas pelo motorista e aprovadas: voltam para ele. */
  reimbursements: number;
  /** Despesas pagas pela empresa (custo da viagem, não afeta o motorista). */
  companyExpenses: number;
  otherDeductions: number;
  /** > 0 empresa paga ao motorista; < 0 motorista devolve à empresa. */
  netToDriver: number;
  /** Resultado da viagem para a empresa: frete - parcela motorista - despesas da empresa - reembolsos. */
  companyMargin: number;
  companyMarginPercent: number;
}

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const sum = (xs: number[]) => xs.reduce((a, b) => a + (Number.isFinite(b) ? b : 0), 0);

export function computeSettlement(input: SettlementInput): SettlementResult {
  const gross = Math.max(0, input.grossFreight || 0);
  const driverShare =
    input.driverPay.mode === 'PERCENT'
      ? gross * (Math.max(0, input.driverPay.percent) / 100)
      : Math.max(0, input.driverPay.value);

  const totalAdvances = sum(input.advances.map((a) => a.amount));
  const reimbursements = sum(
    input.expenses.filter((e) => e.paidByDriver && e.approved).map((e) => e.amount)
  );
  const companyExpenses = sum(input.expenses.filter((e) => !e.paidByDriver).map((e) => e.amount));
  const otherDeductions = sum(input.deductions.map((d) => d.amount));

  const netToDriver = driverShare + reimbursements - totalAdvances - otherDeductions;
  const companyMargin = gross - driverShare - companyExpenses - reimbursements + otherDeductions;

  return {
    grossFreight: round2(gross),
    driverShare: round2(driverShare),
    totalAdvances: round2(totalAdvances),
    reimbursements: round2(reimbursements),
    companyExpenses: round2(companyExpenses),
    otherDeductions: round2(otherDeductions),
    netToDriver: round2(netToDriver),
    companyMargin: round2(companyMargin),
    companyMarginPercent: gross > 0 ? round2((companyMargin / gross) * 100) : 0,
  };
}
