'use client';

import React, { useMemo, useState } from 'react';
import { Plus, Trash2, Wallet, Receipt, MinusCircle, CheckCircle2, AlertTriangle } from 'lucide-react';
import {
  Field,
  inputCls,
  primaryBtn,
  secondaryBtn,
  cardCls,
  formatBRL,
  newId,
} from '@/components/ui';
import { cn } from '@/lib/utils';
import {
  AdvanceType,
  TripExpenseCategory,
  SettlementAdvance,
  SettlementExpense,
  SettlementDeduction,
  DriverPay,
  advanceTypeLabels,
  expenseCategoryLabels,
  computeSettlement,
  SettlementResult,
} from '@/lib/settlement';

export interface TripSettlementPayload {
  tripId: string;
  driverId: string;
  advances: SettlementAdvance[];
  expenses: SettlementExpense[];
  deductions: SettlementDeduction[];
  notes: string;
  result: SettlementResult;
  /** 'RASCUNHO' salva sem fechar; 'FECHADO' trava o acerto e libera a geração do RPA. */
  status: 'RASCUNHO' | 'FECHADO';
}

interface TripSettlementFormProps {
  trip: {
    id: string;
    driverId: string;
    driverName: string;
    plate: string;
    customerName: string;
    routeLabel: string;
    grossFreightValue: number;
  };
  driverPay: DriverPay;
  initialAdvances?: SettlementAdvance[];
  initialExpenses?: SettlementExpense[];
  /** Multas/avarias já marcadas para desconto do motorista. */
  initialDeductions?: SettlementDeduction[];
  submitting?: boolean;
  onSubmit: (payload: TripSettlementPayload) => void | Promise<void>;
  onCancel?: () => void;
}

const today = () => new Date().toISOString().slice(0, 10);

/** Converte "1.234,56" / "1234.56" em número. */
function parseMoney(raw: string): number {
  if (!raw) return 0;
  const normalized = raw.includes(',') ? raw.replace(/\./g, '').replace(',', '.') : raw;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : 0;
}

function MoneyInput({
  value,
  onChange,
  ariaLabel,
}: {
  value: number;
  onChange: (n: number) => void;
  ariaLabel: string;
}) {
  const [text, setText] = useState(value ? String(value).replace('.', ',') : '');
  return (
    <input
      inputMode="decimal"
      aria-label={ariaLabel}
      placeholder="0,00"
      className={cn(inputCls, 'text-right tabular-nums')}
      value={text}
      onChange={(e) => {
        const v = e.target.value.replace(/[^\d.,]/g, '');
        setText(v);
        onChange(parseMoney(v));
      }}
    />
  );
}

function SectionHeader({
  icon,
  title,
  total,
  tone,
  onAdd,
  addLabel,
}: {
  icon: React.ReactNode;
  title: string;
  total: number;
  tone: 'red' | 'green' | 'slate';
  onAdd: () => void;
  addLabel: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 mb-3">
      <div className="flex items-center gap-2 min-w-0">
        <span className="p-2 rounded-xl bg-slate-100 text-slate-600 shrink-0">{icon}</span>
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-slate-900 truncate">{title}</h3>
          <span
            className={cn(
              'text-xs font-semibold tabular-nums',
              tone === 'red' && 'text-rose-600',
              tone === 'green' && 'text-emerald-600',
              tone === 'slate' && 'text-slate-600'
            )}
          >
            {formatBRL(total)}
          </span>
        </div>
      </div>
      <button type="button" onClick={onAdd} className={secondaryBtn}>
        <Plus className="w-4 h-4" />
        <span className="hidden sm:inline">{addLabel}</span>
        <span className="sm:hidden">Novo</span>
      </button>
    </div>
  );
}

function Row({ children, onRemove }: { children: React.ReactNode; onRemove: () => void }) {
  return (
    <div className="relative rounded-xl bg-slate-50 ring-1 ring-slate-200/70 p-3 pr-12">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">{children}</div>
      <button
        type="button"
        onClick={onRemove}
        aria-label="Remover linha"
        className="absolute top-2 right-2 p-2 rounded-lg text-rose-500 hover:bg-rose-50"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );
}

