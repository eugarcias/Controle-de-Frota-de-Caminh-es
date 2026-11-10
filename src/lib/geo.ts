export const BR_STATES = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA',
  'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
] as const;

/**
 * Extrai cidade e UF de textos como "Belo Horizonte - MG" ou "Santos - SP (Porto)".
 * Retorna null quando não consegue identificar uma UF válida.
 */
export function splitDestination(text: string): { city: string; state: string } | null {
  const m = text.match(/^(.+?)\s*[-–/,]\s*([A-Za-z]{2})\b/);
  if (!m) return null;
  const state = m[2].toUpperCase();
  if (!(BR_STATES as readonly string[]).includes(state)) return null;
  return { city: m[1].trim(), state };
}

/** Rótulo de rota para agrupamentos: "Santos/SP"; registros antigos caem no texto livre. */
export function routeLabel(t: { destinationCity?: string; destinationState?: string; destination: string }) {
  if (t.destinationCity && t.destinationState) return `${t.destinationCity}/${t.destinationState}`;
  const parsed = splitDestination(t.destination);
  return parsed ? `${parsed.city}/${parsed.state}` : t.destination;
}
