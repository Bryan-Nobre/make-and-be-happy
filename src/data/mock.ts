import type {
  AddonGroup,
  CashSession,
  Category,
  CompanySettings,
  Customer,
  Order,
  Product,
  RestaurantTable,
  StockItem,
  StockMovement,
  User,
} from "./types";

/** Deterministic timestamp helper so SSR and client agree on relative times. */
const minutesAgo = (base: number, minutes: number) =>
  new Date(base - minutes * 60000).toISOString();

export const company: CompanySettings = {
  name: "Restaurante Sabor da Casa",
  cnpj: "12.345.678/0001-90",
  phone: "(11) 3456-7890",
  address: "Rua das Palmeiras, 240 — Vila Mariana, São Paulo/SP",
  openingHours: "11:00 às 23:00",
  serviceFee: 10,
  autoSendKitchen: false,
};

export const users: User[] = [
  { id: "u1", name: "Marcos Ribeiro", role: "OWNER" },
  { id: "u2", name: "Patrícia Lima", role: "ADMIN" },
  { id: "u3", name: "Juliana Alves", role: "CASHIER" },
  { id: "u4", name: "Rafael Souza", role: "WAITER" },
  { id: "u5", name: "Cleber Martins", role: "KITCHEN" },
];

export const categories: Category[] = [
  { id: "c1", name: "Lanches", active: true, order: 1 },
  { id: "c2", name: "Porções", active: true, order: 2 },
  { id: "c3", name: "Bebidas", active: true, order: 3 },
  { id: "c4", name: "Sobremesas", active: true, order: 4 },
];

export const addonGroups: AddonGroup[] = [
  {
    id: "g1",
    name: "Complementos",
    required: false,
    min: 0,
    max: 3,
    options: [
      { id: "o1", name: "Bacon", price: 5 },
      { id: "o2", name: "Cheddar", price: 4 },
      { id: "o3", name: "Ovo", price: 3 },
    ],
  },
  {
    id: "g2",
    name: "Ponto da carne",
    required: true,
    min: 1,
    max: 1,
    options: [
      { id: "o4", name: "Ao ponto", price: 0 },
      { id: "o5", name: "Bem passado", price: 0 },
    ],
  },
  {
    id: "g3",
    name: "Molhos",
    required: false,
    min: 0,
    max: 2,
    options: [
      { id: "o6", name: "Barbecue", price: 2 },
      { id: "o7", name: "Maionese da casa", price: 2 },
    ],
  },
];

export const products: Product[] = [
  {
    id: "p1",
    name: "X-Burger",
    categoryId: "c1",
    description: "Pão brioche, hambúrguer 150g, queijo e molho da casa.",
    price: 24.9,
    code: "LAN-001",
    active: true,
    sector: "CHAPA",
    addonGroupIds: ["g1", "g2"],
    stockItemId: "s1",
  },
  {
    id: "p2",
    name: "X-Salada",
    categoryId: "c1",
    description: "Hambúrguer 150g, queijo, alface e tomate.",
    price: 26.9,
    code: "LAN-002",
    active: true,
    sector: "CHAPA",
    addonGroupIds: ["g1", "g2"],
    stockItemId: "s1",
  },
  {
    id: "p3",
    name: "X-Bacon",
    categoryId: "c1",
    description: "Hambúrguer 150g, cheddar e bacon crocante.",
    price: 29.9,
    code: "LAN-003",
    active: true,
    sector: "CHAPA",
    addonGroupIds: ["g1", "g2"],
    stockItemId: "s2",
  },
  {
    id: "p4",
    name: "Batata Frita",
    categoryId: "c2",
    description: "Porção 400g com sal grosso.",
    price: 22,
    code: "POR-001",
    active: true,
    sector: "COZINHA",
    addonGroupIds: ["g3"],
    stockItemId: "s3",
  },
  {
    id: "p5",
    name: "Frango a Passarinho",
    categoryId: "c2",
    description: "Porção 500g com alho e limão.",
    price: 39.9,
    code: "POR-002",
    active: true,
    sector: "COZINHA",
    addonGroupIds: [],
  },
  {
    id: "p6",
    name: "Coca-Cola 350ml",
    categoryId: "c3",
    description: "Lata gelada.",
    price: 7,
    code: "BEB-001",
    active: true,
    sector: "BAR",
    addonGroupIds: [],
    stockItemId: "s4",
  },
  {
    id: "p7",
    name: "Guaraná 350ml",
    categoryId: "c3",
    description: "Lata gelada.",
    price: 6.5,
    code: "BEB-002",
    active: true,
    sector: "BAR",
    addonGroupIds: [],
    stockItemId: "s5",
  },
  {
    id: "p8",
    name: "Água 500ml",
    categoryId: "c3",
    description: "Sem gás.",
    price: 4,
    code: "BEB-003",
    active: true,
    sector: "BAR",
    addonGroupIds: [],
    stockItemId: "s6",
  },
  {
    id: "p9",
    name: "Pudim de Leite",
    categoryId: "c4",
    description: "Fatia individual.",
    price: 12,
    code: "SOB-001",
    active: true,
    sector: "COZINHA",
    addonGroupIds: [],
  },
  {
    id: "p10",
    name: "Milkshake 400ml",
    categoryId: "c4",
    description: "Chocolate, morango ou baunilha.",
    price: 18,
    code: "SOB-002",
    active: false,
    sector: "BAR",
    addonGroupIds: [],
  },
];

