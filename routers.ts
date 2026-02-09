import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import {
  getMenuCategories,
  getMenuItemsByCategory,
  getMenuItemWithModifiers,
  getCombos,
  getComboWithItems,
  getLowStockItems,
  getCustomerByPhone,
  createOrUpdateCustomer,
  createOrder,
  getOrderById,
  getAvailableTables,
  updateTableStatus,
  getEmployeeByUserId,
  startShift,
  endShift,
  getDailySales,
  updateDailySales,
  recordTopItem,
  openCashDrawer,
  closeCashDrawer,
  getOpenCashDrawer,
} from "./db";
import { z } from "zod";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  // Menu Management
  menu: router({
    getCategories: publicProcedure.query(async () => {
      return getMenuCategories();
    }),

    getItemsByCategory: publicProcedure
      .input(z.object({ categoryId: z.number() }))
      .query(async ({ input }) => {
        return getMenuItemsByCategory(input.categoryId);
      }),

    getItemWithModifiers: publicProcedure
      .input(z.object({ itemId: z.number() }))
      .query(async ({ input }) => {
        return getMenuItemWithModifiers(input.itemId);
      }),

    getCombos: publicProcedure.query(async () => {
      return getCombos();
    }),

    getComboWithItems: publicProcedure
      .input(z.object({ comboId: z.number() }))
      .query(async ({ input }) => {
        return getComboWithItems(input.comboId);
      }),
  }),

  // Inventory Management
  inventory: router({
    getLowStockItems: protectedProcedure.query(async () => {
      return getLowStockItems();
    }),
  }),

  // Customer Management
  customer: router({
    getByPhone: publicProcedure
      .input(z.object({ phone: z.string() }))
      .query(async ({ input }) => {
        return getCustomerByPhone(input.phone);
      }),

    createOrUpdate: publicProcedure
      .input(
        z.object({
          phone: z.string(),
          firstName: z.string().optional(),
          lastName: z.string().optional(),
          email: z.string().email().optional(),
        })
      )
      .mutation(async ({ input }) => {
        return createOrUpdateCustomer(
          input.phone,
          input.firstName,
          input.lastName,
          input.email
        );
      }),
  }),

  // Order Management
  order: router({
    create: protectedProcedure
      .input(
        z.object({
          orderType: z.enum(["dine_in", "takeout", "delivery"]),
          customerId: z.number().optional(),
          tableId: z.number().optional(),
          items: z.array(
            z.object({
              menuItemId: z.number().optional(),
              comboId: z.number().optional(),
              quantity: z.number(),
              price: z.number(),
              modifiers: z.any().optional(),
              notes: z.string().optional(),
            })
          ),
          notes: z.string().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        // Generate unique order number
        const orderNumber = `ORD-${Date.now()}`;

        // Calculate totals
        const subtotal = input.items.reduce(
          (sum, item) => sum + item.price * item.quantity,
          0
        );
        const tax = subtotal * 0.08; // 8% tax

        // Create order
        const orderId = await createOrder(
          orderNumber,
          input.orderType,
          subtotal,
          tax,
          input.customerId,
          ctx.user.id,
          input.tableId
        );

        return { orderId, orderNumber, subtotal, tax, total: subtotal + tax };
      }),

    getById: publicProcedure
      .input(z.object({ orderId: z.number() }))
      .query(async ({ input }) => {
        return getOrderById(input.orderId);
      }),
  }),

  // Table Management
  table: router({
    getAvailable: publicProcedure.query(async () => {
      return getAvailableTables();
    }),

    updateStatus: protectedProcedure
      .input(
        z.object({
          tableId: z.number(),
          status: z.enum(["available", "occupied", "reserved", "dirty"]),
        })
      )
      .mutation(async ({ input }) => {
        await updateTableStatus(input.tableId, input.status);
        return { success: true };
      }),
  }),

  // Employee Management
  employee: router({
    getByUserId: protectedProcedure
      .input(z.object({ userId: z.number() }))
      .query(async ({ input }) => {
        return getEmployeeByUserId(input.userId);
      }),

    startShift: protectedProcedure.mutation(async ({ ctx }) => {
      const employee = await getEmployeeByUserId(ctx.user.id);
      if (!employee) {
        throw new Error("Employee not found");
      }
      const shiftId = await startShift(employee.id);
      return { shiftId, success: true };
    }),

    endShift: protectedProcedure
      .input(z.object({ shiftId: z.number(), breakMinutes: z.number() }))
      .mutation(async ({ input }) => {
        await endShift(input.shiftId, input.breakMinutes);
        return { success: true };
      }),
  }),

  // Cash Drawer Management
  cashDrawer: router({
    open: protectedProcedure
      .input(z.object({ openingBalance: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const employee = await getEmployeeByUserId(ctx.user.id);
        if (!employee) {
          throw new Error("Employee not found");
        }
        const drawerId = await openCashDrawer(employee.id, input.openingBalance);
        return { drawerId, success: true };
      }),

    close: protectedProcedure
      .input(
        z.object({
          drawerId: z.number(),
          closingBalance: z.number(),
          expectedTotal: z.number(),
        })
      )
      .mutation(async ({ input }) => {
        await closeCashDrawer(
          input.drawerId,
          input.closingBalance,
          input.expectedTotal
        );
        return { success: true };
      }),

    getOpen: protectedProcedure.query(async ({ ctx }) => {
      const employee = await getEmployeeByUserId(ctx.user.id);
      if (!employee) {
        return null;
      }
      return getOpenCashDrawer(employee.id);
    }),
  }),

  // Sales Reporting
  sales: router({
    getDailySales: protectedProcedure
      .input(z.object({ date: z.date() }))
      .query(async ({ input }) => {
        return getDailySales(input.date);
      }),

    updateDailySales: protectedProcedure
      .input(
        z.object({
          date: z.date(),
          totalOrders: z.number(),
          totalRevenue: z.number(),
          totalTax: z.number(),
          totalDiscount: z.number(),
          cashSales: z.number(),
          cardSales: z.number(),
        })
      )
      .mutation(async ({ input }) => {
        await updateDailySales(
          input.date,
          input.totalOrders,
          input.totalRevenue,
          input.totalTax,
          input.totalDiscount,
          input.cashSales,
          input.cardSales
        );
        return { success: true };
      }),

    recordTopItem: protectedProcedure
      .input(
        z.object({
          date: z.date(),
          menuItemId: z.number().optional(),
          comboId: z.number().optional(),
          quantity: z.number(),
          revenue: z.number(),
        })
      )
      .mutation(async ({ input }) => {
        await recordTopItem(
          input.date,
          input.menuItemId,
          input.comboId,
          input.quantity,
          input.revenue
        );
        return { success: true };
      }),
  }),
});

export type AppRouter = typeof appRouter;
