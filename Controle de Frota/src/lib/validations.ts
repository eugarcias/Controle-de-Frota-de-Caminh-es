import { z } from 'zod';

const isoDate = z.string().min(8);
const money = z.number().nonnegative();
const wholeNumber = z.number().nonnegative().transform((n) => Math.round(n));
const optionalText = z.string().optional().nullable();

// Texto opcional: string vazia/ausente vira null (evita violar colunas @unique com "")
const nullableTrimmed = z
  .string()
  .optional()
  .nullable()
  .transform((s) => (s && s.trim() ? s.trim() : null));

export const TruckSchema = z.object({
  plate: z.string().min(7).max(8).transform((s) => s.toUpperCase()),
  model: z.string().min(2).default('Não informado'),
  brand: z.string().min(2).default('Não informada'),
  year: z.number().int().min(0).max(2035).default(0),
  tankCapacityLiters: z.number().int().nonnegative().default(0),
  initialOdometer: z.number().int().nonnegative().default(0),
  currentOdometer: z.number().int().nonnegative().default(0),
  status: z.enum(['ATIVO', 'MANUTENCAO', 'PARADO']).default('ATIVO'),
});

export const DriverSchema = z.object({
  name: z.string().min(3),
  cnhNumber: nullableTrimmed,
  cnhCategory: z.string().default(''),
  phone: z.string().min(8),
  status: z.enum(['ATIVO', 'INATIVO', 'FERIAS']).default('ATIVO'),
});

export const CustomerSchema = z.object({
  name: z.string().min(2),
  cnpj: nullableTrimmed,
  contactName: z.string().default(''),
  phone: z.string().min(8),
  email: z.string().default(''),
  city: z.string().default(''),
  state: z.string().max(2).default(''),
  paymentTermsDays: z.number().int().nonnegative().default(30),
  notes: optionalText,
});

export const TireSupplierSchema = z.object({
  name: z.string().min(2),
  cnpj: z.string().min(14),
  contactName: z.string().min(2),
  phone: z.string().min(8),
  email: z.string(),
  city: z.string().min(2),
  state: z.string().min(2).max(2),
  brandsSold: z.string().min(2),
  notes: optionalText,
});

export const FuelLogSchema = z.object({
  truckId: z.string().uuid(),
  driverId: z.string().uuid(),
  date: isoDate,
  odometer: z.number().int().positive(),
  fuelType: z.enum(['DIESEL_S10', 'DIESEL_S500']).default('DIESEL_S10'),
  liters: z.number().positive(),
  pricePerLiter: z.number().positive(),
  totalAmount: z.number().positive(),
  arlaLiters: money.default(0),
  arlaAmount: money.default(0),
  isFullTank: z.boolean().default(true),
  gasStationName: z.string().min(2),
  receiptPhotoUrl: z.string().url().optional().nullable(),
});

export const MaintenanceLogSchema = z.object({
  truckId: z.string().uuid(),
  date: isoDate,
  odometerAtService: z.number().int().positive(),
  type: z.enum(['PREVENTIVA', 'CORRETIVA']),
  category: z.enum(['OLEO_FILTROS', 'FREIOS', 'SUSPENSAO', 'MOTOR', 'CAIXA', 'ARLA_ELETRICA', 'OUTROS']),
  description: z.string().min(3),
  partsCost: money.default(0),
  laborCost: money.default(0),
  totalCost: z.number().positive(),
  supplierName: z.string().min(2),
  nextServiceOdometerAlert: z.number().int().positive().optional().nullable(),
  receiptPhotoUrl: z.string().url().optional().nullable(),
});

export const FreightTripSchema = z.object({
  truckId: z.string().uuid(),
  driverId: z.string().uuid(),
  customerId: z.string().uuid().optional().nullable(),
  customerName: z.string().min(2),
  origin: z.string().min(2),
  destination: z.string().min(2),
  destinationCity: z.string().trim().min(2, 'informe a cidade de destino'),
  destinationState: z
    .string()
    .trim()
    .length(2, 'informe a UF de destino (2 letras)')
    .transform((s) => s.toUpperCase()),
  startDate: isoDate,
  endDate: isoDate.optional().nullable(),
  initialKm: wholeNumber,
  finalKm: wholeNumber.optional().nullable(),
  distanceKm: wholeNumber.optional().nullable(),
  cargoDescription: optionalText,
  cargoWeightKg: wholeNumber.optional().nullable(),
  paymentTerms: optionalText,
  status: z.enum(['PLANEJADO', 'EM_VIAGEM', 'CONCLUIDO', 'CANCELADO']).default('PLANEJADO'),
  notes: optionalText,
  grossFreightValue: z.number().positive(),
  tollCosts: money.default(0),
  loadingUnloadingCosts: money.default(0),
  otherExpenses: money.default(0),
  netFreightValue: z.number().optional(),
});

export const CargoScheduleSchema = z.object({
  customerId: z.string().uuid(),
  truckId: z.string().uuid().optional().nullable(),
  driverId: z.string().uuid().optional().nullable(),
  origin: z.string().min(2),
  destination: z.string().min(2),
  distanceKm: wholeNumber,
  cargoDescription: z.string().min(2),
  cargoWeightKg: wholeNumber,
  pickupDate: isoDate,
  deliveryDate: isoDate.optional().nullable(),
  freightValue: z.number().positive(),
  status: z.enum(['AGENDADA', 'EM_TRANSITO', 'CONCLUIDA', 'CANCELADA']).default('AGENDADA'),
  notes: optionalText,
});
