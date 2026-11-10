import { Truck, Driver, FuelLog, MaintenanceLog, FreightTrip, DashboardMetrics, MaintenanceAlert } from './types';
import {
  calculateCumulativeFuelStats,
  calculateTruckMonthlyHistory,
  calculateCPK,
  checkMaintenanceAlerts,
  evaluateMonthlyAnomaly,
  formatPeriodLabel,
} from './lib/calc';

export const mockTrucks: Truck[] = [
  {
    id: '11111111-1111-1111-1111-111111111111',
    plate: 'LBQ-2G04',
    model: 'EDC',
    brand: 'Volvo',
    year: 1998,
    tankCapacityLiters: 600,
    initialOdometer: 0,
    currentOdometer: 0,
    status: 'ATIVO',
    createdAt: '2026-10-26T23:21:18.277Z',
  },
  {
    id: '22222222-2222-2222-2222-222222222222',
    plate: 'IKZ-0F94',
    model: 'NH 380',
    brand: 'Volvo',
    year: 2004,
    tankCapacityLiters: 600,
    initialOdometer: 0,
    currentOdometer: 0,
    status: 'ATIVO',
    createdAt: '2026-10-26T23:21:20.041Z',
  },
  {
    id: '33333333-3333-3333-3333-333333333333',
    plate: 'MMO-0E20',
    model: 'FH 420',
    brand: 'Volvo',
    year: 2008,
    tankCapacityLiters: 700,
    initialOdometer: 0,
    currentOdometer: 0,
    status: 'ATIVO',
    createdAt: '2026-10-26T23:21:21.677Z',
  },
];

export const mockDrivers: Driver[] = [
  {
    id: 'd1111111-1111-1111-1111-111111111111',
    name: 'Carlos Alberto Silva',
    cnhNumber: '04829103948',
    cnhCategory: 'E',
    phone: '(19) 99821-4433',
    status: 'ATIVO',
  },
  {
    id: 'd2222222-2222-2222-2222-222222222222',
    name: 'José Roberto de Souza',
    cnhNumber: '03719284711',
    cnhCategory: 'E',
    phone: '(41) 98712-3399',
    status: 'ATIVO',
  },
  {
    id: 'd3333333-3333-3333-3333-333333333333',
    name: 'Marcos Vinicius Pereira',
    cnhNumber: '05521948293',
    cnhCategory: 'E',
    phone: '(31) 99422-7711',
    status: 'ATIVO',
  },
];

