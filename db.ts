import { eq, and, gte, lte, desc, asc } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser,
  users,
  employees,
  menuItems,
  menuCategories,
  modifiers,
  modifierOptions,
  combos,
  comboItems,
  inventory,
  inventoryTransactions,
  customers,
  orders,
  orderItems,
  payments,
  receipts,
  tables,
  shifts,
  dailySales,
  topItems,
  cashDrawers,
  itemModifiers,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod", "phone"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = "admin";
      updateSet.role = "admin";
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db
    .select()
    .from(users)
    .where(eq(users.openId, openId))
    .limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// Menu Management
export async function getMenuCategories() {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(menuCategories)
    .where(eq(menuCategories.isActive, true))
    .orderBy(asc(menuCategories.displayOrder));
}

export async function getMenuItemsByCategory(categoryId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(menuItems)
    .where(
      and(
        eq(menuItems.categoryId, categoryId),
        eq(menuItems.isAvailable, true)
      )
    )
    .orderBy(asc(menuItems.displayOrder));
}

export async function getMenuItemWithModifiers(itemId: number) {
  const db = await getDb();
  if (!db) return null;

  const item = await db
    .select()
    .from(menuItems)
    .where(eq(menuItems.id, itemId))
    .limit(1);

  if (!item.length) return null;

  const modifierLinks = await db
    .select()
    .from(itemModifiers)
    .where(eq(itemModifiers.menuItemId, itemId));

  const modifierData = await Promise.all(
    modifierLinks.map(async (link) => {
      const mod = await db
        .select()
        .from(modifiers)
        .where(eq(modifiers.id, link.modifierId))
        .limit(1);

      const options = await db
        .select()
        .from(modifierOptions)
        .where(eq(modifierOptions.modifierId, link.modifierId))
        .orderBy(asc(modifierOptions.displayOrder));

      return { ...mod[0], options };
    })
  );

  return { ...item[0], modifiers: modifierData };
}

// Combo Management
export async function getCombos() {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(combos)
    .where(eq(combos.isAvailable, true))
    .orderBy(asc(combos.displayOrder));
}

export async function getComboWithItems(comboId: number) {
  const db = await getDb();
  if (!db) return null;

  const combo = await db
    .select()
    .from(combos)
    .where(eq(combos.id, comboId))
    .limit(1);

  if (!combo.length) return null;

  const items = await db
    .select()
    .from(comboItems)
    .where(eq(comboItems.comboId, comboId))
    .orderBy(asc(comboItems.displayOrder));

  return { ...combo[0], items };
}

// Inventory Management
export async function getInventoryItem(sku: string) {
  const db = await getDb();
  if (!db) return null;

  const result = await db
    .select()
    .from(inventory)
    .where(eq(inventory.sku, sku))
    .limit(1);

  return result.length > 0 ? result[0] : null;
}

export async function getLowStockItems() {
  const db = await getDb();
  if (!db) return [];

  return db
    .select()
    .from(inventory)
    .where(lte(inventory.quantity, inventory.minimumLevel));
}

export async function updateInventoryQuantity(
  inventoryId: number,
  quantity: number,
  type: string,
  reason?: string,
  employeeId?: number
) {
  const db = await getDb();
  if (!db) return;

  // Update inventory quantity
  const item = await db
    .select()
    .from(inventory)
    .where(eq(inventory.id, inventoryId))
    .limit(1);

  if (item.length) {
    const newQuantity = parseFloat(item[0].quantity.toString()) + quantity;
    await db
      .update(inventory)
      .set({ quantity: newQuantity.toString() as any })
      .where(eq(inventory.id, inventoryId));
  }

  // Log transaction
  await db.insert(inventoryTransactions).values({
    inventoryId,
    type: type as any,
    quantity: quantity.toString() as any,
    reason,
    employeeId,
  });
}

// Customer Management
export async function getCustomerByPhone(phone: string) {
  const db = await getDb();
  if (!db) return null;

  const result = await db
    .select()
    .from(customers)
    .where(eq(customers.phone, phone))
    .limit(1);

  return result.length > 0 ? result[0] : null;
}

export async function createOrUpdateCustomer(
  phone: string,
  firstName?: string,
  lastName?: string,
  email?: string
) {
  const db = await getDb();
  if (!db) return null;

  const existing = await getCustomerByPhone(phone);

  if (existing) {
    await db
      .update(customers)
      .set({
        firstName: firstName || existing.firstName,
        lastName: lastName || existing.lastName,
        email: email || existing.email,
        updatedAt: new Date(),
      })
      .where(eq(customers.id, existing.id));
    return existing;
  }

  await db.insert(customers).values({
    phone,
    firstName,
    lastName,
    email,
  });

  return { id: 0, phone, firstName, lastName, email };
}

// Order Management
export async function createOrder(
  orderNumber: string,
  orderType: "dine_in" | "takeout" | "delivery",
  subtotal: number,
  tax: number,
  customerId?: number,
  employeeId?: number,
  tableId?: number
) {
  const db = await getDb();
  if (!db) return null;

  const total = subtotal + tax;

  await db.insert(orders).values({
    orderNumber,
    orderType,
    subtotal: subtotal.toString() as any,
    tax: tax.toString() as any,
    total: total.toString() as any,
    customerId,
    employeeId,
    tableId,
  });

  return orderNumber;
}

