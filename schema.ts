import {
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
  decimal,
  boolean,
  datetime,
  json,
} from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow with role-based access control.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  phone: varchar("phone", { length: 20 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin", "manager", "cashier", "kitchen"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Employee profiles with shift and performance tracking.
 */
export const employees = mysqlTable("employees", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  employeeId: varchar("employeeId", { length: 50 }).notNull().unique(),
  firstName: varchar("firstName", { length: 100 }).notNull(),
  lastName: varchar("lastName", { length: 100 }).notNull(),
  phone: varchar("phone", { length: 20 }),
  email: varchar("email", { length: 320 }),
  position: mysqlEnum("position", ["cashier", "kitchen_staff", "manager", "owner"]).notNull(),
  hourlyRate: decimal("hourlyRate", { precision: 10, scale: 2 }),
  isActive: boolean("isActive").default(true).notNull(),
  hireDate: datetime("hireDate").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Employee = typeof employees.$inferSelect;
export type InsertEmployee = typeof employees.$inferInsert;

/**
 * Shift tracking for employees.
 */
export const shifts = mysqlTable("shifts", {
  id: int("id").autoincrement().primaryKey(),
  employeeId: int("employeeId").notNull(),
  startTime: datetime("startTime").notNull(),
  endTime: datetime("endTime"),
  breakMinutes: int("breakMinutes").default(0),
  totalHours: decimal("totalHours", { precision: 5, scale: 2 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Shift = typeof shifts.$inferSelect;
export type InsertShift = typeof shifts.$inferInsert;

/**
 * Menu categories for organizing items.
 */
export const menuCategories = mysqlTable("menuCategories", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description"),
  displayOrder: int("displayOrder").default(0),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type MenuCategory = typeof menuCategories.$inferSelect;
export type InsertMenuCategory = typeof menuCategories.$inferInsert;

/**
 * Menu items (chicken pieces, combos, sides, drinks, etc).
 */
export const menuItems = mysqlTable("menuItems", {
  id: int("id").autoincrement().primaryKey(),
  categoryId: int("categoryId").notNull(),
  name: varchar("name", { length: 150 }).notNull(),
  description: text("description"),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  cost: decimal("cost", { precision: 10, scale: 2 }),
  imageUrl: text("imageUrl"),
  isAvailable: boolean("isAvailable").default(true).notNull(),
  prepTime: int("prepTime").default(0), // in seconds
  displayOrder: int("displayOrder").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type MenuItem = typeof menuItems.$inferSelect;
export type InsertMenuItem = typeof menuItems.$inferInsert;

/**
 * Modifiers for customizing menu items (e.g., spice level, sauce options).
 */
export const modifiers = mysqlTable("modifiers", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description"),
  isRequired: boolean("isRequired").default(false),
  displayOrder: int("displayOrder").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Modifier = typeof modifiers.$inferSelect;
export type InsertModifier = typeof modifiers.$inferInsert;

/**
 * Modifier options (e.g., "Mild", "Medium", "Hot" for spice level).
 */
export const modifierOptions = mysqlTable("modifierOptions", {
  id: int("id").autoincrement().primaryKey(),
  modifierId: int("modifierId").notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  priceAdjustment: decimal("priceAdjustment", { precision: 10, scale: 2 }).default("0"),
  displayOrder: int("displayOrder").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ModifierOption = typeof modifierOptions.$inferSelect;
export type InsertModifierOption = typeof modifierOptions.$inferInsert;

/**
 * Menu item to modifier associations.
 */
export const itemModifiers = mysqlTable("itemModifiers", {
  id: int("id").autoincrement().primaryKey(),
  menuItemId: int("menuItemId").notNull(),
  modifierId: int("modifierId").notNull(),
  displayOrder: int("displayOrder").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ItemModifier = typeof itemModifiers.$inferSelect;
export type InsertItemModifier = typeof itemModifiers.$inferInsert;

/**
 * Combo deals (meal bundles).
 */
export const combos = mysqlTable("combos", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 150 }).notNull(),
  description: text("description"),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  imageUrl: text("imageUrl"),
  isAvailable: boolean("isAvailable").default(true).notNull(),
  displayOrder: int("displayOrder").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Combo = typeof combos.$inferSelect;
export type InsertCombo = typeof combos.$inferInsert;

/**
 * Items included in a combo.
 */
export const comboItems = mysqlTable("comboItems", {
  id: int("id").autoincrement().primaryKey(),
  comboId: int("comboId").notNull(),
  menuItemId: int("menuItemId").notNull(),
  quantity: int("quantity").default(1).notNull(),
  displayOrder: int("displayOrder").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ComboItem = typeof comboItems.$inferSelect;
export type InsertComboItem = typeof comboItems.$inferInsert;

/**
 * Inventory items (ingredients and stock tracking).
 */
export const inventory = mysqlTable("inventory", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 150 }).notNull(),
  sku: varchar("sku", { length: 50 }).notNull().unique(),
  description: text("description"),
  unit: varchar("unit", { length: 50 }).notNull(), // e.g., "pieces", "kg", "liters"
  quantity: decimal("quantity", { precision: 15, scale: 2 }).default("0").notNull(),
  minimumLevel: decimal("minimumLevel", { precision: 15, scale: 2 }).default("0"),
  maximumLevel: decimal("maximumLevel", { precision: 15, scale: 2 }),
  unitCost: decimal("unitCost", { precision: 10, scale: 2 }),
  reorderPoint: decimal("reorderPoint", { precision: 15, scale: 2 }),
  reorderQuantity: decimal("reorderQuantity", { precision: 15, scale: 2 }),
  lastRestockDate: datetime("lastRestockDate"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Inventory = typeof inventory.$inferSelect;
export type InsertInventory = typeof inventory.$inferInsert;

/**
 * Inventory transactions (adjustments, usage, restocking).
 */
export const inventoryTransactions = mysqlTable("inventoryTransactions", {
  id: int("id").autoincrement().primaryKey(),
  inventoryId: int("inventoryId").notNull(),
  type: mysqlEnum("type", ["usage", "adjustment", "restock", "return", "damage"]).notNull(),
  quantity: decimal("quantity", { precision: 15, scale: 2 }).notNull(),
  reason: text("reason"),
  employeeId: int("employeeId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type InventoryTransaction = typeof inventoryTransactions.$inferSelect;
export type InsertInventoryTransaction = typeof inventoryTransactions.$inferInsert;

/**
 * Tables for dine-in service.
 */
export const tables = mysqlTable("tables", {
  id: int("id").autoincrement().primaryKey(),
  tableNumber: varchar("tableNumber", { length: 50 }).notNull().unique(),
  capacity: int("capacity").notNull(),
  location: varchar("location", { length: 100 }),
  status: mysqlEnum("status", ["available", "occupied", "reserved", "dirty"]).default("available").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Table = typeof tables.$inferSelect;
export type InsertTable = typeof tables.$inferInsert;

/**
 * Customer loyalty profiles.
 */
export const customers = mysqlTable("customers", {
  id: int("id").autoincrement().primaryKey(),
  phone: varchar("phone", { length: 20 }).notNull().unique(),
  firstName: varchar("firstName", { length: 100 }),
  lastName: varchar("lastName", { length: 100 }),
  email: varchar("email", { length: 320 }),
  loyaltyPoints: decimal("loyaltyPoints", { precision: 15, scale: 2 }).default("0").notNull(),
  totalSpent: decimal("totalSpent", { precision: 15, scale: 2 }).default("0").notNull(),
  visitCount: int("visitCount").default(0).notNull(),
  lastVisit: datetime("lastVisit"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Customer = typeof customers.$inferSelect;
export type InsertCustomer = typeof customers.$inferInsert;

/**
 * Orders (transactions).
 */
export const orders = mysqlTable("orders", {
  id: int("id").autoincrement().primaryKey(),
  orderNumber: varchar("orderNumber", { length: 50 }).notNull().unique(),
  customerId: int("customerId"),
  employeeId: int("employeeId"),
  tableId: int("tableId"),
  orderType: mysqlEnum("orderType", ["dine_in", "takeout", "delivery"]).notNull(),
  status: mysqlEnum("status", ["pending", "confirmed", "preparing", "ready", "completed", "cancelled"]).default("pending").notNull(),
  subtotal: decimal("subtotal", { precision: 10, scale: 2 }).notNull(),
  tax: decimal("tax", { precision: 10, scale: 2 }).default("0"),
  discount: decimal("discount", { precision: 10, scale: 2 }).default("0"),
  total: decimal("total", { precision: 10, scale: 2 }).notNull(),
  loyaltyPointsEarned: decimal("loyaltyPointsEarned", { precision: 15, scale: 2 }).default("0"),
  loyaltyPointsUsed: decimal("loyaltyPointsUsed", { precision: 15, scale: 2 }).default("0"),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  completedAt: datetime("completedAt"),
});

export type Order = typeof orders.$inferSelect;
export type InsertOrder = typeof orders.$inferInsert;

/**
 * Order line items.
 */
export const orderItems = mysqlTable("orderItems", {
  id: int("id").autoincrement().primaryKey(),
  orderId: int("orderId").notNull(),
  menuItemId: int("menuItemId"),
  comboId: int("comboId"),
  quantity: int("quantity").default(1).notNull(),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  modifiers: json("modifiers"), // JSON array of selected modifiers
  notes: text("notes"),
  status: mysqlEnum("status", ["pending", "preparing", "ready", "served", "cancelled"]).default("pending").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type OrderItem = typeof orderItems.$inferSelect;
export type InsertOrderItem = typeof orderItems.$inferInsert;

/**
 * Payments for orders.
 */
export const payments = mysqlTable("payments", {
  id: int("id").autoincrement().primaryKey(),
  orderId: int("orderId").notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  method: mysqlEnum("method", ["cash", "card", "digital_wallet", "split"]).notNull(),
  status: mysqlEnum("status", ["pending", "completed", "failed", "refunded"]).default("pending").notNull(),
  stripePaymentIntentId: varchar("stripePaymentIntentId", { length: 255 }),
  stripeTransactionId: varchar("stripeTransactionId", { length: 255 }),
  reference: varchar("reference", { length: 100 }),
  employeeId: int("employeeId"),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Payment = typeof payments.$inferSelect;
export type InsertPayment = typeof payments.$inferInsert;

/**
 * Split payments for an order.
 */
export const splitPayments = mysqlTable("splitPayments", {
  id: int("id").autoincrement().primaryKey(),
  orderId: int("orderId").notNull(),
  paymentIndex: int("paymentIndex").notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  method: mysqlEnum("method", ["cash", "card", "digital_wallet"]).notNull(),
  status: mysqlEnum("status", ["pending", "completed", "failed"]).default("pending").notNull(),
  stripePaymentIntentId: varchar("stripePaymentIntentId", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type SplitPayment = typeof splitPayments.$inferSelect;
export type InsertSplitPayment = typeof splitPayments.$inferInsert;

/**
 * Receipts (digital records).
 */
export const receipts = mysqlTable("receipts", {
  id: int("id").autoincrement().primaryKey(),
  orderId: int("orderId").notNull(),
  receiptNumber: varchar("receiptNumber", { length: 50 }).notNull().unique(),
  pdfUrl: text("pdfUrl"),
  emailSent: boolean("emailSent").default(false),
  emailSentAt: datetime("emailSentAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Receipt = typeof receipts.$inferSelect;
export type InsertReceipt = typeof receipts.$inferInsert;

/**
 * Daily cash drawer reconciliation.
 */
export const cashDrawers = mysqlTable("cashDrawers", {
  id: int("id").autoincrement().primaryKey(),
  employeeId: int("employeeId").notNull(),
  openingBalance: decimal("openingBalance", { precision: 10, scale: 2 }).default("0"),
  closingBalance: decimal("closingBalance", { precision: 10, scale: 2 }),
  expectedTotal: decimal("expectedTotal", { precision: 10, scale: 2 }),
  variance: decimal("variance", { precision: 10, scale: 2 }),
  status: mysqlEnum("status", ["open", "reconciled", "closed"]).default("open").notNull(),
  notes: text("notes"),
  openedAt: datetime("openedAt").notNull(),
  closedAt: datetime("closedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type CashDrawer = typeof cashDrawers.$inferSelect;
export type InsertCashDrawer = typeof cashDrawers.$inferInsert;

/**
 * Daily sales summaries for reporting.
 */
export const dailySales = mysqlTable("dailySales", {
  id: int("id").autoincrement().primaryKey(),
  date: datetime("date").notNull(),
  totalOrders: int("totalOrders").default(0),
  totalRevenue: decimal("totalRevenue", { precision: 10, scale: 2 }).default("0"),
  totalTax: decimal("totalTax", { precision: 10, scale: 2 }).default("0"),
  totalDiscount: decimal("totalDiscount", { precision: 10, scale: 2 }).default("0"),
  cashSales: decimal("cashSales", { precision: 10, scale: 2 }).default("0"),
  cardSales: decimal("cardSales", { precision: 10, scale: 2 }).default("0"),
  loyaltyPointsIssued: decimal("loyaltyPointsIssued", { precision: 15, scale: 2 }).default("0"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type DailySales = typeof dailySales.$inferSelect;
export type InsertDailySales = typeof dailySales.$inferInsert;

/**
 * Top items report data.
 */
export const topItems = mysqlTable("topItems", {
  id: int("id").autoincrement().primaryKey(),
  date: datetime("date").notNull(),
  menuItemId: int("menuItemId"),
  comboId: int("comboId"),
  quantity: int("quantity").default(0),
  revenue: decimal("revenue", { precision: 10, scale: 2 }).default("0"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type TopItem = typeof topItems.$inferSelect;
export type InsertTopItem = typeof topItems.$inferInsert;