export const mockFuelLogs: FuelLog[] = [
  // VSM-3801 (Scania R450) — Set/2026: 4.900 km / 1.970 L = 2,49 km/L
  {
    id: 'f-101',
    truckId: '11111111-1111-1111-1111-111111111111',
    driverId: 'd1111111-1111-1111-1111-111111111111',
    date: '2026-09-02T08:30:00.000Z',
    odometer: 221000,
    fuelType: 'DIESEL_S10',
    liters: 620,
    pricePerLiter: 5.89,
    totalAmount: 3651.8,
    arlaLiters: 40,
    arlaAmount: 180.0,
    gasStationName: 'Posto Graal Rodovia dos Bandeirantes',
    createdAt: '2026-09-02T08:30:00.000Z',
  },
  {
    id: 'f-102',
    truckId: '11111111-1111-1111-1111-111111111111',
    driverId: 'd1111111-1111-1111-1111-111111111111',
    date: '2026-09-12T14:20:00.000Z',
    odometer: 223200,
    fuelType: 'DIESEL_S10',
    liters: 650,
    pricePerLiter: 5.92,
    totalAmount: 3848.0,
    arlaLiters: 0,
    arlaAmount: 0,
    gasStationName: 'Posto Sakamoto Dutra SP',
    createdAt: '2026-09-12T14:20:00.000Z',
  },
  {
    id: 'f-103',
    truckId: '11111111-1111-1111-1111-111111111111',
    driverId: 'd1111111-1111-1111-1111-111111111111',
    date: '2026-09-22T19:00:00.000Z',
    odometer: 225900,
    fuelType: 'DIESEL_S10',
    liters: 700,
    pricePerLiter: 5.95,
    totalAmount: 4165.0,
    arlaLiters: 50,
    arlaAmount: 225.0,
    gasStationName: 'Posto Arco-Íris Roseira',
    createdAt: '2026-09-22T19:00:00.000Z',
  },
  // VSM-3801 — Out/2026: 2.500 km / 1.050 L = 2,38 km/L
  {
    id: 'f-104',
    truckId: '11111111-1111-1111-1111-111111111111',
    driverId: 'd1111111-1111-1111-1111-111111111111',
    date: '2026-10-02T11:15:00.000Z',
    odometer: 226000,
    fuelType: 'DIESEL_S10',
    liters: 500,
    pricePerLiter: 5.99,
    totalAmount: 2995.0,
    arlaLiters: 45,
    arlaAmount: 202.5,
    gasStationName: 'Auto Posto Maranello Betim',
    createdAt: '2026-10-02T11:15:00.000Z',
  },
  {
    id: 'f-105',
    truckId: '11111111-1111-1111-1111-111111111111',
    driverId: 'd1111111-1111-1111-1111-111111111111',
    date: '2026-10-18T15:40:00.000Z',
    odometer: 228500,
    fuelType: 'DIESEL_S10',
    liters: 550,
    pricePerLiter: 6.01,
    totalAmount: 3305.5,
    arlaLiters: 40,
    arlaAmount: 180.0,
    gasStationName: 'Posto Graal Campinas',
    createdAt: '2026-10-18T15:40:00.000Z',
  },

  // VSM-5402 (Volvo FH 540) — Set/2026: 4.200 km / 1.900 L = 2,21 km/L
  {
    id: 'f-201',
    truckId: '22222222-2222-2222-2222-222222222222',
    driverId: 'd2222222-2222-2222-2222-222222222222',
    date: '2026-09-03T09:00:00.000Z',
    odometer: 156000,
    fuelType: 'DIESEL_S10',
    liters: 920,
    pricePerLiter: 5.88,
    totalAmount: 5409.6,
    arlaLiters: 60,
    arlaAmount: 270.0,
    gasStationName: 'Posto Pelanda Curitiba PR',
    createdAt: '2026-09-03T09:00:00.000Z',
  },
  {
    id: 'f-202',
    truckId: '22222222-2222-2222-2222-222222222222',
    driverId: 'd2222222-2222-2222-2222-222222222222',
    date: '2026-09-18T16:45:00.000Z',
    odometer: 160200,
    fuelType: 'DIESEL_S10',
    liters: 980,
    pricePerLiter: 5.93,
    totalAmount: 5811.4,
    arlaLiters: 65,
    arlaAmount: 292.5,
    gasStationName: 'Posto Sinuelo Araquari SC',
    createdAt: '2026-09-18T16:45:00.000Z',
  },
  // VSM-5402 — Out/2026: 3.800 km / 1.720 L = 2,21 km/L
  {
    id: 'f-203',
    truckId: '22222222-2222-2222-2222-222222222222',
    driverId: 'd2222222-2222-2222-2222-222222222222',
    date: '2026-10-04T08:10:00.000Z',
    odometer: 160400,
    fuelType: 'DIESEL_S10',
    liters: 840,
    pricePerLiter: 5.98,
    totalAmount: 5023.2,
    arlaLiters: 60,
    arlaAmount: 270.0,
    gasStationName: 'Posto Buffon Canoas RS',
    createdAt: '2026-10-04T08:10:00.000Z',
  },
  {
    id: 'f-204',
    truckId: '22222222-2222-2222-2222-222222222222',
    driverId: 'd2222222-2222-2222-2222-222222222222',
    date: '2026-10-21T10:30:00.000Z',
    odometer: 164200,
    fuelType: 'DIESEL_S10',
    liters: 880,
    pricePerLiter: 6.0,
    totalAmount: 5280.0,
    arlaLiters: 55,
    arlaAmount: 247.5,
    gasStationName: 'Posto Pelanda Curitiba PR',
    createdAt: '2026-10-21T10:30:00.000Z',
  },

  // VSM-2803 (Mercedes Actros) — Anomalia (< 2,0 km/L com > 1.000 km rodados no mês: ~1,65 km/L)
  {
    id: 'f-301',
    truckId: '33333333-3333-3333-3333-333333333333',
    driverId: 'd3333333-3333-3333-3333-333333333333',
    date: '2026-09-05T07:10:00.000Z',
    odometer: 322000,
    fuelType: 'DIESEL_S10',
    liters: 850,
    pricePerLiter: 5.91,
    totalAmount: 5023.5,
    arlaLiters: 50,
    arlaAmount: 225.0,
    gasStationName: 'Posto Décio Rio Verde GO',
    createdAt: '2026-09-05T07:10:00.000Z',
  },
  {
    id: 'f-302',
    truckId: '33333333-3333-3333-3333-333333333333',
    driverId: 'd3333333-3333-3333-3333-333333333333',
    date: '2026-09-25T17:40:00.000Z',
    odometer: 324800,
    fuelType: 'DIESEL_S10',
    liters: 850, // Set/2026: 2.800 km / 1.700 L = 1,65 km/L (< 2,0 km/L e > 1.000 km -> ALERTA!)
    pricePerLiter: 5.97,
    totalAmount: 5074.5,
    arlaLiters: 45,
    arlaAmount: 202.5,
    gasStationName: 'Posto Trevão Itumbiara GO',
    createdAt: '2026-09-25T17:40:00.000Z',
  },
  {
    id: 'f-303',
    truckId: '33333333-3333-3333-3333-333333333333',
    driverId: 'd3333333-3333-3333-3333-333333333333',
    date: '2026-10-05T12:00:00.000Z',
    odometer: 325000,
    fuelType: 'DIESEL_S10',
    liters: 820,
    pricePerLiter: 6.02,
    totalAmount: 4936.4,
    arlaLiters: 50,
    arlaAmount: 225.0,
    gasStationName: 'Auto Posto Alvorada Uberlândia MG',
    createdAt: '2026-10-05T12:00:00.000Z',
  },
  {
    id: 'f-304',
    truckId: '33333333-3333-3333-3333-333333333333',
    driverId: 'd3333333-3333-3333-3333-333333333333',
    date: '2026-10-22T18:15:00.000Z',
    odometer: 327800,
    fuelType: 'DIESEL_S10',
    liters: 830, // Out/2026: 2.800 km / 1.650 L = 1,70 km/L (< 2,0 km/L e > 1.000 km -> ALERTA!)
    pricePerLiter: 6.04,
    totalAmount: 5013.2,
    arlaLiters: 45,
    arlaAmount: 202.5,
    gasStationName: 'Posto Décio Uberlândia MG',
    createdAt: '2026-10-22T18:15:00.000Z',
  },
];