export const buildTables = (): RestaurantTable[] =>
  Array.from({ length: 15 }, (_, i) => ({
    id: `t${i + 1}`,
    name: `Mesa ${String(i + 1).padStart(2, "0")}`,
    seats: i % 3 === 0 ? 6 : 4,
    status: "LIVRE" as const,
  }));

export const stockItems: StockItem[] = [
  { id: "s1", name: "Hambúrguer 150g", category: "Carnes", unit: "un", quantity: 48, minimum: 20, code: "EST-001" },
  { id: "s2", name: "Bacon em fatias", category: "Carnes", unit: "kg", quantity: 2, minimum: 3, code: "EST-002" },
  { id: "s3", name: "Batata congelada", category: "Congelados", unit: "kg", quantity: 14, minimum: 8, code: "EST-003" },
  { id: "s4", name: "Coca-Cola 350ml", category: "Bebidas", unit: "un", quantity: 72, minimum: 24, code: "EST-004" },
  { id: "s5", name: "Guaraná 350ml", category: "Bebidas", unit: "un", quantity: 18, minimum: 24, code: "EST-005" },
  { id: "s6", name: "Água 500ml", category: "Bebidas", unit: "un", quantity: 0, minimum: 12, code: "EST-006" },
  { id: "s7", name: "Pão brioche", category: "Padaria", unit: "un", quantity: 60, minimum: 30, code: "EST-007" },
  { id: "s8", name: "Queijo mussarela", category: "Laticínios", unit: "kg", quantity: 3, minimum: 4, code: "EST-008" },
];

export const buildStockMovements = (base: number): StockMovement[] => [
  {
    id: "sm1",
    itemId: "s1",
    itemName: "Hambúrguer 150g",
    type: "ENTRADA",
    quantity: 60,
    reason: "Compra de fornecedor",
    note: "Frigorífico Boa Carne",
    at: minutesAgo(base, 600),
    user: "Patrícia Lima",
  },
  {
    id: "sm2",
    itemId: "s6",
    itemName: "Água 500ml",
    type: "SAIDA",
    quantity: 12,
    reason: "Venda do dia",
    at: minutesAgo(base, 240),
    user: "Juliana Alves",
  },
  {
    id: "sm3",
    itemId: "s8",
    itemName: "Queijo mussarela",
    type: "AJUSTE",
    quantity: -1,
    reason: "Inventário",
    note: "Diferença encontrada na conferência",
    at: minutesAgo(base, 120),
    user: "Marcos Ribeiro",
  },
];

