/**
 * Camada de pedágios — pronta para plugar uma API real (Google Routes API / TollGuru).
 * Hoje usa um provedor "manual" (retorna 0 e sinaliza que precisa ser informado).
 * Para integrar: implemente `TollProvider` e troque `activeTollProvider`.
 */
export interface TollQuery {
  originCity: string;
  destinationCity: string;
  distanceKm: number;
  axles: number; // eixos do conjunto (ex.: 6 para carreta)
}

export interface TollEstimate {
  amount: number;
  source: 'manual' | 'google-routes' | 'tollguru';
  /** true quando o valor é só um placeholder e o usuário deve informar. */
  needsManualInput: boolean;
}

export interface TollProvider {
  estimate(q: TollQuery): Promise<TollEstimate>;
}

export const manualTollProvider: TollProvider = {
  async estimate() {
    return { amount: 0, source: 'manual', needsManualInput: true };
  },
};

/* Exemplo de futura integração (TollGuru):
export const tollGuruProvider: TollProvider = {
  async estimate(q) {
    const res = await fetch('https://apis.tollguru.com/toll/v2/origin-destination-waypoints', {
      method: 'POST',
      headers: { 'x-api-key': process.env.TOLLGURU_API_KEY!, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: { address: q.originCity }, to: { address: q.destinationCity }, vehicle: { type: '6AxlesTruck' } }),
    });
    const data = await res.json();
    return { amount: data.routes?.[0]?.costs?.tag ?? 0, source: 'tollguru', needsManualInput: false };
  },
};
*/

export const activeTollProvider: TollProvider = manualTollProvider;