export const mockMaintenanceLogs: MaintenanceLog[] = [
  {
    id: 'm-101',
    truckId: '11111111-1111-1111-1111-111111111111',
    date: '2026-07-15T09:00:00.000Z',
    odometerAtService: 209000,
    type: 'PREVENTIVA',
    category: 'OLEO_FILTROS',
    description: 'Troca de óleo do motor 15W40 + filtros de combustível, lubrificante e sedimentador.',
    partsCost: 3100.0,
    laborCost: 450.0,
    totalCost: 3550.0,
    supplierName: 'Scania Quinta Roda Campinas',
    nextServiceOdometerAlert: 229000,
    createdAt: '2026-07-15T09:00:00.000Z',
  },
  {
    id: 'm-201',
    truckId: '22222222-2222-2222-2222-222222222222',
    date: '2026-08-10T10:30:00.000Z',
    odometerAtService: 150000,
    type: 'PREVENTIVA',
    category: 'FREIOS',
    description: 'Troca de pastilhas de freio disco eixo dianteiro e tração, revisão das cuícas.',
    partsCost: 4800.0,
    laborCost: 900.0,
    totalCost: 5700.0,
    supplierName: 'Volvo Dipesul Curitiba',
    nextServiceOdometerAlert: 180000,
    createdAt: '2026-08-10T10:30:00.000Z',
  },
  {
    id: 'm-301',
    truckId: '33333333-3333-3333-3333-333333333333',
    date: '2026-05-20T14:00:00.000Z',
    odometerAtService: 307000,
    type: 'PREVENTIVA',
    category: 'OLEO_FILTROS',
    description: 'Troca de óleo e filtros da Mercedes Actros',
    partsCost: 3400.0,
    laborCost: 550.0,
    totalCost: 3950.0,
    supplierName: 'Mecânica Diesel Rodoviária Uberlândia',
    nextServiceOdometerAlert: 327000,
    createdAt: '2026-05-20T14:00:00.000Z',
  },
  {
    id: 'm-302',
    truckId: '33333333-3333-3333-3333-333333333333',
    date: '2026-10-06T08:00:00.000Z',
    odometerAtService: 327800,
    type: 'CORRETIVA',
    category: 'MOTOR',
    description: 'Diagnóstico de perda de rendimento e consumo excessivo. Substituição de bicos injetores e sensor do Arla.',
    partsCost: 6800.0,
    laborCost: 1500.0,
    totalCost: 8300.0,
    supplierName: 'Mercedes-Benz Cardiesel',
    nextServiceOdometerAlert: null,
    createdAt: '2026-10-06T08:00:00.000Z',
  },
];

