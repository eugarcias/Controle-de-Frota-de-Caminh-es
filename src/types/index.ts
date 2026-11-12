export type TruckStatus = 'ATIVO' | 'MANUTENCAO' | 'PARADO';
export type DriverStatus = 'ATIVO' | 'INATIVO' | 'FERIAS';
export type FuelType = 'DIESEL_S10' | 'DIESEL_S500';
export type MaintenanceType = 'PREVENTIVA' | 'CORRETIVA';
export type MaintenanceCategory =
  | 'OLEO_FILTROS'
  | 'FREIOS'
  | 'SUSPENSAO'
  | 'MOTOR'
  | 'CAIXA'
  | 'ARLA_ELETRICA'
  | 'OUTROS';
export type AxlePosition = 'DIRECAO' | 'TRACAO' | 'TRUCK';
export type TireStatus = 'NOVO' | 'RECAPADO' | 'SUCATA';

export interface Truck {
  id: string;
  plate: string;
  model: string;
  brand: string;
  year: number;
  tankCapacityLiters: number;
  initialOdometer: number;
  currentOdometer: number;
  status: TruckStatus;
  createdAt: string;
}

export interface Driver {
  id: string;
  name: string;
  avatarUrl?: string | null;
  cnhNumber?: string | null;
  cnhCategory: string;
  phone: string;
  status: DriverStatus;
  /** % padrão de comissão do motorista */
  commissionPercent?: number | null;
}

export interface FuelLog {
  id: string;
  truckId: string;
  driverId: string;
  date: string;
  odometer: number;
  fuelType: FuelType;
  liters: number;
  pricePerLiter: number;
  totalAmount: number;
  arlaLiters: number;
  arlaAmount: number;
  gasStationName: string;
  receiptPhotoUrl?: string | null;
  createdAt: string;
}

export interface MaintenanceLog {
  id: string;
  truckId: string;
  date: string;
  odometerAtService: number;
  type: MaintenanceType;
  category: MaintenanceCategory;
  description: string;
  partsCost: number;
  laborCost: number;
  totalCost: number;
  supplierName: string;
  nextServiceOdometerAlert?: number | null;
  receiptPhotoUrl?: string | null;
  createdAt: string;
}

export interface Tire {
  id: string;
  truckId?: string | null;
  fireCode: string;
  brand: string;
  model: string;
  axlePosition: AxlePosition;
  status: TireStatus;
  currentKm: number;
  purchaseCost: number;
}

export interface FreightTrip {
  id: string;
  truckId: string;
  driverId: string;
  customerName: string;
  origin: string;
  destination: string;
  /** Obrigatórios em novos fretes; '' em registros antigos */
  destinationCity: string;
  destinationState: string;
  startDate: string;
  endDate?: string | null;
  initialKm: number;
  finalKm?: number | null;
  grossFreightValue: number;
  tollCosts: number;
  loadingUnloadingCosts: number;
  otherExpenses: number;
  netFreightValue: number;
  // Detalhes de carga (opcionais para manter compatibilidade com registros antigos)
  customerId?: string | null;
  cargoDescription?: string;
  cargoWeightKg?: number;
  distanceKm?: number;
  paymentTerms?: string;
  status?: TripStatus;
  notes?: string;
  /** Comissão do motorista nesta viagem (R$) */
  driverCommission?: number | null;
}

export type TripStatus = 'PLANEJADO' | 'EM_VIAGEM' | 'CONCLUIDO' | 'CANCELADO';
export type ScheduleStatus = 'AGENDADA' | 'EM_TRANSITO' | 'CONCLUIDA' | 'CANCELADA';

export interface Customer {
  id: string;
  name: string; // Razão social
  cnpj?: string | null;
  contactName: string;
  phone: string;
  email: string;
  city: string;
  state: string;
  paymentTermsDays: number;
  notes?: string;
}