export async function getOrderById(orderId: number) {
  const db = await getDb();
  if (!db) return null;

  const result = await db
    .select()
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);

  if (!result.length) return null;

  const items = await db
    .select()
    .from(orderItems)
    .where(eq(orderItems.orderId, orderId));

  return { ...result[0], items };
}

export async function getActiveOrders() {
  const db = await getDb();
  if (!db) return [];

  return db
    .select()
    .from(orders)
    .where(
      and(
        eq(orders.status, "pending"),
        eq(orders.status, "confirmed"),
        eq(orders.status, "preparing"),
        eq(orders.status, "ready")
      )
    )
    .orderBy(desc(orders.createdAt));
}

// Table Management
export async function getAvailableTables() {
  const db = await getDb();
  if (!db) return [];

  return db
    .select()
    .from(tables)
    .where(eq(tables.status, "available"))
    .orderBy(asc(tables.tableNumber));
}

export async function updateTableStatus(
  tableId: number,
  status: "available" | "occupied" | "reserved" | "dirty"
) {
  const db = await getDb();
  if (!db) return;

  await db
    .update(tables)
    .set({ status })
    .where(eq(tables.id, tableId));
}

// Employee Management
export async function getEmployeeByUserId(userId: number) {
  const db = await getDb();
  if (!db) return null;

  const result = await db
    .select()
    .from(employees)
    .where(eq(employees.userId, userId))
    .limit(1);

  return result.length > 0 ? result[0] : null;
}

// Shift Management
export async function startShift(employeeId: number) {
  const db = await getDb();
  if (!db) return null;

  await db.insert(shifts).values({
    employeeId,
    startTime: new Date(),
  });

  return employeeId;
}

export async function endShift(shiftId: number, breakMinutes: number = 0) {
  const db = await getDb();
  if (!db) return;

  const shift = await db
    .select()
    .from(shifts)
    .where(eq(shifts.id, shiftId))
    .limit(1);

  if (shift.length) {
    const startTime = new Date(shift[0].startTime).getTime();
    const endTime = new Date().getTime();
    const totalMinutes = (endTime - startTime) / 60000;
    const totalHours = (totalMinutes - breakMinutes) / 60;

    await db
      .update(shifts)
      .set({
        endTime: new Date(),
        breakMinutes,
        totalHours: parseFloat(totalHours.toFixed(2)).toString() as any,
      })
      .where(eq(shifts.id, shiftId));
  }
}

// Daily Sales
export async function getDailySales(date: Date) {
  const db = await getDb();
  if (!db) return null;

  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  const result = await db
    .select()
    .from(dailySales)
    .where(
      and(
        gte(dailySales.date, startOfDay),
        lte(dailySales.date, endOfDay)
      )
    )
    .limit(1);

  return result.length > 0 ? result[0] : null;
}

export async function updateDailySales(
  date: Date,
  totalOrders: number,
  totalRevenue: number,
  totalTax: number,
  totalDiscount: number,
  cashSales: number,
  cardSales: number
) {
  const db = await getDb();
  if (!db) return;

  const existing = await getDailySales(date);

  if (existing) {
    await db
      .update(dailySales)
      .set({
        totalOrders,
        totalRevenue: totalRevenue.toString() as any,
        totalTax: totalTax.toString() as any,
        totalDiscount: totalDiscount.toString() as any,
        cashSales: cashSales.toString() as any,
        cardSales: cardSales.toString() as any,
        updatedAt: new Date(),
      })
      .where(eq(dailySales.id, existing.id));
  } else {
    await db.insert(dailySales).values({
      date,
      totalOrders,
      totalRevenue: totalRevenue.toString() as any,
      totalTax: totalTax.toString() as any,
      totalDiscount: totalDiscount.toString() as any,
      cashSales: cashSales.toString() as any,
      cardSales: cardSales.toString() as any,
    });
  }
}

// Top Items Report
export async function recordTopItem(
  date: Date,
  menuItemId?: number,
  comboId?: number,
  quantity: number = 0,
  revenue: number = 0
) {
  const db = await getDb();
  if (!db) return;

  await db.insert(topItems).values({
    date,
    menuItemId,
    comboId,
    quantity,
    revenue: revenue.toString() as any,
  });
}

// Cash Drawer
export async function openCashDrawer(
  employeeId: number,
  openingBalance: number
) {
  const db = await getDb();
  if (!db) return null;

  await db.insert(cashDrawers).values({
    employeeId,
    openingBalance: openingBalance.toString() as any,
    openedAt: new Date(),
  });

  return employeeId;
}

export async function closeCashDrawer(
  drawerId: number,
  closingBalance: number,
  expectedTotal: number
) {
  const db = await getDb();
  if (!db) return;

  const variance = closingBalance - expectedTotal;

  await db
    .update(cashDrawers)
    .set({
      closingBalance: closingBalance.toString() as any,
      expectedTotal: expectedTotal.toString() as any,
      variance: variance.toString() as any,
      status: "reconciled",
      closedAt: new Date(),
    })
    .where(eq(cashDrawers.id, drawerId));
}

export async function getOpenCashDrawer(employeeId: number) {
  const db = await getDb();
  if (!db) return null;

  const result = await db
    .select()
    .from(cashDrawers)
    .where(
      and(
        eq(cashDrawers.employeeId, employeeId),
        eq(cashDrawers.status, "open")
      )
    )
    .limit(1);

  return result.length > 0 ? result[0] : null;
}
