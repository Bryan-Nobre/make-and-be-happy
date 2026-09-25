export type Role = "OWNER" | "ADMIN" | "CASHIER" | "WAITER" | "KITCHEN";

export type ModuleKey =
  | "dashboard"
  | "pdv"
  | "mesas"
  | "cozinha"
  | "caixa"
  | "produtos"
  | "estoque"
  | "clientes"
  | "relatorios"
  | "configuracoes";

export type User = {
  id: string;
  name: string;
  role: Role;
};

export type Category = {
  id: string;
  name: string;
  active: boolean;
  order: number;
};

export type AddonOption = {
  id: string;
  name: string;
  price: number;
};

export type AddonGroup = {
  id: string;
  name: string;
  required: boolean;
  min: number;
  max: number;
  options: AddonOption[];
};

export type Sector = "COZINHA" | "BAR" | "PIZZA" | "CHAPA";

export type Product = {
  id: string;
  name: string;
  categoryId: string;
  description: string;
  price: number;
  code: string;
  active: boolean;
  sector: Sector;
  addonGroupIds: string[];
  stockItemId?: string;
};

export type OrderItemAddon = { name: string; price: number };

export type OrderItem = {
  id: string;
  productId: string;
  name: string;
  quantity: number;
  /** Price captured at the moment the item entered the order. */
  unitPrice: number;
  addons: OrderItemAddon[];
  note: string;
};

export type OrderStatus =
  | "DRAFT"
  | "CONFIRMED"
  | "PREPARING"
  | "READY"
  | "DELIVERED"
  | "COMPLETED"
  | "CANCELLED";

export type PaymentMethod = "DINHEIRO" | "PIX" | "DEBITO" | "CREDITO";

export type Payment = {
  id: string;
  method: PaymentMethod;
  amount: number;
  received?: number;
  change?: number;
  at: string;
};

export type Order = {
  id: string;
  number: number;
  origin: "PDV" | "MESA";
  tableId?: string;
  tabNumber?: number;
  status: OrderStatus;
  items: OrderItem[];
  discount: number;
  surcharge: number;
  payments: Payment[];
  createdAt: string;
  cancelReason?: string;
};

export type TableStatus = "LIVRE" | "OCUPADA" | "AGUARDANDO_PAGAMENTO";

export type RestaurantTable = {
  id: string;
  name: string;
  seats: number;
  status: TableStatus;
  people?: number;
  openedAt?: string;
  tabNumber?: number;
};

export type CashMovementType =
  | "OPENING"
  | "SALE"
  | "WITHDRAWAL"
  | "SUPPLY"
  | "ADJUSTMENT"
  | "REFUND";

export type CashMovement = {
  id: string;
  type: CashMovementType;
  amount: number;
  method?: PaymentMethod;
  description: string;
  at: string;
  orderNumber?: number;
};

export type CashSession = {
  id: string;
  status: "OPEN" | "CLOSED";
  responsible: string;
  openingAmount: number;
  openedAt: string;
  closedAt?: string;
  countedAmount?: number;
  difference?: number;
  differenceReason?: string;
  note?: string;
  movements: CashMovement[];
};

export type StockStatus = "NORMAL" | "BAIXO" | "SEM_ESTOQUE";

export type StockItem = {
  id: string;
  name: string;
  category: string;
  unit: string;
  quantity: number;
  minimum: number;
  code: string;
};

export type StockMovement = {
  id: string;
  itemId: string;
  itemName: string;
  type: "ENTRADA" | "SAIDA" | "AJUSTE";
  quantity: number;
  reason: string;
  note?: string;
  at: string;
  user: string;
};

export type Customer = {
  id: string;
  name: string;
  phone: string;
  orders: number;
  total: number;
  lastOrderAt: string;
  note?: string;
};

export type CompanySettings = {
  name: string;
  cnpj: string;
  phone: string;
  address: string;
  openingHours: string;
  serviceFee: number;
  autoSendKitchen: boolean;
};