export const customers: Customer[] = [
  { id: "cl1", name: "Ana Beatriz Moraes", phone: "(11) 98877-1122", orders: 14, total: 612.4, lastOrderAt: "2026-09-23T20:15:00.000Z" },
  { id: "cl2", name: "Carlos Eduardo Pinto", phone: "(11) 97766-3344", orders: 6, total: 248.9, lastOrderAt: "2026-09-18T21:02:00.000Z" },
  { id: "cl3", name: "Débora Nascimento", phone: "(11) 96655-8899", orders: 22, total: 1094.3, lastOrderAt: "2026-09-24T19:40:00.000Z" },
  { id: "cl4", name: "Fernando Tavares", phone: "(11) 95544-7788", orders: 3, total: 118.7, lastOrderAt: "2026-09-10T20:30:00.000Z" },
];

export const buildInitialOrders = (base: number): Order[] => [
  {
    id: "ord1",
    number: 901,
    origin: "MESA",
    tableId: "t3",
    tabNumber: 458,
    status: "PREPARING",
    createdAt: minutesAgo(base, 14),
    discount: 0,
    surcharge: 0,
    payments: [],
    items: [
      { id: "i1", productId: "p1", name: "X-Burger", quantity: 2, unitPrice: 24.9, addons: [{ name: "Bacon", price: 5 }], note: "Sem cebola" },
      { id: "i2", productId: "p6", name: "Coca-Cola 350ml", quantity: 2, unitPrice: 7, addons: [], note: "" },
    ],
  },
  {
    id: "ord2",
    number: 902,
    origin: "PDV",
    status: "CONFIRMED",
    createdAt: minutesAgo(base, 6),
    discount: 0,
    surcharge: 0,
    payments: [],
    items: [
      { id: "i3", productId: "p4", name: "Batata Frita", quantity: 1, unitPrice: 22, addons: [], note: "Bem crocante" },
      { id: "i4", productId: "p3", name: "X-Bacon", quantity: 1, unitPrice: 29.9, addons: [], note: "" },
    ],
  },
  {
    id: "ord3",
    number: 903,
    origin: "MESA",
    tableId: "t7",
    tabNumber: 459,
    status: "READY",
    createdAt: minutesAgo(base, 25),
    discount: 0,
    surcharge: 0,
    payments: [],
    items: [
      { id: "i5", productId: "p5", name: "Frango a Passarinho", quantity: 1, unitPrice: 39.9, addons: [], note: "" },
      { id: "i6", productId: "p8", name: "Água 500ml", quantity: 3, unitPrice: 4, addons: [], note: "" },
    ],
  },
  {
    id: "ord4",
    number: 904,
    origin: "PDV",
    status: "COMPLETED",
    createdAt: minutesAgo(base, 95),
    discount: 0,
    surcharge: 0,
    payments: [
      { id: "pay1", method: "PIX", amount: 58.8, at: minutesAgo(base, 88) },
    ],
    items: [
      { id: "i7", productId: "p2", name: "X-Salada", quantity: 2, unitPrice: 26.9, addons: [], note: "" },
      { id: "i8", productId: "p7", name: "Guaraná 350ml", quantity: 1, unitPrice: 6.5, addons: [], note: "" },
    ],
  },
];

export const buildInitialCash = (base: number): CashSession => ({
  id: "cash1",
  status: "OPEN",
  responsible: "Juliana Alves",
  openingAmount: 200,
  openedAt: minutesAgo(base, 300),
  movements: [
    { id: "cm1", type: "OPENING", amount: 200, description: "Abertura de caixa", at: minutesAgo(base, 300) },
    { id: "cm2", type: "SALE", amount: 58.8, method: "PIX", description: "Pedido #904", orderNumber: 904, at: minutesAgo(base, 88) },
    { id: "cm3", type: "SALE", amount: 112.4, method: "DINHEIRO", description: "Pedido #898", orderNumber: 898, at: minutesAgo(base, 150) },
    { id: "cm4", type: "SALE", amount: 76.5, method: "CREDITO", description: "Pedido #899", orderNumber: 899, at: minutesAgo(base, 130) },
    { id: "cm5", type: "WITHDRAWAL", amount: 100, description: "Sangria — depósito bancário", at: minutesAgo(base, 60) },
  ],
});
