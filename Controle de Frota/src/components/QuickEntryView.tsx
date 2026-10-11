'use client';

import React, { useState } from 'react';
import { Fuel, CheckCircle, AlertTriangle, Check } from 'lucide-react';
import { Truck, Driver, FuelLog } from '@/types';
import { calculateFuelConsumption } from '@/lib/calc';

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
  const [arlaPricePerLiter, setArlaPricePerLiter] = useState<number>(4.50);
  const [isFullTank, setIsFullTank] = useState<boolean>(true);
  const [gasStationName, setGasStationName] = useState<string>('Posto Graal Rodovia');
  const [submitting, setSubmitting] = useState<boolean>(false);
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
      setOdometer(selected.currentOdometer + 1500); // Sugestão inteligente de odômetro após viagem
    }
  };

  const totalFuelAmount = Number((liters * pricePerLiter).toFixed(2));
  const totalArlaAmount = Number((arlaLiters * arlaPricePerLiter).toFixed(2));
  const totalGeral = Number((totalFuelAmount + totalArlaAmount).toFixed(2));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setFeedback(null);

    try {
      const payload = {
        truckId,
        driverId,
        date: new Date().toISOString(),
        odometer: Number(odometer),
        fuelType: 'DIESEL_S10',
        liters: Number(liters),
        pricePerLiter: Number(pricePerLiter),
        totalAmount: totalFuelAmount,
        arlaLiters: Number(arlaLiters),
        arlaAmount: totalArlaAmount,
        isFullTank: Boolean(isFullTank),
        gasStationName,
        receiptPhotoUrl: null,
      };

      const newLog: FuelLog = {
        id: crypto.randomUUID(),
        ...payload,
        fuelType: 'DIESEL_S10',
        createdAt: new Date().toISOString(),
      };

      // Análise de consumo (tanque cheio) considerando o histórico do caminhão
      const history = [...fuelLogs.filter((l) => l.truckId === truckId), newLog];
      const analysis = calculateFuelConsumption(history).find((c) => c.logId === newLog.id);

      const saved = await onSubmitLog(newLog);
      if (!saved) {
        throw new Error('Não foi possível salvar o abastecimento no banco. Veja o aviso no topo da página.');
      }

      setFeedback({
        type: 'success',
        message: 'Abastecimento registrado com sucesso!',
        analysis,
      });

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
    <div className="max-w-xl mx-auto space-y-6">
      {/* Header Mobile Friendly */}
      <div className="bg-sky-600 p-6 rounded-2xl text-white shadow-md text-center sm:text-left">
        <div className="inline-flex p-3 bg-sky-500/50 rounded-2xl mb-2">
          <Fuel className="w-8 h-8 text-white" />
        </div>
        <h2 className="text-xl font-bold">Lançamento Rápido no Posto</h2>
        <p className="text-xs text-sky-100 mt-1">
          Interface otimizada para celular. Preencha em menos de 30 segundos após abastecer.
        </p>
      </div>

      {feedback && (
        <div
          className={`p-4 rounded-2xl border ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-rose-50 border-rose-200 text-rose-900'
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
                  {feedback.analysis.averageKmL ? `${feedback.analysis.averageKmL} km/L` : 'Base inicial definida'}
                </strong>
              </p>
              {feedback.analysis.isDistorted && (
                <p className="text-amber-700 font-bold mt-1">⚠️ {feedback.analysis.message}</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Formulário Mobile com botões e campos grandes */}
      <form onSubmit={handleSubmit} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        {/* Escolha do Caminhão */}
        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
            Caminhão (Placa / Modelo)
          </label>
          <select
            value={truckId}
            onChange={(e) => handleTruckChange(e.target.value)}
            className="w-full text-base font-semibold p-3.5 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-sky-500 focus:outline-none"
          >
            {trucks.map((t) => (
              <option key={t.id} value={t.id}>
                {t.plate} - {t.model} ({t.currentOdometer.toLocaleString()} km)
              </option>
            ))}
          </select>
        </div>

        {/* Escolha do Motorista */}
        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
            Motorista Responsável
          </label>
          <select
            value={driverId}
            onChange={(e) => setDriverId(e.target.value)}
            className="w-full text-sm font-medium p-3 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-sky-500 focus:outline-none"
          >
            {drivers.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name} (CNH {d.cnhCategory})
              </option>
            ))}
          </select>
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
            className="w-full text-xl font-bold p-3.5 bg-sky-50/50 border border-sky-300 rounded-xl text-sky-950 focus:ring-2 focus:ring-sky-500 focus:outline-none"
            placeholder="Ex: 228500"
          />
        </div>

        {/* Chave Crucial: Tanque Cheio? */}
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
          <label className="flex items-center justify-between cursor-pointer">
            <div>
              <span className="font-bold text-sm text-slate-900 block">Completou até a boca (Tanque Cheio)?</span>
              <span className="text-xs text-slate-500">
                Obrigatório para o cálculo exato de consumo médio (km/L)
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
              className="w-full text-base font-bold p-3 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-sky-500 focus:outline-none"
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
              className="w-full text-base font-bold p-3 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-sky-500 focus:outline-none"
              placeholder="Ex: 5.95"
            />
          </div>
        </div>

        {/* Arla 32 (Opcional ou habitual) */}
        <div className="grid grid-cols-2 gap-3 pt-2">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Litros Arla 32
            </label>
            <input
              type="number"
              step="0.01"
              value={arlaLiters}
              onChange={(e) => setArlaLiters(Number(e.target.value))}
              className="w-full text-sm p-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-sky-500 focus:outline-none"
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
              className="w-full text-sm p-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-sky-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Nome do Posto */}
        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
            Nome do Posto / Cidade
          </label>
          <input
            type="text"
            required
            value={gasStationName}
            onChange={(e) => setGasStationName(e.target.value)}
            className="w-full text-sm p-3 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-sky-500 focus:outline-none"
            placeholder="Ex: Posto Graal Roseira Dutra"
          />
        </div>

        {/* Card de Total Calculado */}
        <div className="bg-slate-900 text-white p-4 rounded-xl flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-400 block">Valor Total do Cupom</span>
            <span className="text-xs text-slate-400">Diesel + Arla 32</span>
          </div>
          <span className="text-2xl font-bold text-emerald-400">
            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalGeral)}
          </span>
        </div>

        {/* Botão de Envio Grande */}
        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-base p-4 rounded-xl shadow-lg shadow-emerald-600/30 transition-all flex items-center justify-center gap-2 active:scale-98 disabled:opacity-50"
        >
          {submitting ? (
            <span>Salvando dados...</span>
          ) : (
            <>
              <Check className="w-6 h-6" />
              <span>CONFIRMAR ABASTECIMENTO</span>
            </>
          )}
        </button>
      </form>
    </div>
  );
};
