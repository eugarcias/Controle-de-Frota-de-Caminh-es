import { Truck, Driver, FuelLog, MaintenanceLog, FreightTrip, DashboardMetrics, MaintenanceAlert } from './types';
import { calculateFuelConsumption, calculateCPK, checkMaintenanceAlerts } from './lib/calc';

export const mockTrucks: Truck[] = [
  {
    id: '11111111-1111-1111-1111-111111111111',
    plate: 'VSM-3801',
    model: 'Scania R450 6x2',
    brand: 'Scania',
    year: 2021,
    tankCapacityLiters: 600,
    initialOdometer: 210000,
    currentOdometer: 228500, // rodou 18.500 km
    status: 'ATIVO',
    createdAt: '2023-01-10T10:00:00.000Z',
  },
  {
    id: '22222222-2222-2222-2222-222222222222',
    plate: 'VSM-5402',
    model: 'Volvo FH 540 6x4',
    brand: 'Volvo',
    year: 2022,
    tankCapacityLiters: 750,
    initialOdometer: 145000,
    currentOdometer: 164200, // rodou 19.200 km
    status: 'ATIVO',
    createdAt: '2023-03-15T10:00:00.000Z',
  },
  {
    id: '33333333-3333-3333-3333-333333333333',
    plate: 'VSM-2803',
    model: 'Mercedes-Benz Actros 2651',
    brand: 'Mercedes-Benz',
    year: 2020,
    tankCapacityLiters: 650,
    initialOdometer: 310000,
    currentOdometer: 327800, // rodou 17.800 km
    status: 'MANUTENCAO',
    createdAt: '2023-01-20T10:00:00.000Z',
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
  // VSM-3801 (Scania R450)
  {
    id: 'f-101',
    truckId: '11111111-1111-1111-1111-111111111111',
    driverId: 'd1111111-1111-1111-1111-111111111111',
    date: '2026-09-02T08:30:00.000Z',
    odometer: 221000,
    fuelType: 'DIESEL_S10',
    liters: 520,
    pricePerLiter: 5.89,
    totalAmount: 3062.80,
    arlaLiters: 40,
    arlaAmount: 180.00,
    isFullTank: true,
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
    liters: 200,
    pricePerLiter: 5.92,
    totalAmount: 1184.00,
    arlaLiters: 0,
    arlaAmount: 0,
    isFullTank: false, // Parcial
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
    liters: 550, // 4900 km / 750L = 2.17 km/L (OK e tanque cheio)
    pricePerLiter: 5.95,
    totalAmount: 3272.50,
    arlaLiters: 50,
    arlaAmount: 225.00,
    isFullTank: true,
    gasStationName: 'Posto Arco-Íris Roseira',
    createdAt: '2026-09-22T19:00:00.000Z',
  },
  {
    id: 'f-104',
    truckId: '11111111-1111-1111-1111-111111111111',
    driverId: 'd1111111-1111-1111-1111-111111111111',
    date: '2026-10-02T11:15:00.000Z',
    odometer: 228500,
    fuelType: 'DIESEL_S10',
    liters: 580, // 2600 km / 580L = 2.24 km/L
    pricePerLiter: 5.99,
    totalAmount: 3474.20,
    arlaLiters: 45,
    arlaAmount: 202.50,
    isFullTank: true,
    gasStationName: 'Auto Posto Maranello Betim',
    createdAt: '2026-10-02T11:15:00.000Z',
  },

  // VSM-5402 (Volvo FH 540)
  {
    id: 'f-201',
    truckId: '22222222-2222-2222-2222-222222222222',
    driverId: 'd2222222-2222-2222-2222-222222222222',
    date: '2026-09-03T09:00:00.000Z',
    odometer: 156000,
    fuelType: 'DIESEL_S10',
    liters: 680,
    pricePerLiter: 5.88,
    totalAmount: 3998.40,
    arlaLiters: 60,
    arlaAmount: 270.00,
    isFullTank: true,
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
    liters: 710, // 4200 km / 710L = 2.12 km/L
    pricePerLiter: 5.93,
    totalAmount: 4210.30,
    arlaLiters: 65,
    arlaAmount: 292.50,
    isFullTank: true,
    gasStationName: 'Posto Sinuelo Araquari SC',
    createdAt: '2026-09-18T16:45:00.000Z',
  },
  {
    id: 'f-203',
    truckId: '22222222-2222-2222-2222-222222222222',
    driverId: 'd2222222-2222-2222-2222-222222222222',
    date: '2026-10-04T08:10:00.000Z',
    odometer: 164200,
    fuelType: 'DIESEL_S10',
    liters: 690, // 4000 km / 690L = 2.05 km/L
    pricePerLiter: 5.98,
    totalAmount: 4126.20,
    arlaLiters: 60,
    arlaAmount: 270.00,
    isFullTank: true,
    gasStationName: 'Posto Buffon Canoas RS',
    createdAt: '2026-10-04T08:10:00.000Z',
  },

  // VSM-2803 (Mercedes Actros) - Exemplo com alerta de anomalia (Consumo excessivo 1.62 km/L)
  {
    id: 'f-301',
    truckId: '33333333-3333-3333-3333-333333333333',
    driverId: 'd3333333-3333-3333-3333-333333333333',
    date: '2026-09-05T07:10:00.000Z',
    odometer: 322000,
    fuelType: 'DIESEL_S10',
    liters: 590,
    pricePerLiter: 5.91,
    totalAmount: 3486.90,
    arlaLiters: 50,
    arlaAmount: 225.00,
    isFullTank: true,
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
    liters: 580, // 2800 km / 580L = 1.60 km/L -> ANOMALIA (< 1.8 km/L) - Provável vazamento ou filtro obstruído!
    pricePerLiter: 5.97,
    totalAmount: 3462.60,
    arlaLiters: 45,
    arlaAmount: 202.50,
    isFullTank: true,
    gasStationName: 'Posto Trevão Itumbiara GO',
    createdAt: '2026-09-25T17:40:00.000Z',
  },
  {
    id: 'f-303',
    truckId: '33333333-3333-3333-3333-333333333333',
    driverId: 'd3333333-3333-3333-3333-333333333333',
    date: '2026-10-05T12:00:00.000Z',
    odometer: 327800,
    fuelType: 'DIESEL_S10',
    liters: 610, // 3000 km / 610L = 1.70 km/L -> ANOMALIA
    pricePerLiter: 6.02,
    totalAmount: 3672.20,
    arlaLiters: 50,
    arlaAmount: 225.00,
    isFullTank: true,
    gasStationName: 'Auto Posto Alvorada Uberlândia MG',
    createdAt: '2026-10-05T12:00:00.000Z',
  },
];

export const mockMaintenanceLogs: MaintenanceLog[] = [
  // VSM-3801: Troca de óleo recente. Próxima alerta em 229.000 km (atual é 228.500 -> Faltam 500 km! ALERTA AMARELO)
  {
    id: 'm-101',
    truckId: '11111111-1111-1111-1111-111111111111',
    date: '2026-07-15T09:00:00.000Z',
    odometerAtService: 209000,
    type: 'PREVENTIVA',
    category: 'OLEO_FILTROS',
    description: 'Troca de óleo do motor 15W40 + filtros de combustível, lubrificante e sedimentador.',
    partsCost: 3100.00,
    laborCost: 450.00,
    totalCost: 3550.00,
    supplierName: 'Scania Quinta Roda Campinas',
    nextServiceOdometerAlert: 229000, // Atual 228.500 -> Faltam 500km!
    createdAt: '2026-07-15T09:00:00.000Z',
  },
  // VSM-5402: Revisão de freios OK (próxima revisão em 180.000 km, atual é 164.200)
  {
    id: 'm-201',
    truckId: '22222222-2222-2222-2222-222222222222',
    date: '2026-08-10T10:30:00.000Z',
    odometerAtService: 150000,
    type: 'PREVENTIVA',
    category: 'FREIOS',
    description: 'Troca de pastilhas de freio disco eixo dianteiro e tração, revisão das cuícas.',
    partsCost: 4800.00,
    laborCost: 900.00,
    totalCost: 5700.00,
    supplierName: 'Volvo Dipesul Curitiba',
    nextServiceOdometerAlert: 180000,
    createdAt: '2026-08-10T10:30:00.000Z',
  },
  // VSM-2803: Vencida! Alerta configurado para 327.000 km, caminhão já está em 327.800 km (+800 km atrasado! CRÍTICO)
  {
    id: 'm-301',
    truckId: '33333333-3333-3333-3333-333333333333',
    date: '2026-05-20T14:00:00.000Z',
    odometerAtService: 307000,
    type: 'PREVENTIVA',
    category: 'OLEO_FILTROS',
    description: 'Troca de óleo e filtros da Mercedes Actros',
    partsCost: 3400.00,
    laborCost: 550.00,
    totalCost: 3950.00,
    supplierName: 'Mecânica Diesel Rodoviária Uberlândia',
    nextServiceOdometerAlert: 327000, // Atual 327.800 -> VENCIDO!
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
    partsCost: 6800.00,
    laborCost: 1500.00,
    totalCost: 8300.00,
    supplierName: 'Mercedes-Benz Cardiesel',
    nextServiceOdometerAlert: null,
    createdAt: '2026-10-06T08:00:00.000Z',
  },
];

export const mockFreightTrips: FreightTrip[] = [
  // Viagens VSM-3801
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
    grossFreightValue: 14800.00,
    tollCosts: 850.00,
    loadingUnloadingCosts: 350.00,
    otherExpenses: 120.00,
    netFreightValue: 9800.00,
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
    grossFreightValue: 19500.00,
    tollCosts: 1350.00,
    loadingUnloadingCosts: 450.00,
    otherExpenses: 250.00,
    netFreightValue: 13200.00,
  },
  // Viagens VSM-5402
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
    grossFreightValue: 22000.00,
    tollCosts: 1200.00,
    loadingUnloadingCosts: 500.00,
    otherExpenses: 180.00,
    netFreightValue: 15200.00,
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
    grossFreightValue: 24500.00,
    tollCosts: 1450.00,
    loadingUnloadingCosts: 600.00,
    otherExpenses: 300.00,
    netFreightValue: 16800.00,
  },
  // Viagens VSM-2803
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
    grossFreightValue: 21500.00,
    tollCosts: 1600.00,
    loadingUnloadingCosts: 400.00,
    otherExpenses: 220.00,
    netFreightValue: 13900.00,
  },
];