export interface TireSupplier {
  id: string;
  name: string;
  cnpj: string;
  contactName: string;
  phone: string;
  email: string;
  city: string;
  state: string;
  brandsSold: string;
  notes?: string;
}

export interface CargoSchedule {
  id: string;
  customerId: string;
  truckId?: string | null;
  driverId?: string | null;
  origin: string;
  destination: string;
  distanceKm: number;
  cargoDescription: string;
  cargoWeightKg: number;
  pickupDate: string; // ISO (data/hora da coleta)
  deliveryDate?: string | null; // previsão de entrega
  freightValue: number;
  /** Comissão sugerida pelo admin ao motorista (R$) */
  driverCommission?: number | null;
  status: ScheduleStatus;
  notes?: string;
}

export type ExpenseCategoryType =
  | 'ALIMENTACAO'
  | 'ESTACIONAMENTO'
  | 'BORRACHARIA'
  | 'CHAPA'
  | 'PEDAGIO'
  | 'HOSPEDAGEM'
  | 'OUTROS';

export interface TravelExpenseRecord {
  id: string;
  tripId?: string | null;
  truckId?: string | null;
  driverId: string;
  date: string;
  category: ExpenseCategoryType;
  amount: number;
  description: string;
  receiptPhotoUrl?: string | null;
  createdAt?: string;
}


export interface ConsumptionResult {
  logId: string;
  odometer: number;
  liters: number;
  kmTraveled: number;
  averageKmL: number | null;
  isDistorted: boolean; // < 1.8 ou > 4.5
  statusReason?: string;
}

export interface MaintenanceAlert {
  truckId: string;
  truckPlate: string;
  truckModel: string;
  currentOdometer: number;
  nextServiceOdometer: number;
  kmRemaining: number;
  category: MaintenanceCategory;
  severity: 'CRITICAL' | 'WARNING' | 'OK'; // CRITICAL: kmRemaining <= 0, WARNING: <= 1000
  message: string;
}

export interface MonthlyFuelPerformance {
  truckId: string;
  month: number; // 1..12
  year: number;
  periodKey: string; // YYYY-MM
  periodLabel: string; // ex: Set/2026
  logsCount: number;
  totalLiters: number;
  startOdometer: number;
  endOdometer: number;
  distanceTraveled: number;
  monthlyAvgKmL: number;
  totalFuelCost: number;
  fuelCpk: number;
  isAnomalous: boolean;
  anomalyType: 'LOW' | 'HIGH' | null;
  anomalyMessage: string | null;
}

export interface DashboardMetrics {
  totalRevenue: number;
  totalExpenses: number;
  netProfit: number;
  profitMarginPercent: number;
  fleetAverageKmL: number;
  fleetFuelCpk: number;
  fleetCpk: number;
  totalKmTraveled: number;
  truckMetrics: {
    truckId: string;
    plate: string;
    model: string;
    kmTraveled: number;
    totalLiters: number;
    startOdometer: number;
    endOdometer: number;
    totalExpenses: number;
    fuelCost: number;
    maintenanceCost: number;
    averageKmL: number;
    monthlyAvgKmL: number;
    fuelCpk: number;
    cpk: number;
    isAnomalous: boolean;
    anomalyType: 'LOW' | 'HIGH' | null;
    anomalyMessage: string | null;
    anomalyPeriodLabel?: string | null;
    monthlyHistory: MonthlyFuelPerformance[];
  }[];
  monthlyFuelSeries: {
    periodKey: string;
    periodLabel: string;
    month: number;
    year: number;
    distanceTraveled: number;
    totalLiters: number;
    monthlyAvgKmL: number;
    totalFuelCost: number;
    fuelCpk: number;
    isAnomalous: boolean;
  }[];
  costBreakdown: {
    name: string;
    value: number;
    color: string;
  }[];
  dieselPriceTrend: {
    date: string;
    price: number;
    station: string;
  }[];
  activeAlerts: MaintenanceAlert[];
}
