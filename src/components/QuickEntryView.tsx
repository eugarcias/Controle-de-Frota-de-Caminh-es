'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  Fuel,
  CheckCircle,
  AlertTriangle,
  Check,
  Camera,
  UploadCloud,
  Loader2,
  Sparkles,
  FileText,
  X,
  Trash2,
} from 'lucide-react';
import { Truck, Driver, FuelLog, MonthlyFuelPerformance } from '@/types';
import { calculateMonthlyFuelPerformance } from '@/lib/calc';
import { formatBRL, formatDate } from '@/components/ui';

interface QuickEntryViewProps {
  trucks: Truck[];
  drivers: Driver[];
  fuelLogs: FuelLog[];
  onSubmitLog: (newLog: FuelLog) => Promise<unknown>;
  onRemoveLog?: (id: string) => Promise<boolean>;
}

function nowLocalDateTime(): string {
  const d = new Date();
  const off = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - off).toISOString().slice(0, 16);
}

export const QuickEntryView: React.FC<QuickEntryViewProps> = ({
  trucks,
  drivers,
  fuelLogs,
  onSubmitLog,
  onRemoveLog,
}) => {
  const [truckId, setTruckId] = useState(trucks[0]?.id || '');
  const [driverId, setDriverId] = useState(drivers[0]?.id || '');
  const [odometer, setOdometer] = useState<number>(trucks[0]?.currentOdometer || 0);
  const [liters, setLiters] = useState<number>(550);
  const [totalAmount, setTotalAmount] = useState<number>(3272.5);
  const [gasStationName, setGasStationName] = useState<string>('Posto Rodovia');
  const [logDateTime, setLogDateTime] = useState<string>(nowLocalDateTime);
  const [submitting, setSubmitting] = useState<boolean>(false);

  useEffect(() => {
    if (!truckId && trucks[0]) {
      setTruckId(trucks[0].id);
      setOdometer(trucks[0].currentOdometer || 0);
    }
  }, [trucks, truckId]);

  useEffect(() => {
    if (!driverId && drivers[0]) {
      setDriverId(drivers[0].id);
    }
  }, [drivers, driverId]);

  // Estados do OCR com IA
  const [ocrLoading, setOcrLoading] = useState<boolean>(false);
  const [receiptImage, setReceiptImage] = useState<string | null>(null);
  const [ocrSuccessMsg, setOcrSuccessMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
    monthlyPerf?: MonthlyFuelPerformance;
  } | null>(null);

  // Seleciona caminhão e atualiza hodômetro de referência
  const handleTruckChange = (id: string) => {
    setTruckId(id);
    const selected = trucks.find((t) => t.id === id);
    if (selected) {
      setOdometer(selected.currentOdometer + 1500);
    }
  };

  const pricePerLiter = liters > 0 ? Number((totalAmount / liters).toFixed(3)) : 0;

  // Handler de upload e leitura de Nota Fiscal por IA
  const handleFileUpload = async (file: File) => {
    if (!file) return;

    setOcrLoading(true);
    setOcrSuccessMsg(null);
    setFeedback(null);

    try {
      const reader = new FileReader();
      reader.onload = (e) => {
        setReceiptImage(e.target?.result as string);
      };
      reader.readAsDataURL(file);

      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/ocr-fuel', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        throw new Error('Falha ao processar a nota fiscal.');
      }

      const data = await res.json();

      if (data.gasStationName) setGasStationName(data.gasStationName);
      const parsedLiters = data.liters && Number(data.liters) > 0 ? Number(data.liters) : liters;
      if (data.liters && Number(data.liters) > 0) setLiters(parsedLiters);

      if (data.totalAmount && Number(data.totalAmount) > 0) {
        setTotalAmount(Number(data.totalAmount));
      } else if (data.pricePerLiter && Number(data.pricePerLiter) > 0) {
        setTotalAmount(Number((parsedLiters * Number(data.pricePerLiter)).toFixed(2)));
      }

      if (data.date) {
        const dStr = String(data.date);
        setLogDateTime(dStr.length >= 16 ? dStr.slice(0, 16) : `${dStr.slice(0, 10)}T12:00`);
      }
      if (data.odometer && Number(data.odometer) > 0) setOdometer(Number(data.odometer));

      setOcrSuccessMsg(
        data.message ||
          `Nota fiscal lida com sucesso via IA (${data.source === 'gemini' ? 'Google Gemini' : data.source === 'openai' ? 'OpenAI GPT-4o' : 'Simulação'} - Confiança: ${Math.round((data.confidence || 0.9) * 100)}%)!`
      );
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.message || 'Erro ao analisar imagem da nota fiscal.',
      });
    } finally {
      setOcrLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setFeedback(null);

    try {
      const isoDate = logDateTime
        ? new Date(logDateTime).toISOString()
        : new Date().toISOString();

      const payload = {
        truckId,
        driverId,
        date: isoDate,
        odometer: Number(odometer),
        fuelType: 'DIESEL_S10' as const,
        liters: Number(liters),
        pricePerLiter: pricePerLiter > 0 ? pricePerLiter : 1,
        totalAmount: Number(totalAmount),
        arlaLiters: 0,
        arlaAmount: 0,
        gasStationName: gasStationName.trim() || 'Posto Rodovia',
        receiptPhotoUrl: receiptImage || null,
      };

      const newLog: FuelLog = {
        id: crypto.randomUUID(),
        ...payload,
        createdAt: new Date().toISOString(),
      };

      const d = new Date(isoDate);
      const history = [...fuelLogs.filter((l) => l.truckId === truckId), newLog];
      const monthlyPerf = calculateMonthlyFuelPerformance(
        history,
        truckId,
        d.getUTCMonth() + 1,
        d.getUTCFullYear()
      );

      const saved = await onSubmitLog(newLog);
      if (!saved) {
        throw new Error(
          'Não foi possível salvar o abastecimento no banco. Veja o aviso no topo da página.'
        );
      }

      setFeedback({
        type: 'success',
        message: 'Abastecimento registrado com sucesso!',
        monthlyPerf,
      });
      setReceiptImage(null);
      setOcrSuccessMsg(null);
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.message || 'Falha na comunicação com o servidor',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header Mobile-First */}
      <div className="bg-slate-900 p-6 rounded-2xl text-white shadow-md ring-1 ring-slate-800">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-emerald-500/20 text-emerald-400 rounded-xl">
              <Fuel className="w-7 h-7" />
            </div>
            <div>
              <h2 className="text-xl font-bold">Lançamento de Abastecimento</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Cálculo padronizado por Média Mensal Acumulada • Fotografe o recibo para leitura automática.
              </p>
            </div>
          </div>
          <span className="self-start sm:self-auto text-[11px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-950/60 px-2.5 py-1 rounded-full border border-emerald-800">
            Média Mensal
          </span>
        </div>
      </div>

      {/* Foto do Recibo + Leitura Inteligente (OCR) */}
      <div className="bg-white dark:bg-[#111926] p-5 rounded-2xl shadow-sm ring-1 ring-slate-200 dark:ring-slate-800 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-emerald-500" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Foto do Recibo (Leitura Inteligente IA)
            </h3>
          </div>
          <span className="text-[11px] text-slate-500 dark:text-slate-400">Gemini / GPT-4o</span>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFileUpload(f);
          }}
        />

        {!receiptImage ? (
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-emerald-500 bg-slate-50/60 dark:bg-[#0b111a]/60 hover:bg-emerald-50/30 dark:hover:bg-emerald-950/20 p-6 rounded-2xl text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-2 group"
          >
            {ocrLoading ? (
              <div className="py-4 flex flex-col items-center gap-2 text-emerald-600 dark:text-emerald-400">
                <Loader2 className="w-8 h-8 animate-spin" />
                <span className="text-sm font-semibold">
                  Analisando recibo com Inteligência Artificial...
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  Extraindo valor total, litros e data/hora
                </span>
              </div>
            ) : (
              <>
                <div className="p-3 bg-white dark:bg-[#111926] rounded-full shadow-sm text-emerald-500 group-hover:scale-110 transition-transform">
                  <UploadCloud className="w-6 h-6" />
                </div>
                <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                  Clique para tirar foto ou anexar o recibo
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm">
                  Anexe a foto do cupom fiscal para comprovação e preenchimento automático de Litros e Valor Total.
                </p>
              </>
            )}
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-3 bg-slate-50 dark:bg-[#0b111a] rounded-xl ring-1 ring-slate-200 dark:ring-slate-800">
            <div className="flex items-center gap-3 w-full sm:w-auto">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={receiptImage}
                alt="Recibo"
                className="w-16 h-16 object-cover rounded-lg ring-1 ring-slate-300 dark:ring-slate-700"
              />
              <div className="text-xs space-y-0.5">
                <span className="font-bold text-slate-900 dark:text-white flex items-center gap-1">
                  <FileText className="w-3.5 h-3.5 text-emerald-500" />
                  Foto do Recibo Anexada
                </span>
                <span className="text-slate-500 dark:text-slate-400 block">Dados sincronizados com o formulário</span>
              </div>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={ocrLoading}
                className="text-xs font-semibold px-3 py-2 bg-white dark:bg-[#111926] text-slate-800 dark:text-slate-200 ring-1 ring-slate-200 dark:ring-slate-700 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-1.5"
              >
                <Camera className="w-3.5 h-3.5" />
                Trocar Foto
              </button>
              <button
                type="button"
                aria-label="Remover foto"
                onClick={() => {
                  setReceiptImage(null);
                  setOcrSuccessMsg(null);
                }}
                className="p-2 text-slate-400 hover:text-rose-600 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {ocrSuccessMsg && (
          <div className="flex items-start gap-2 p-3 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-900 dark:text-emerald-200 rounded-xl text-xs">
            <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
            <span>{ocrSuccessMsg}</span>
          </div>
        )}
      </div>

      {feedback && (
        <div
          className={`p-4 rounded-2xl ring-1 ${
            feedback.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/50 ring-emerald-200 dark:ring-emerald-800 text-emerald-900 dark:text-emerald-200'
              : 'bg-rose-50 dark:bg-rose-950/50 ring-rose-200 dark:ring-rose-800 text-rose-900 dark:text-rose-200'
          }`}
        >
          <div className="flex items-center gap-2 font-bold text-sm">
            {feedback.type === 'success' ? (
              <CheckCircle className="w-5 h-5 text-emerald-500" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-rose-500" />
            )}
            <span>{feedback.message}</span>
          </div>
          {feedback.monthlyPerf && (
            <div className="mt-2 text-xs bg-white/80 dark:bg-[#0b111a] p-3 rounded-xl border border-emerald-100 dark:border-emerald-800/50 space-y-1">
              <span className="font-semibold block text-slate-700 dark:text-slate-300">
                Desempenho Acumulado ({feedback.monthlyPerf.periodLabel}):
              </span>
              <p>
                Média Mensal:{' '}
                <strong className="text-emerald-700 dark:text-emerald-400 text-sm">
                  {feedback.monthlyPerf.monthlyAvgKmL > 0
                    ? `${feedback.monthlyPerf.monthlyAvgKmL.toFixed(1).replace('.', ',')} km/L`
                    : '0,0 km/L (primeiro registro do mês)'}
                </strong>
                {' • '}
                Custo de Diesel por KM:{' '}
                <strong className="text-slate-900 dark:text-white text-sm">
                  R$ {feedback.monthlyPerf.fuelCpk.toFixed(2).replace('.', ',')}
                </strong>
              </p>
              {feedback.monthlyPerf.isAnomalous && feedback.monthlyPerf.anomalyMessage && (
                <p className="text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 p-2 rounded-lg font-semibold mt-1">
                  ⚠️ {feedback.monthlyPerf.anomalyMessage}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Formulário Simplificado (Sem is_full_tank) */}
      <form
        onSubmit={handleSubmit}
        className="bg-white dark:bg-[#111926] p-6 rounded-2xl shadow-sm ring-1 ring-slate-200 dark:ring-slate-800 space-y-4"
      >
        {/* 1. Caminhão (Placa) */}
        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
            Caminhão (Placa)
          </label>
          <select
            value={truckId}
            onChange={(e) => handleTruckChange(e.target.value)}
            className="w-full text-base font-semibold p-3.5 bg-slate-50 dark:bg-[#0b111a] text-slate-900 dark:text-slate-100 rounded-xl ring-1 ring-slate-200 dark:ring-slate-700 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
          >
            {trucks.map((t) => (
              <option key={t.id} value={t.id}>
                {t.plate} - {t.model} ({t.currentOdometer.toLocaleString('pt-BR')} km)
              </option>
            ))}
          </select>
        </div>

        {/* Motorista e 2. Data/Hora */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
              Motorista
            </label>
            <select
              value={driverId}
              onChange={(e) => setDriverId(e.target.value)}
              className="w-full text-sm font-medium p-3 bg-slate-50 dark:bg-[#0b111a] text-slate-900 dark:text-slate-100 rounded-xl ring-1 ring-slate-200 dark:ring-slate-700 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            >
              {drivers.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
              Data / Hora
            </label>
            <input
              type="datetime-local"
              required
              value={logDateTime}
              onChange={(e) => setLogDateTime(e.target.value)}
              className="w-full text-sm p-3 bg-slate-50 dark:bg-[#0b111a] text-slate-900 dark:text-slate-100 rounded-xl ring-1 ring-slate-200 dark:ring-slate-700 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
          </div>
        </div>

        {/* 3. Odômetro Atual (km) */}
        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
            Odômetro Atual (km)
          </label>
          <input
            type="number"
            inputMode="numeric"
            required
            value={odometer}
            onChange={(e) => setOdometer(Number(e.target.value))}
            className="w-full text-xl font-bold p-3.5 bg-emerald-50/40 dark:bg-emerald-950/30 rounded-xl ring-1 ring-emerald-200 dark:ring-emerald-800/60 text-emerald-950 dark:text-emerald-200 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            placeholder="Ex: 228500"
          />
        </div>

        {/* 4. Litros Abastecidos & 5. Valor Total (R$) */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
              Litros Abastecidos
            </label>
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0.1"
              required
              value={liters}
              onChange={(e) => setLiters(Number(e.target.value))}
              className="w-full text-base font-bold p-3 bg-slate-50 dark:bg-[#0b111a] text-slate-900 dark:text-slate-100 rounded-xl ring-1 ring-slate-200 dark:ring-slate-700 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              placeholder="Ex: 550"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
              Valor Total (R$)
            </label>
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0.01"
              required
              value={totalAmount}
              onChange={(e) => setTotalAmount(Number(e.target.value))}
              className="w-full text-base font-bold p-3 bg-slate-50 dark:bg-[#0b111a] text-slate-900 dark:text-slate-100 rounded-xl ring-1 ring-slate-200 dark:ring-slate-700 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              placeholder="Ex: 3272.50"
            />
          </div>
        </div>

        {/* Card de Total e Preço Médio por Litro Derivado */}
        <div className="bg-slate-900 dark:bg-[#0b111a] border border-emerald-500/20 text-white p-4 rounded-xl flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-400 block">Valor Total do Abastecimento</span>
            <span className="text-xs text-slate-400">
              Preço derivado: R$ {pricePerLiter.toFixed(3).replace('.', ',')} / L
            </span>
          </div>
          <span className="text-2xl font-bold text-emerald-400">{formatBRL(totalAmount)}</span>
        </div>

        <button
          type="submit"
          disabled={submitting || ocrLoading}
          className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-extrabold text-base p-4 rounded-xl shadow-lg shadow-emerald-500/25 transition-all flex items-center justify-center gap-2 active:scale-98 disabled:opacity-50"
        >
          {submitting ? (
            <span>Salvando dados no banco...</span>
          ) : (
            <>
              <Check className="w-5 h-5" />
              <span>CONFIRMAR ABASTECIMENTO</span>
            </>
          )}
        </button>
      </form>

      {/* Histórico Recente de Abastecimentos para conferência rápida */}
      {fuelLogs.length > 0 && (
        <div className="bg-white dark:bg-[#111926] p-5 rounded-2xl shadow-sm ring-1 ring-slate-200 dark:ring-slate-800 space-y-3">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            Últimos Abastecimentos Registrados ({fuelLogs.length})
          </h3>
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {fuelLogs.slice(0, 15).map((log) => {
              const t = trucks.find((x) => x.id === log.truckId);
              const d = drivers.find((x) => x.id === log.driverId);
              return (
                <div
                  key={log.id}
                  className="py-3 flex flex-wrap items-center justify-between gap-2 text-xs"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-slate-100">
                      <span className="bg-slate-900 dark:bg-emerald-500/20 text-white dark:text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded">
                        {t?.plate ?? 'Caminhão'}
                      </span>
                      <span>{log.liters.toLocaleString('pt-BR')} L</span>
                      <span>• {log.odometer.toLocaleString('pt-BR')} km</span>
                    </div>
                    <div className="text-slate-500 dark:text-slate-400">
                      {formatDate(log.date)} • Motorista: {d?.name ?? '—'} • {log.gasStationName}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <strong className="text-sm text-emerald-700 dark:text-emerald-400">
                      {formatBRL(log.totalAmount)}
                    </strong>
                    {onRemoveLog && (
                      <button
                        type="button"
                        onClick={() =>
                          confirm('Excluir este lançamento de abastecimento?') &&
                          onRemoveLog(log.id)
                        }
                        className="p-1.5 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-lg"
                        title="Excluir abastecimento"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