export const mockFreightTrips: FreightTrip[] = [
  {
    id: 't-101',
    truckId: '11111111-1111-1111-1111-111111111111',
    driverId: 'd1111111-1111-1111-1111-111111111111',
    customerName: 'Bunge Alimentos',
    origin: 'Campinas - SP',
    destination: 'Belo Horizonte - MG',
    destinationCity: 'Belo Horizonte',
    destinationState: 'MG',
    startDate: '2026-09-02T09:00:00.000Z',
    endDate: '2026-09-05T18:00:00.000Z',
    initialKm: 221000,
    finalKm: 222350,
    grossFreightValue: 14800.0,
    tollCosts: 850.0,
    loadingUnloadingCosts: 350.0,
    otherExpenses: 120.0,
    netFreightValue: 9800.0,
  },
  {
    id: 't-102',
    truckId: '11111111-1111-1111-1111-111111111111',
    driverId: 'd1111111-1111-1111-1111-111111111111',
    customerName: 'Ambev S.A.',
    origin: 'Sete Lagoas - MG',
    destination: 'Santos - SP (Porto)',
    destinationCity: 'Santos',
    destinationState: 'SP',
    startDate: '2026-09-15T08:00:00.000Z',
    endDate: '2026-09-20T17:00:00.000Z',
    initialKm: 223500,
    finalKm: 225800,
    grossFreightValue: 19500.0,
    tollCosts: 1350.0,
    loadingUnloadingCosts: 450.0,
    otherExpenses: 250.0,
    netFreightValue: 13200.0,
  },
  {
    id: 't-201',
    truckId: '22222222-2222-2222-2222-222222222222',
    driverId: 'd2222222-2222-2222-2222-222222222222',
    customerName: 'Klabin Papel e Celulose',
    origin: 'Telêmaco Borba - PR',
    destination: 'Itajaí - SC (Porto)',
    destinationCity: 'Itajaí',
    destinationState: 'SC',
    startDate: '2026-09-03T10:00:00.000Z',
    endDate: '2026-09-08T15:00:00.000Z',
    initialKm: 156000,
    finalKm: 158200,
    grossFreightValue: 22000.0,
    tollCosts: 1200.0,
    loadingUnloadingCosts: 500.0,
    otherExpenses: 180.0,
    netFreightValue: 15200.0,
  },
  {
    id: 't-202',
    truckId: '22222222-2222-2222-2222-222222222222',
    driverId: 'd2222222-2222-2222-2222-222222222222',
    customerName: 'Seara / JBS Alimentos',
    origin: 'Chapecó - SC',
    destination: 'Paranaguá - PR',
    destinationCity: 'Paranaguá',
    destinationState: 'PR',
    startDate: '2026-09-20T07:00:00.000Z',
    endDate: '2026-09-26T20:00:00.000Z',
    initialKm: 159000,
    finalKm: 162100,
    grossFreightValue: 24500.0,
    tollCosts: 1450.0,
    loadingUnloadingCosts: 600.0,
    otherExpenses: 300.0,
    netFreightValue: 16800.0,
  },
  {
    id: 't-301',
    truckId: '33333333-3333-3333-3333-333333333333',
    driverId: 'd3333333-3333-3333-3333-333333333333',
    customerName: 'Cargill Agrícola',
    origin: 'Rio Verde - GO',
    destination: 'Santos - SP (Grãos)',
    destinationCity: 'Santos',
    destinationState: 'SP',
    startDate: '2026-09-06T06:00:00.000Z',
    endDate: '2026-09-12T19:00:00.000Z',
    initialKm: 322000,
    finalKm: 324200,
    grossFreightValue: 21500.0,
    tollCosts: 1600.0,
    loadingUnloadingCosts: 400.0,
    otherExpenses: 220.0,
    netFreightValue: 13900.0,
  },
];

export interface MetricsInput {
  trucks: Truck[];
  fuelLogs: FuelLog[];
  maintenanceLogs: MaintenanceLog[];
  trips: FreightTrip[];
}