function SummaryLine({
  label,
  value,
  sign,
}: {
  label: string;
  value: number;
  sign?: '+' | '-';
}) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-slate-600">{label}</span>
      <span
        className={cn(
          'font-semibold tabular-nums',
          sign === '+' && 'text-emerald-600',
          sign === '-' && 'text-rose-600',
          !sign && 'text-slate-900'
        )}
      >
        {sign ? `${sign} ` : ''}
        {formatBRL(value)}
      </span>
    </div>
  );
}

export function TripSettlementForm({
  trip,
  driverPay,
  initialAdvances = [],
  initialExpenses = [],
  initialDeductions = [],
  submitting = false,
  onSubmit,
  onCancel,
}: TripSettlementFormProps) {
  const [advances, setAdvances] = useState<SettlementAdvance[]>(initialAdvances);
  const [expenses, setExpenses] = useState<SettlementExpense[]>(initialExpenses);
  const [deductions, setDeductions] = useState<SettlementDeduction[]>(initialDeductions);
  const [notes, setNotes] = useState('');

  // Recalcula em tempo real a cada alteração
  const result = useMemo(
    () =>
      computeSettlement({
        grossFreight: trip.grossFreightValue,
        driverPay,
        advances,
        expenses,
        deductions,
      }),
    [trip.grossFreightValue, driverPay, advances, expenses, deductions]
  );

  const pendingApproval = expenses.filter((e) => e.paidByDriver && !e.approved).length;
  const driverOwes = result.netToDriver < 0;

  const patch = <T extends { id: string }>(
    setter: React.Dispatch<React.SetStateAction<T[]>>,
    id: string,
    changes: Partial<T>
  ) => setter((list) => list.map((x) => (x.id === id ? { ...x, ...changes } : x)));

  const remove = <T extends { id: string }>(
    setter: React.Dispatch<React.SetStateAction<T[]>>,
    id: string
  ) => setter((list) => list.filter((x) => x.id !== id));

  const submit = (status: 'RASCUNHO' | 'FECHADO') =>
    onSubmit({
      tripId: trip.id,
      driverId: trip.driverId,
      advances: advances.filter((a) => a.amount > 0),
      expenses: expenses.filter((e) => e.amount > 0),
      deductions: deductions.filter((d) => d.amount > 0),
      notes,
      result,
      status,
    });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit('FECHADO');
      }}
      className="space-y-4 pb-44 lg:pb-0"
    >
      {/* Cabeçalho da viagem */}
      <div className={cn(cardCls, 'p-4 ring-1 ring-slate-200')}>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
          <span className="bg-slate-900 text-white px-2 py-0.5 rounded text-xs font-bold">
            {trip.plate}
          </span>
          <span className="font-semibold text-slate-900">{trip.driverName}</span>
          <span className="text-slate-500">{trip.customerName}</span>
        </div>
        <p className="text-xs text-slate-500 mt-1">{trip.routeLabel}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          {/* Adiantamentos */}
          <section className={cn(cardCls, 'p-4 ring-1 ring-slate-200')}>
            <SectionHeader
              icon={<Wallet className="w-4 h-4" />}
              title="Adiantamentos ao motorista"
              total={result.totalAdvances}
              tone="red"
              addLabel="Adiantamento"
              onAdd={() =>
                setAdvances((l) => [
                  ...l,
                  { id: newId(), date: today(), type: 'DINHEIRO', amount: 0 },
                ])
              }
            />
            <div className="space-y-2">
              {advances.length === 0 && (
                <p className="text-xs text-slate-500 text-center py-3">
                  Nenhum adiantamento lançado.
                </p>
              )}
              {advances.map((a) => (
                <Row key={a.id} onRemove={() => remove(setAdvances, a.id)}>
                  <Field label="Data">
                    <input
                      type="date"
                      className={inputCls}
                      value={a.date}
                      onChange={(e) => patch(setAdvances, a.id, { date: e.target.value })}
                    />
                  </Field>
                  <Field label="Tipo">
                    <select
                      className={inputCls}
                      value={a.type}
                      onChange={(e) =>
                        patch(setAdvances, a.id, { type: e.target.value as AdvanceType })
                      }
                    >
                      {(Object.keys(advanceTypeLabels) as AdvanceType[]).map((k) => (
                        <option key={k} value={k}>
                          {advanceTypeLabels[k]}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Valor (R$)" className="col-span-2">
                    <MoneyInput
                      ariaLabel="Valor do adiantamento"
                      value={a.amount}
                      onChange={(n) => patch(setAdvances, a.id, { amount: n })}
                    />
                  </Field>
                </Row>
              ))}
            </div>
          </section>

          {/* Despesas */}
          <section className={cn(cardCls, 'p-4 ring-1 ring-slate-200')}>
            <SectionHeader
              icon={<Receipt className="w-4 h-4" />}
              title="Despesas da viagem"
              total={result.reimbursements + result.companyExpenses}
              tone="slate"
              addLabel="Despesa"
              onAdd={() =>
                setExpenses((l) => [
                  ...l,
                  {
                    id: newId(),
                    date: today(),
                    category: 'PEDAGIO',
                    amount: 0,
                    paidByDriver: true,
                    approved: false,
                  },
                ])
              }
            />
            {pendingApproval > 0 && (
              <div className="flex items-center gap-2 text-xs text-amber-800 bg-amber-50 ring-1 ring-amber-200 rounded-lg p-2 mb-3">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                {pendingApproval} despesa(s) do motorista aguardam aprovação e ainda não entram no
                reembolso.
              </div>
            )}
            <div className="space-y-2">
              {expenses.length === 0 && (
                <p className="text-xs text-slate-500 text-center py-3">
                  Nenhuma despesa lançada.
                </p>
              )}
              {expenses.map((x) => (
                <Row key={x.id} onRemove={() => remove(setExpenses, x.id)}>
                  <Field label="Data">
                    <input
                      type="date"
                      className={inputCls}
                      value={x.date}
                      onChange={(e) => patch(setExpenses, x.id, { date: e.target.value })}
                    />
                  </Field>
                  <Field label="Categoria">
                    <select
                      className={inputCls}
                      value={x.category}
                      onChange={(e) =>
                        patch(setExpenses, x.id, {
                          category: e.target.value as TripExpenseCategory,
                        })
                      }
                    >
                      {(Object.keys(expenseCategoryLabels) as TripExpenseCategory[]).map((k) => (
                        <option key={k} value={k}>
                          {expenseCategoryLabels[k]}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Valor (R$)" className="col-span-2">
                    <MoneyInput
                      ariaLabel="Valor da despesa"
                      value={x.amount}
                      onChange={(n) => patch(setExpenses, x.id, { amount: n })}
                    />
                  </Field>
                  <Field label="Quem pagou" className="col-span-2">
                    <select
                      className={inputCls}
                      value={x.paidByDriver ? 'driver' : 'company'}
                      onChange={(e) =>
                        patch(setExpenses, x.id, { paidByDriver: e.target.value === 'driver' })
                      }
                    >
                      <option value="driver">Motorista (reembolsar)</option>
                      <option value="company">Empresa (custo da viagem)</option>
                    </select>
                  </Field>
                  {x.paidByDriver && (
                    <label className="col-span-2 flex items-center gap-2 min-h-11 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        className="w-5 h-5 accent-emerald-600"
                        checked={x.approved}
                        onChange={(e) => patch(setExpenses, x.id, { approved: e.target.checked })}
                      />
                      Comprovante conferido
                    </label>
                  )}
                </Row>
              ))}
            </div>
          </section>

          {/* Deduções */}
          <section className={cn(cardCls, 'p-4 ring-1 ring-slate-200')}>
            <SectionHeader
              icon={<MinusCircle className="w-4 h-4" />}
              title="Outras deduções (multas, avarias)"
              total={result.otherDeductions}
              tone="red"
              addLabel="Dedução"
              onAdd={() =>
                setDeductions((l) => [...l, { id: newId(), label: '', amount: 0 }])
              }
            />
            <div className="space-y-2">
              {deductions.length === 0 && (
                <p className="text-xs text-slate-500 text-center py-3">Sem deduções.</p>
              )}
              {deductions.map((d) => (
                <Row key={d.id} onRemove={() => remove(setDeductions, d.id)}>
                  <Field label="Descrição" className="col-span-2">
                    <input
                      className={inputCls}
                      value={d.label}
                      placeholder="Ex.: Multa AIT 123456"
                      onChange={(e) => patch(setDeductions, d.id, { label: e.target.value })}
                    />
                  </Field>
                  <Field label="Valor (R$)" className="col-span-2">
                    <MoneyInput
                      ariaLabel="Valor da dedução"
                      value={d.amount}
                      onChange={(n) => patch(setDeductions, d.id, { amount: n })}
                    />
                  </Field>
                </Row>
              ))}
            </div>
          </section>

          <Field label="Observações">
            <textarea
              rows={2}
              className={inputCls}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </Field>
        </div>

        {/* Resumo: lateral no desktop; barra fixa no mobile */}
        <aside
          className={cn(
            'bg-white shadow-sm ring-1 ring-slate-200 p-4 space-y-2',
            'fixed bottom-0 inset-x-0 z-40 rounded-t-2xl shadow-[0_-8px_24px_rgba(15,23,42,0.12)]',
            'lg:static lg:rounded-2xl lg:shadow-sm lg:self-start lg:sticky lg:top-4'
          )}
        >
          <h3 className="hidden lg:block text-xs font-bold text-slate-500 uppercase tracking-wider">
            Resumo do acerto
          </h3>
          <div className="hidden lg:block space-y-2">
            <SummaryLine label="Frete bruto" value={result.grossFreight} />
            <SummaryLine label="Parcela do motorista" value={result.driverShare} sign="+" />
            <SummaryLine label="Reembolso de despesas" value={result.reimbursements} sign="+" />
            <SummaryLine label="Adiantamentos" value={result.totalAdvances} sign="-" />
            <SummaryLine label="Deduções" value={result.otherDeductions} sign="-" />
            <hr className="border-slate-100" />
          </div>

          <div className="flex items-end justify-between gap-3">
            <div>
              <span className="text-[11px] font-bold text-slate-500 uppercase block">
                {driverOwes ? 'Motorista deve à empresa' : 'A pagar ao motorista'}
              </span>
              <span
                className={cn(
                  'text-2xl font-bold tabular-nums',
                  driverOwes ? 'text-rose-600' : 'text-emerald-600'
                )}
              >
                {formatBRL(Math.abs(result.netToDriver))}
              </span>
            </div>
            <div className="text-right">
              <span className="text-[11px] font-bold text-slate-500 uppercase block">
                Margem empresa
              </span>
              <span
                className={cn(
                  'text-sm font-bold tabular-nums',
                  result.companyMargin >= 0 ? 'text-emerald-600' : 'text-rose-600'
                )}
              >
                {formatBRL(result.companyMargin)} ({result.companyMarginPercent}%)
              </span>
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              disabled={submitting}
              onClick={() => submit('RASCUNHO')}
              className={cn(secondaryBtn, 'flex-1')}
            >
              Salvar rascunho
            </button>
            <button type="submit" disabled={submitting} className={cn(primaryBtn, 'flex-1')}>
              <CheckCircle2 className="w-4 h-4" />
              Fechar acerto
            </button>
          </div>
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="w-full text-xs text-slate-500 hover:text-slate-700 py-1"
            >
              Cancelar
            </button>
          )}
        </aside>
      </div>
    </form>
  );
}