/**
 * Calcula os dados consolidados do dashboard dinamicamente a partir dos mocks/registros
 */
export interface MetricsInput {
  trucks: Truck[];
  fuelLogs: FuelLog[];
  maintenanceLogs: MaintenanceLog[];
  trips: FreightTrip[];
}

export function computeDashboardMetrics(data: MetricsInput): DashboardMetrics {
  const {
    trucks: mockTrucks,
    fuelLogs: mockFuelLogs,
    maintenanceLogs: mockMaintenanceLogs,
    trips: mockFreightTrips,
  } = data;
  const totalRevenue = mockFreightTrips.reduce((acc, t) => acc + t.grossFreightValue, 0);


  const totalFuelCost = mockFuelLogs.reduce((acc, f) => acc + f.totalAmount, 0);
  const totalArlaCost = mockFuelLogs.reduce((acc, f) => acc + f.arlaAmount, 0);
  const totalMaintenanceCost = mockMaintenanceLogs.reduce((acc, m) => acc + m.totalCost, 0);
  const totalTollCosts = mockFreightTrips.reduce((acc, t) => acc + t.tollCosts, 0);
  const totalOtherCosts = mockFreightTrips.reduce(
    (acc, t) => acc + t.loadingUnloadingCosts + t.otherExpenses,
    0
  );

  const totalExpenses =
    totalFuelCost + totalArlaCost + totalMaintenanceCost + totalTollCosts + totalOtherCosts;
  const netProfit = totalRevenue - totalExpenses;
  const profitMarginPercent = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

  // Total KM rodados baseado no intervalo de odômetro registrado
  let totalKmTraveled = 0;
  const truckMetrics = mockTrucks.map((truck) => {
    const truckFuel = mockFuelLogs.filter((f) => f.truckId === truck.id);
    const truckMaint = mockMaintenanceLogs.filter((m) => m.truckId === truck.id);
    const truckTrips = mockFreightTrips.filter((t) => t.truckId === truck.id);

    const fCost = truckFuel.reduce((sum, f) => sum + f.totalAmount + f.arlaAmount, 0);
    const mCost = truckMaint.reduce((sum, m) => sum + m.totalCost, 0);
    const tCost = truckTrips.reduce(
      (sum, t) => sum + t.tollCosts + t.loadingUnloadingCosts + t.otherExpenses,
      0
    );
    const expTotal = fCost + mCost + tCost;

    // KM rodados nos abastecimentos
    const minOdo = Math.min(...truckFuel.map((f) => f.odometer), truck.initialOdometer);
    const maxOdo = Math.max(...truckFuel.map((f) => f.odometer), truck.currentOdometer);
    const km = maxOdo - minOdo;
    totalKmTraveled += km;

    // Consumo médio
    const consumption = calculateFuelConsumption(truckFuel);
    const validKmLs = consumption
      .map((c) => c.averageKmL)
      .filter((v): v is number => v !== null && v > 0);
    const avgKmL =
      validKmLs.length > 0
        ? validKmLs.reduce((a, b) => a + b, 0) / validKmLs.length
        : 2.15;

    const cpk = calculateCPK(fCost, mCost, tCost, km);

    return {
      truckId: truck.id,
      plate: truck.plate,
      model: truck.model,
      kmTraveled: km,
      totalExpenses: expTotal,
      fuelCost: fCost,
      maintenanceCost: mCost,
      averageKmL: Number(avgKmL.toFixed(2)),
      cpk: Number(cpk.toFixed(2)),
    };
  });

  const fleetAverageKmL =
    truckMetrics.reduce((sum, t) => sum + t.averageKmL, 0) / (truckMetrics.length || 1);
  const fleetCpk = calculateCPK(
    totalFuelCost + totalArlaCost,
    totalMaintenanceCost,
    totalTollCosts + totalOtherCosts,
    totalKmTraveled
  );

  // Composição de Custos para Gráfico de Rosca (cores da marca VSM)
  const costBreakdown = [
    { name: 'Diesel S10', value: Math.round(totalFuelCost), color: '#2fc43a' }, // Verde VSM
    { name: 'Manutenção / Óleo', value: Math.round(totalMaintenanceCost), color: '#18181b' }, // Preto
    { name: 'Pedágios', value: Math.round(totalTollCosts), color: '#a8f04a' }, // Verde lima
    { name: 'Arla 32', value: Math.round(totalArlaCost), color: '#6b7280' }, // Cinza
    { name: 'Despesas de Viagem', value: Math.round(totalOtherCosts), color: '#f59e0b' }, // Âmbar
  ];

  // Evolução do preço do litro do diesel, derivada dos abastecimentos registrados
  const dieselPriceTrend = [...mockFuelLogs]
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .map((f) => ({
      date: new Date(f.date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', timeZone: 'UTC' }),
      price: f.pricePerLiter,
      station: f.gasStationName,
    }));

  // Alertas ativos
  const activeAlerts: MaintenanceAlert[] = [];
  for (const t of mockTrucks) {
    const maints = mockMaintenanceLogs.filter((m) => m.truckId === t.id);
    activeAlerts.push(...checkMaintenanceAlerts(t, maints));
  }

  return {
    totalRevenue,
    totalExpenses,
    netProfit,
    profitMarginPercent: Number(profitMarginPercent.toFixed(1)),
    fleetAverageKmL: Number(fleetAverageKmL.toFixed(2)),
    fleetCpk: Number(fleetCpk.toFixed(2)),
    totalKmTraveled,
    truckMetrics,
    costBreakdown,
    dieselPriceTrend,
    activeAlerts,
  };
}

/** Versão com os dados de exemplo (usada em rotas de API e como estado inicial). */
export function getMockDashboardMetrics(): DashboardMetrics {
  return computeDashboardMetrics({
    trucks: mockTrucks,
    fuelLogs: mockFuelLogs,
    maintenanceLogs: mockMaintenanceLogs,
    trips: mockFreightTrips,
  });
}