export function computeDashboardMetrics(data: MetricsInput): DashboardMetrics {
  const {
    trucks: inputTrucks,
    fuelLogs: inputFuelLogs,
    maintenanceLogs: inputMaintenanceLogs,
    trips: inputTrips,
  } = data;

  const totalRevenue = inputTrips.reduce((acc, t) => acc + t.grossFreightValue, 0);
  const totalFuelCost = inputFuelLogs.reduce((acc, f) => acc + f.totalAmount, 0);
  const totalArlaCost = inputFuelLogs.reduce((acc, f) => acc + f.arlaAmount, 0);
  const totalMaintenanceCost = inputMaintenanceLogs.reduce((acc, m) => acc + m.totalCost, 0);
  const totalTollCosts = inputTrips.reduce((acc, t) => acc + t.tollCosts, 0);
  const totalOtherCosts = inputTrips.reduce(
    (acc, t) => acc + t.loadingUnloadingCosts + t.otherExpenses,
    0
  );

  const totalExpenses =
    totalFuelCost + totalArlaCost + totalMaintenanceCost + totalTollCosts + totalOtherCosts;
  const netProfit = totalRevenue - totalExpenses;
  const profitMarginPercent = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

  let totalKmTraveled = 0;
  let totalFleetLitersWithDistance = 0;
  let totalFleetFuelCostWithDistance = 0;

  const truckMetrics = inputTrucks.map((truck) => {
    const truckFuel = inputFuelLogs.filter((f) => f.truckId === truck.id);
    const truckMaint = inputMaintenanceLogs.filter((m) => m.truckId === truck.id);
    const truckTrips = inputTrips.filter((t) => t.truckId === truck.id);

    const dieselOnlyCost = truckFuel.reduce((sum, f) => sum + f.totalAmount, 0);
    const fCost = truckFuel.reduce((sum, f) => sum + f.totalAmount + f.arlaAmount, 0);
    const mCost = truckMaint.reduce((sum, m) => sum + m.totalCost, 0);
    const tCost = truckTrips.reduce(
      (sum, t) => sum + t.tollCosts + t.loadingUnloadingCosts + t.otherExpenses,
      0
    );
    const expTotal = fCost + mCost + tCost;

    // Histórico mensal acumulado deste caminhão
    const monthlyHistory = calculateTruckMonthlyHistory(truckFuel, truck.id);

    // Métrica acumulada pelo método padronizado:
    // start_odometer = MIN(odometer), end_odometer = MAX(odometer), distance_traveled = end - start
    // total_liters = SUM(liters), monthly_avg_km_l = distance_traveled / total_liters
    // total_fuel_cost = SUM(total_amount), fuel_cpk = total_fuel_cost / distance_traveled
    const cumulative = calculateCumulativeFuelStats(truckFuel);
    const km = cumulative.distanceTraveled;

    totalKmTraveled += km;
    if (km > 0) {
      totalFleetLitersWithDistance += cumulative.totalLiters;
      totalFleetFuelCostWithDistance += cumulative.totalFuelCost;
    }

    // Verifica se o acumulado ou algum mês com > 1.000 km apresenta anomalia (< 2,0 ou > 4,5 km/L)
    const anomalousMonth = [...monthlyHistory].reverse().find((m) => m.isAnomalous) ?? null;
    const isAnomalous = cumulative.isAnomalous || Boolean(anomalousMonth);
    const anomalyType = cumulative.anomalyType ?? anomalousMonth?.anomalyType ?? null;
    const anomalyPeriodLabel = anomalousMonth?.periodLabel ?? null;
    const anomalyMessage =
      anomalousMonth?.anomalyMessage ??
      cumulative.anomalyMessage ??
      null;

    const cpk = calculateCPK(fCost, mCost, tCost, km);

    return {
      truckId: truck.id,
      plate: truck.plate,
      model: truck.model,
      kmTraveled: km,
      totalLiters: cumulative.totalLiters,
      startOdometer: cumulative.startOdometer,
      endOdometer: cumulative.endOdometer,
      totalExpenses: expTotal,
      fuelCost: dieselOnlyCost,
      maintenanceCost: mCost,
      averageKmL: cumulative.monthlyAvgKmL,
      monthlyAvgKmL: cumulative.monthlyAvgKmL,
      fuelCpk: cumulative.fuelCpk,
      cpk: Number(cpk.toFixed(2)),
      isAnomalous,
      anomalyType,
      anomalyMessage,
      anomalyPeriodLabel,
      monthlyHistory,
    };
  });

  // Série consolidada mês a mês para os Gráficos Mensais do Dashboard
  const monthBuckets = new Map<
    string,
    {
      month: number;
      year: number;
      distanceTraveled: number;
      totalLiters: number;
      totalFuelCost: number;
      hasTruckAnomaly: boolean;
    }
  >();

  for (const tm of truckMetrics) {
    for (const mh of tm.monthlyHistory) {
      const curr = monthBuckets.get(mh.periodKey) ?? {
        month: mh.month,
        year: mh.year,
        distanceTraveled: 0,
        totalLiters: 0,
        totalFuelCost: 0,
        hasTruckAnomaly: false,
      };
      curr.distanceTraveled += mh.distanceTraveled;
      curr.totalLiters += mh.totalLiters;
      curr.totalFuelCost += mh.totalFuelCost;
      if (mh.isAnomalous) curr.hasTruckAnomaly = true;
      monthBuckets.set(mh.periodKey, curr);
    }
  }

  const monthlyFuelSeries = Array.from(monthBuckets.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([periodKey, b]) => {
      const periodLabel = formatPeriodLabel(b.month, b.year);
      const monthlyAvgKmL =
        b.totalLiters > 0 && b.distanceTraveled > 0
          ? Number((b.distanceTraveled / b.totalLiters).toFixed(2))
          : 0;
      const fuelCpk =
        b.distanceTraveled > 0 ? Number((b.totalFuelCost / b.distanceTraveled).toFixed(2)) : 0;
      const fleetAnomaly = evaluateMonthlyAnomaly(b.distanceTraveled, monthlyAvgKmL, periodLabel);
      return {
        periodKey,
        periodLabel,
        month: b.month,
        year: b.year,
        distanceTraveled: b.distanceTraveled,
        totalLiters: Number(b.totalLiters.toFixed(2)),
        monthlyAvgKmL,
        totalFuelCost: Number(b.totalFuelCost.toFixed(2)),
        fuelCpk,
        isAnomalous: b.hasTruckAnomaly || fleetAnomaly.isAnomalous,
      };
    });

  const fleetAverageKmL =
    totalFleetLitersWithDistance > 0 && totalKmTraveled > 0
      ? Number((totalKmTraveled / totalFleetLitersWithDistance).toFixed(2))
      : 0;

  const fleetFuelCpk =
    totalKmTraveled > 0
      ? Number((totalFleetFuelCostWithDistance / totalKmTraveled).toFixed(2))
      : 0;

  const fleetCpk = calculateCPK(
    totalFuelCost + totalArlaCost,
    totalMaintenanceCost,
    totalTollCosts + totalOtherCosts,
    totalKmTraveled
  );

  const costBreakdown = [
    { name: 'Diesel S10', value: Math.round(totalFuelCost), color: '#2fc43a' },
    { name: 'Manutenção / Óleo', value: Math.round(totalMaintenanceCost), color: '#18181b' },
    { name: 'Pedágios', value: Math.round(totalTollCosts), color: '#a8f04a' },
    { name: 'Arla 32', value: Math.round(totalArlaCost), color: '#6b7280' },
    { name: 'Despesas de Viagem', value: Math.round(totalOtherCosts), color: '#f59e0b' },
  ];

  const dieselPriceTrend = [...inputFuelLogs]
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .map((f) => ({
      date: new Date(f.date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', timeZone: 'UTC' }),
      price: f.pricePerLiter,
      station: f.gasStationName,
    }));

  const activeAlerts: MaintenanceAlert[] = [];
  for (const t of inputTrucks) {
    const maints = inputMaintenanceLogs.filter((m) => m.truckId === t.id);
    activeAlerts.push(...checkMaintenanceAlerts(t, maints));
  }

  return {
    totalRevenue,
    totalExpenses,
    netProfit,
    profitMarginPercent: Number(profitMarginPercent.toFixed(1)),
    fleetAverageKmL,
    fleetFuelCpk,
    fleetCpk: Number(fleetCpk.toFixed(2)),
    totalKmTraveled,
    truckMetrics,
    monthlyFuelSeries,
    costBreakdown,
    dieselPriceTrend,
    activeAlerts,
  };
}

export function getMockDashboardMetrics(): DashboardMetrics {
  return computeDashboardMetrics({
    trucks: mockTrucks,
    fuelLogs: mockFuelLogs,
    maintenanceLogs: mockMaintenanceLogs,
    trips: mockFreightTrips,
  });
}
