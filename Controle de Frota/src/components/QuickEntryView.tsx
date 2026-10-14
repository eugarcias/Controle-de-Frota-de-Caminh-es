'use client';

import React, { useState, useRef } from 'react';
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
  Info,
} from 'lucide-react';
import { Truck, Driver, FuelLog } from '@/types';
import { calculateFuelConsumption } from '@/lib/calc';
import { formatBRL } from '@/components/ui';

interface QuickEntryViewProps {
  trucks: Truck[];
  drivers: Driver[];
  fuelLogs: FuelLog[];
  onSubmitLog: (newLog: FuelLog) => Promise<unknown>;
}

export const QuickEntryView: React.FC<QuickEntryViewProps> = ({
  trucks,
  drivers,
  fuelLogs,
  onSubmitLog,
}) => {
  const [truckId, setTruckId] = useState(trucks[0]?.id || '');
  const [driverId, setDriverId] = useState(drivers[0]?.id || '');
  const [odometer, setOdometer] = useState<number>(trucks[0]?.currentOdometer || 0);
  const [liters, setLiters] = useState<number>(550);
  const [pricePerLiter, setPricePerLiter] = useState<number>(5.95);
  const [arlaLiters, setArlaLiters] = useState<number>(40);
  const [arlaPricePerLiter, setArlaPricePerLiter] = useState<number>(4.5);
  const [isFullTank, setIsFullTank] = useState<boolean>(true);
  const [gasStationName, setGasStationName] = useState<string>('Posto Graal Rodovia');
  const [logDate, setLogDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Estados do OCR com IA
  const [ocrLoading, setOcrLoading] = useState<boolean>(false);
  const [receiptImage, setReceiptImage] = useState<string | null>(null);
  const [ocrSuccessMsg, setOcrSuccessMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
    analysis?: any;
  } | null>(null);

  // Seleciona caminhão e atualiza hodômetro de referência
  const handleTruckChange = (id: string) => {
    setTruckId(id);
    const selected = trucks.find((t) => t.id === id);
    if (selected) {
      setOdometer(selected.currentOdometer + 1500); // Sugestão inteligente
    }
  };

  const totalFuelAmount = Number((liters * pricePerLiter).toFixed(2));
  const totalArlaAmount = Number((arlaLiters * arlaPricePerLiter).toFixed(2));
  const totalGeral = Number((totalFuelAmount + totalArlaAmount).toFixed(2));

  // Handler de upload e leitura de Nota Fiscal por IA
  const handleFileUpload = async (file: File) => {
    if (!file) return;

    setOcrLoading(true);
    setOcrSuccessMsg(null);
    setFeedback(null);

    try {
      // Cria preview da imagem
      const reader = new FileReader();
      reader.onload = (e) => {
        setReceiptImage(e.target?.result as string);
      };
      reader.readAsDataURL(file);

      // Envia para o backend /api/ocr-fuel
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

      // Preenchimento automático dos inputs com os dados retornados pela IA
      if (data.gasStationName) setGasStationName(data.gasStationName);
      if (data.liters && Number(data.liters) > 0) setLiters(Number(data.liters));
      if (data.pricePerLiter && Number(data.pricePerLiter) > 0)
        setPricePerLiter(Number(data.pricePerLiter));
      if (data.arlaLiters !== undefined) setArlaLiters(Number(data.arlaLiters));
      if (data.arlaPricePerLiter !== undefined)
        setArlaPricePerLiter(Number(data.arlaPricePerLiter));
      if (data.date) setLogDate(data.date.slice(0, 10));
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
      const payload = {
        truckId,
        driverId,
        date: `${logDate}T12:00:00.000Z`,
        odometer: Number(odometer),
        fuelType: 'DIESEL_S10' as const,
        liters: Number(liters),
        pricePerLiter: Number(pricePerLiter),
        totalAmount: totalFuelAmount,
        arlaLiters: Number(arlaLiters),
        arlaAmount: totalArlaAmount,
        isFullTank: Boolean(isFullTank),
        gasStationName,
        receiptPhotoUrl: receiptImage || null,
      };

      const newLog: FuelLog = {
        id: crypto.randomUUID(),
        ...payload,
        createdAt: new Date().toISOString(),
      };

      // Análise de consumo (tanque cheio) considerando o histórico do caminhão
      const history = [...fuelLogs.filter((l) => l.truckId === truckId), newLog];
      const analysis = calculateFuelConsumption(history).find((c) => c.logId === newLog.id);

      const saved = await onSubmitLog(newLog);
      if (!saved) {
        throw new Error(
          'Não foi possível salvar o abastecimento no banco. Veja o aviso no topo da página.'
        );
      }

      setFeedback({
        type: 'success',
        message: 'Abastecimento registrado com sucesso!',
        analysis,
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
                Fotografe o cupom para preenchimento automático com Inteligência Artificial.
              </p>
            </div>
          </div>
          <span className="self-start sm:self-auto text-[11px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-950/60 px-2.5 py-1 rounded-full border border-emerald-800">
            IA Multimodal
          </span>
        </div>
      </div>

      {/* Componente de Upload de Nota Fiscal com IA (OCR) */}
      <div className="bg-white p-5 rounded-2xl shadow-sm ring-1 ring-slate-200 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-sky-600" />
            <h3 className="text-sm font-bold text-slate-900">
              Leitura Inteligente de Nota Fiscal (OCR)
            </h3>
          </div>
          <span className="text-[11px] text-slate-500">Gemini / GPT-4o</span>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFileUpload(f);
          }}
        />

        {!receiptImage ? (
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-slate-300 hover:border-sky-500 bg-slate-50/60 hover:bg-sky-50/30 p-6 rounded-2xl text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-2 group"
          >
            {ocrLoading ? (
              <div className="py-4 flex flex-col items-center gap-2 text-sky-700">
                <Loader2 className="w-8 h-8 animate-spin" />
                <span className="text-sm font-semibold">
                  Analisando nota fiscal com Inteligência Artificial...
                </span>
                <span className="text-xs text-slate-500">
                  Extraindo valor, litros, data e posto
                </span>
              </div>
            ) : (
              <>
                <div className="p-3 bg-white rounded-full shadow-sm text-sky-600 group-hover:scale-110 transition-transform">
                  <UploadCloud className="w-6 h-6" />
                </div>
                <div className="text-sm font-semibold text-slate-800">
                  Clique para tirar foto ou selecionar imagem do cupom
                </div>
                <p className="text-xs text-slate-500 max-w-sm">
                  A IA lerá os dados da bomba (Posto, Litros, Preço por Litro e Total) e preencherá
                  o formulário automaticamente.
                </p>
              </>
            )}
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-3 bg-slate-50 rounded-xl ring-1 ring-slate-200">
            <div className="flex items-center gap-3 w-full sm:w-auto">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={receiptImage}
                alt="Nota Fiscal"
                className="w-16 h-16 object-cover rounded-lg ring-1 ring-slate-300"
              />
              <div className="text-xs space-y-0.5">
                <span className="font-bold text-slate-900 block flex items-center gap-1">
                  <FileText className="w-3.5 h-3.5 text-emerald-600" />
                  Cupom Fiscal Carregado
                </span>
                <span className="text-slate-500 block">Dados extraídos para os campos</span>
              </div>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={ocrLoading}
                className="text-xs font-semibold px-3 py-2 bg-white ring-1 ring-slate-200 rounded-lg hover:bg-slate-100 flex items-center gap-1.5"
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
          <div className="flex items-start gap-2 p-3 bg-emerald-50 text-emerald-900 rounded-xl text-xs">
            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <span>{ocrSuccessMsg}</span>
          </div>
        )}
      </div>

      {feedback && (
        <div
          className={`p-4 rounded-2xl ring-1 ${
            feedback.type === 'success'
              ? 'bg-emerald-50 ring-emerald-200 text-emerald-900'
              : 'bg-rose-50 ring-rose-200 text-rose-900'
          }`}
        >
          <div className="flex items-center gap-2 font-bold text-sm">
            {feedback.type === 'success' ? (
              <CheckCircle className="w-5 h-5 text-emerald-600" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-rose-600" />
            )}
            <span>{feedback.message}</span>
          </div>
          {feedback.analysis && (
            <div className="mt-2 text-xs bg-white/80 p-3 rounded-xl border border-emerald-100">
              <span className="font-semibold block text-slate-700">Resultado do Tanque Cheio:</span>
              <p className="mt-0.5">
                Média calculada:{' '}
                <strong className="text-emerald-700 text-sm">
                  {feedback.analysis.averageKmL
                    ? `${feedback.analysis.averageKmL} km/L`
                    : 'Base inicial definida'}
                </strong>
              </p>
              {feedback.analysis.isDistorted && (
                <p className="text-amber-700 font-bold mt-1">⚠️ {feedback.analysis.message}</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Formulário com Alvos de Toque Mobile */}
      <form
        onSubmit={handleSubmit}
        className="bg-white p-6 rounded-2xl shadow-sm ring-1 ring-slate-200 space-y-4"
      >
        {/* Escolha do Caminhão */}
        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
            Caminhão (Placa / Modelo)
          </label>
          <select
            value={truckId}
            onChange={(e) => handleTruckChange(e.target.value)}
            className="w-full text-base font-semibold p-3.5 bg-slate-50 rounded-xl ring-1 ring-slate-200 focus:ring-2 focus:ring-sky-500 focus:outline-none"
          >
            {trucks.map((t) => (
              <option key={t.id} value={t.id}>
                {t.plate} - {t.model} ({t.currentOdometer.toLocaleString()} km)
              </option>
            ))}
          </select>
        </div>

        {/* Escolha do Motorista e Data */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
              Motorista Responsável
            </label>
            <select
              value={driverId}
              onChange={(e) => setDriverId(e.target.value)}
              className="w-full text-sm font-medium p-3 bg-slate-50 rounded-xl ring-1 ring-slate-200 focus:ring-2 focus:ring-sky-500 focus:outline-none"
            >
              {drivers.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} {d.cnhCategory ? `(CNH ${d.cnhCategory})` : ''}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
              Data do Abastecimento
            </label>
            <input
              type="date"
              required
              value={logDate}
              onChange={(e) => setLogDate(e.target.value)}
              className="w-full text-sm p-3 bg-slate-50 rounded-xl ring-1 ring-slate-200 focus:ring-2 focus:ring-sky-500 focus:outline-none"
            />
          </div>
        </div>

        {/* KM no Painel (Hodômetro Atual) */}
        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
            KM no Painel (Hodômetro)
          </label>
          <input
            type="number"
            required
            value={odometer}
            onChange={(e) => setOdometer(Number(e.target.value))}
            className="w-full text-xl font-bold p-3.5 bg-sky-50/40 rounded-xl ring-1 ring-sky-200 text-sky-950 focus:ring-2 focus:ring-sky-500 focus:outline-none"
            placeholder="Ex: 228500"
          />
        </div>

        {/* Chave: Tanque Cheio? */}
        <div className="bg-slate-50 p-4 rounded-xl ring-1 ring-slate-200">
          <label className="flex items-center justify-between cursor-pointer">
            <div>
              <span className="font-bold text-sm text-slate-900 block">
                Completou até a boca (Tanque Cheio)?
              </span>
              <span className="text-xs text-slate-500">
                Obrigatório para cálculo exato de consumo médio (km/L)
              </span>
            </div>
            <input
              type="checkbox"
              checked={isFullTank}
              onChange={(e) => setIsFullTank(e.target.checked)}
              className="w-6 h-6 text-sky-600 rounded focus:ring-sky-500 accent-sky-600 cursor-pointer"
            />
          </label>
        </div>

        {/* Litros Diesel & Preço por Litro */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
              Litros Diesel
            </label>
            <input
              type="number"
              step="0.01"
              required
              value={liters}
              onChange={(e) => setLiters(Number(e.target.value))}
              className="w-full text-base font-bold p-3 bg-slate-50 rounded-xl ring-1 ring-slate-200 focus:ring-2 focus:ring-sky-500 focus:outline-none"
              placeholder="Ex: 550"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
              Preço / Litro (R$)
            </label>
            <input
              type="number"
              step="0.001"
              required
              value={pricePerLiter}
              onChange={(e) => setPricePerLiter(Number(e.target.value))}
              className="w-full text-base font-bold p-3 bg-slate-50 rounded-xl ring-1 ring-slate-200 focus:ring-2 focus:ring-sky-500 focus:outline-none"
              placeholder="Ex: 5.95"
            />
          </div>
        </div>

        {/* Arla 32 */}
        <div className="grid grid-cols-2 gap-3 pt-1">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Litros Arla 32
            </label>
            <input
              type="number"
              step="0.01"
              value={arlaLiters}
              onChange={(e) => setArlaLiters(Number(e.target.value))}
              className="w-full text-sm p-2.5 bg-slate-50 rounded-xl ring-1 ring-slate-200 focus:ring-2 focus:ring-sky-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Preço Arla / Litro (R$)
            </label>
            <input
              type="number"
              step="0.01"
              value={arlaPricePerLiter}
              onChange={(e) => setArlaPricePerLiter(Number(e.target.value))}
              className="w-full text-sm p-2.5 bg-slate-50 rounded-xl ring-1 ring-slate-200 focus:ring-2 focus:ring-sky-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Nome do Posto */}
        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
            Nome do Posto / Rodovia
          </label>
          <input
            type="text"
            required
            value={gasStationName}
            onChange={(e) => setGasStationName(e.target.value)}
            className="w-full text-sm p-3 bg-slate-50 rounded-xl ring-1 ring-slate-200 focus:ring-2 focus:ring-sky-500 focus:outline-none"
            placeholder="Ex: Posto Graal Roseira Dutra"
          />
        </div>

        {/* Card de Total Calculado */}
        <div className="bg-slate-900 text-white p-4 rounded-xl flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-400 block">Total do Cupom Fiscal</span>
            <span className="text-xs text-slate-400">Diesel + Arla 32</span>
          </div>
          <span className="text-2xl font-bold text-emerald-400">{formatBRL(totalGeral)}</span>
        </div>

        {/* Botão de Envio Grande Mobile */}
        <button
          type="submit"
          disabled={submitting || ocrLoading}
          className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-base p-4 rounded-xl shadow-lg shadow-emerald-600/25 transition-all flex items-center justify-center gap-2 active:scale-98 disabled:opacity-50"
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
    </div>
  );
};
