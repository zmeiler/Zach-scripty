import ctypes
import datetime as dt
import getpass
import json
import os
import random
import secrets
import sys
import uuid
from dataclasses import dataclass, field, asdict
from typing import Dict, List, Optional

import tkinter as tk
from tkinter import messagebox


# =========================
# Terminal style (Windows friendly)
# =========================
def enable_windows_ansi() -> None:
    if os.name != "nt":
        return
    try:
        kernel32 = ctypes.windll.kernel32
        handle = kernel32.GetStdHandle(-11)
        mode = ctypes.c_uint32()
        if kernel32.GetConsoleMode(handle, ctypes.byref(mode)):
            kernel32.SetConsoleMode(handle, mode.value | 0x0004)
    except Exception:
        pass


enable_windows_ansi()

GREEN = "\033[92m"
WHITE = "\033[97m"
DIM = "\033[2m"
BOLD = "\033[1m"
RESET = "\033[0m"


def paint(text: str, color: str = GREEN) -> str:
    return f"{color}{text}{RESET}"


def clear() -> None:
    os.system("cls" if os.name == "nt" else "clear")


def pause() -> None:
    input(paint("\n[Press Enter]", WHITE))


# =========================
# Data model
# =========================
@dataclass
class MenuItem:
    sku: str
    name: str
    price: float
    category: str


@dataclass
class OrderLine:
    sku: str
    name: str
    qty: int
    price: float

    @property
    def total(self) -> float:
        return round(self.qty * self.price, 2)


@dataclass
class PaymentIntent:
    method: str
    amount: float
    approved: bool
    transaction_id: str
    network: str
    wallet: Optional[str] = None
    auth_code: str = ""
    emv_aid: str = ""


@dataclass
class Order:
    order_id: int
    ticket_code: str
    meal_period: str
    order_type: str
    created_at: str
    customer_phone: str = ""
    lines: List[OrderLine] = field(default_factory=list)
    notes: str = ""
    discount_amount: float = 0.0
    comp_amount: float = 0.0
    status: str = "OPEN"

    def add_line(self, item: MenuItem, qty: int) -> None:
        for ln in self.lines:
            if ln.sku == item.sku:
                ln.qty += qty
                return
        self.lines.append(OrderLine(item.sku, item.name, qty, item.price))

    def remove_line(self, sku: str, qty: int) -> bool:
        for ln in self.lines:
            if ln.sku == sku:
                ln.qty -= qty
                if ln.qty <= 0:
                    self.lines.remove(ln)
                return True
        return False

    def subtotal(self) -> float:
        return round(sum(ln.total for ln in self.lines), 2)

    def taxable_base(self) -> float:
        return round(max(0.0, self.subtotal() - self.discount_amount - self.comp_amount), 2)

    def tax(self, tax_rate: float) -> float:
        return round(self.taxable_base() * tax_rate, 2)

    def total(self, tax_rate: float) -> float:
        return round(self.taxable_base() + self.tax(tax_rate), 2)


class PaymentGatewaySimulator:
    """Fake modern payment stack: EMV, NFC Tap, wallets, QR pay."""

    networks = ["Visa", "Mastercard", "Amex", "Discover"]
    wallets = ["Apple Pay", "Google Pay", "Samsung Pay"]

    @staticmethod
    def _simulate_approval(amount: float) -> bool:
        # High approval rate for demo, with occasional declines.
        base = 0.96 if amount < 100 else 0.92
        return random.random() < base

    @staticmethod
    def process(method: str, amount: float) -> PaymentIntent:
        approved = PaymentGatewaySimulator._simulate_approval(amount)
        txn = f"TXN-{uuid.uuid4().hex[:12].upper()}"
        network = random.choice(PaymentGatewaySimulator.networks)
        auth = secrets.token_hex(3).upper()
        emv_aid = f"A0000000{random.randint(100,999)}"
        wallet = random.choice(PaymentGatewaySimulator.wallets) if method == "tap" else None
        return PaymentIntent(
            method=method,
            amount=amount,
            approved=approved,
            transaction_id=txn,
            network=network,
            wallet=wallet,
            auth_code=auth,
            emv_aid=emv_aid,
        )


class DinerPOS:
    DATA_FILE = "pos_state.json"
    MANAGER_PIN = "2468"

    def __init__(self) -> None:
        self.tax_rate = 0.0825
        self.next_order_id = 1001
        self.cash_drawer = 300.00
        self.loyalty_points: Dict[str, int] = {}
        self.daily_sales: List[dict] = []
        self.kitchen_queue: List[dict] = []
        self.inventory: Dict[str, int] = {
            "BRG-01": 60,
            "FRY-01": 80,
            "PAN-01": 50,
            "STK-01": 30,
            "COF-01": 120,
            "SOD-01": 120,
        }

        self.menu: Dict[str, Dict[int, MenuItem]] = {
            "breakfast": {
                1: MenuItem("PAN-01", "Pancake Stack", 8.49, "plate"),
                2: MenuItem("EGB-01", "Egg & Bacon", 9.99, "plate"),
                3: MenuItem("HSH-01", "Hash Browns", 3.99, "side"),
                4: MenuItem("COF-01", "Coffee", 2.79, "drink"),
            },
            "lunch": {
                1: MenuItem("BRG-01", "Cheeseburger", 11.49, "plate"),
                2: MenuItem("FRY-01", "Fries", 4.49, "side"),
                3: MenuItem("CLB-01", "Club Sandwich", 10.99, "plate"),
                4: MenuItem("SOD-01", "Soda", 2.99, "drink"),
            },
            "dinner": {
                1: MenuItem("STK-01", "Steak Plate", 19.99, "plate"),
                2: MenuItem("SLM-01", "Salmon", 18.99, "plate"),
                3: MenuItem("MSH-01", "Mashed Potatoes", 4.99, "side"),
                4: MenuItem("SOD-01", "Soda", 2.99, "drink"),
            },
        }
        self.load_data()

    # ---------- persistence ----------
    def load_data(self) -> None:
        if not os.path.exists(self.DATA_FILE):
            return
        try:
            with open(self.DATA_FILE, "r", encoding="utf-8") as f:
                raw = json.load(f)
            self.tax_rate = raw.get("tax_rate", self.tax_rate)
            self.next_order_id = raw.get("next_order_id", self.next_order_id)
            self.cash_drawer = raw.get("cash_drawer", self.cash_drawer)
            self.loyalty_points = raw.get("loyalty_points", self.loyalty_points)
            self.daily_sales = raw.get("daily_sales", self.daily_sales)
            self.kitchen_queue = raw.get("kitchen_queue", self.kitchen_queue)
            self.inventory = raw.get("inventory", self.inventory)
        except Exception:
            # In case data is corrupted, continue with defaults.
            pass

    def save_data(self) -> None:
        payload = {
            "tax_rate": self.tax_rate,
            "next_order_id": self.next_order_id,
            "cash_drawer": self.cash_drawer,
            "loyalty_points": self.loyalty_points,
            "daily_sales": self.daily_sales,
            "kitchen_queue": self.kitchen_queue,
            "inventory": self.inventory,
        }
        with open(self.DATA_FILE, "w", encoding="utf-8") as f:
            json.dump(payload, f, indent=2)

    # ---------- utility ----------
    def banner(self) -> None:
        print(paint(BOLD + "=============================================="))
        print(paint("  ZACH'S DINER CYBER POS :: Omnichannel v2.0", WHITE))
        print(paint("=============================================="))

    def now(self) -> str:
        return dt.datetime.now().isoformat(timespec="seconds")

    def choose_meal_period(self) -> Optional[str]:
        print(paint("\nChoose Meal Period", WHITE))
        print(paint("[1] Breakfast  [2] Lunch  [3] Dinner"))
        return {"1": "breakfast", "2": "lunch", "3": "dinner"}.get(input(paint("Select > ")).strip())

    def choose_order_type(self) -> str:
        print(paint("\nOrder Type", WHITE))
        print(paint("[1] Dine-In  [2] Takeout  [3] Delivery"))
        return {"1": "dine-in", "2": "takeout", "3": "delivery"}.get(input(paint("Select > ")).strip(), "dine-in")

    def show_menu(self, meal: str) -> None:
        print(paint(f"\n--- {meal.upper()} MENU ---", WHITE))
        for idx, itm in self.menu[meal].items():
            stock = self.inventory.get(itm.sku, 999)
            stock_note = f"stock:{stock}" if stock < 999 else ""
            print(paint(f"[{idx}] {itm.name:<22} ${itm.price:>6.2f}  {DIM}{stock_note}{RESET}"))

    def show_order(self, order: Order) -> None:
        print(paint(f"\nTicket {order.ticket_code} :: #{order.order_id} [{order.status}]", WHITE))
        for ln in order.lines:
            print(paint(f"{ln.sku:<7} {ln.name:<22} x{ln.qty:<2} ${ln.total:>7.2f}"))
        print(paint("-" * 44))
        print(paint(f"Subtotal      ${order.subtotal():.2f}", WHITE))
        if order.discount_amount > 0:
            print(paint(f"Promo Disc   -${order.discount_amount:.2f}", WHITE))
        if order.comp_amount > 0:
            print(paint(f"Manager Comp -${order.comp_amount:.2f}", WHITE))
        print(paint(f"Tax          ${order.tax(self.tax_rate):.2f}", WHITE))
        print(paint(f"TOTAL        ${order.total(self.tax_rate):.2f}", WHITE))

    # ---------- workflows ----------
    def main_menu(self) -> None:
        while True:
            clear()
            self.banner()
            print(paint("\n[1] New Order"))
            print(paint("[2] Kitchen Display Board"))
            print(paint("[3] Manager Console"))
            print(paint("[4] Exit", WHITE))
            cmd = input(paint("\nCommand > ")).strip()
            if cmd == "1":
                self.new_order()
            elif cmd == "2":
                self.kitchen_board()
            elif cmd == "3":
                self.manager_console()
            elif cmd == "4":
                self.save_data()
                print(paint("State saved. Shutting down.", WHITE))
                break
            else:
                print(paint("Invalid selection.", WHITE))
                pause()

    def new_order(self) -> None:
        clear()
        self.banner()
        meal = self.choose_meal_period()
        if not meal:
            print(paint("Invalid meal period.", WHITE))
            pause()
            return

        order = Order(
            order_id=self.next_order_id,
            ticket_code=secrets.token_hex(3).upper(),
            meal_period=meal,
            order_type=self.choose_order_type(),
            created_at=self.now(),
        )
        self.next_order_id += 1

        phone = input(paint("Customer phone (optional, for loyalty) > ", WHITE)).strip()
        order.customer_phone = phone
        note = input(paint("Order notes (allergies/table/etc, optional) > ", WHITE)).strip()
        order.notes = note

        while True:
            clear()
            self.banner()
            print(paint(f"\nOrder #{order.order_id} / {order.order_type.upper()} / {meal.upper()}", WHITE))
            self.show_menu(meal)
            print(paint("\n[A] Add  [R] Remove  [V] View  [P] Apply Promo  [C] Checkout  [X] Cancel", WHITE))
            cmd = input(paint("Action > ")).strip().lower()

            if cmd == "a":
                self._add_item_to_order(order, meal)
            elif cmd == "r":
                self._remove_item_from_order(order)
            elif cmd == "v":
                self.show_order(order)
                pause()
            elif cmd == "p":
                self.apply_promo(order)
                pause()
            elif cmd == "c":
                if not order.lines:
                    print(paint("Order is empty.", WHITE))
                    pause()
                    continue
                if self.checkout(order):
                    pause()
                    return
            elif cmd == "x":
                print(paint("Order canceled.", WHITE))
                pause()
                return
            else:
                print(paint("Unknown command.", WHITE))
                pause()

    def _add_item_to_order(self, order: Order, meal: str) -> None:
        try:
            idx = int(input(paint("Item number > ")).strip())
            qty = int(input(paint("Qty > ")).strip())
            item = self.menu[meal].get(idx)
            if not item or qty <= 0:
                raise ValueError
            stock = self.inventory.get(item.sku, 999)
            if stock < qty:
                print(paint(f"Insufficient stock. Available {stock}.", WHITE))
                pause()
                return
            order.add_line(item, qty)
            if item.sku in self.inventory:
                self.inventory[item.sku] -= qty
            print(paint("Added.", WHITE))
        except ValueError:
            print(paint("Invalid input.", WHITE))
        pause()

    def _remove_item_from_order(self, order: Order) -> None:
        try:
            sku = input(paint("SKU to remove > ")).strip().upper()
            qty = int(input(paint("Qty to remove > ")).strip())
            if qty <= 0:
                raise ValueError
            if order.remove_line(sku, qty):
                if sku in self.inventory:
                    self.inventory[sku] += qty
                print(paint("Removed.", WHITE))
            else:
                print(paint("SKU not in order.", WHITE))
        except ValueError:
            print(paint("Invalid value.", WHITE))
        pause()

    def apply_promo(self, order: Order) -> None:
        code = input(paint("Promo code (SAVE10 / NIGHT5) > ", WHITE)).strip().upper()
        if code == "SAVE10":
            order.discount_amount = round(order.subtotal() * 0.10, 2)
            print(paint("10% promo applied.", WHITE))
        elif code == "NIGHT5" and order.meal_period == "dinner":
            order.discount_amount = 5.00
            print(paint("$5 dinner promo applied.", WHITE))
        else:
            print(paint("Promo invalid or not applicable.", WHITE))

    def checkout(self, order: Order) -> bool:
        clear()
        self.banner()
        self.show_order(order)
        total = order.total(self.tax_rate)

        print(paint("\nPayment Methods", WHITE))
        print(paint("[1] Cash"))
        print(paint("[2] Chip Card (EMV)"))
        print(paint("[3] Tap-to-Pay (NFC Wallet/Card)"))
        print(paint("[4] Online Link / QR Pay"))

        method_select = input(paint("Select payment > ")).strip()
        payment_record = None

        if method_select == "1":
            try:
                cash = float(input(paint("Cash received > $", WHITE)).strip())
                if cash < total:
                    print(paint("Insufficient amount.", WHITE))
                    return False
                change = round(cash - total, 2)
                self.cash_drawer += total
                payment_record = {
                    "method": "cash",
                    "received": round(cash, 2),
                    "change": change,
                    "approved": True,
                    "transaction_id": "CASH",
                }
                print(paint(f"Change due: ${change:.2f}", WHITE))
            except ValueError:
                print(paint("Invalid cash value.", WHITE))
                return False
        else:
            map_method = {"2": "card", "3": "tap", "4": "qr"}
            method = map_method.get(method_select)
            if method is None:
                print(paint("Unknown payment method.", WHITE))
                return False
            intent = PaymentGatewaySimulator.process(method, total)
            if not intent.approved:
                print(paint("Transaction declined by issuer.", WHITE))
                return False
            payment_record = asdict(intent)
            print(paint("Payment approved.", WHITE))
            print(paint(f"Txn: {intent.transaction_id} Auth: {intent.auth_code} Net: {intent.network}", WHITE))
            if intent.wallet:
                print(paint(f"Wallet: {intent.wallet}", WHITE))

        order.status = "PAID"
        self._add_loyalty(order.customer_phone, total)
        self._enqueue_kitchen(order)
        self._record_sale(order, payment_record)
        self.save_data()
        print(paint("Receipt stored + sent to kitchen board.", WHITE))
        return True

    def _add_loyalty(self, phone: str, total: float) -> None:
        if not phone:
            return
        pts = int(total)
        self.loyalty_points[phone] = self.loyalty_points.get(phone, 0) + pts

    def _enqueue_kitchen(self, order: Order) -> None:
        item_names = [f"{ln.name} x{ln.qty}" for ln in order.lines]
        self.kitchen_queue.append(
            {
                "ticket": order.ticket_code,
                "order_id": order.order_id,
                "created": order.created_at,
                "items": item_names,
                "notes": order.notes,
                "status": "QUEUED",
            }
        )

    def _record_sale(self, order: Order, payment: dict) -> None:
        self.daily_sales.append(
            {
                "order_id": order.order_id,
                "ticket": order.ticket_code,
                "time": self.now(),
                "meal": order.meal_period,
                "order_type": order.order_type,
                "customer_phone": order.customer_phone,
                "lines": [asdict(ln) for ln in order.lines],
                "subtotal": order.subtotal(),
                "discount": order.discount_amount,
                "comp": order.comp_amount,
                "tax": order.tax(self.tax_rate),
                "total": order.total(self.tax_rate),
                "payment": payment,
            }
        )

    def kitchen_board(self) -> None:
        clear()
        self.banner()
        print(paint("\nKITCHEN DISPLAY BOARD", WHITE))
        if not self.kitchen_queue:
            print(paint("No active tickets."))
            pause()
            return
        for i, t in enumerate(self.kitchen_queue, start=1):
            print(paint(f"\n[{i}] Ticket {t['ticket']}  Status:{t['status']}  Created:{t['created']}", WHITE))
            for item in t["items"]:
                print(paint(f"   - {item}"))
            if t["notes"]:
                print(paint(f"   Note: {t['notes']}", DIM))

        cmd = input(paint("\nType ticket # to mark READY, or Enter to exit > ", WHITE)).strip()
        if not cmd:
            return
        try:
            idx = int(cmd)
            if 1 <= idx <= len(self.kitchen_queue):
                self.kitchen_queue[idx - 1]["status"] = "READY"
                print(paint("Ticket updated to READY.", WHITE))
                self.save_data()
            else:
                print(paint("Out of range.", WHITE))
        except ValueError:
            print(paint("Invalid selection.", WHITE))
        pause()

    # ---------- manager ----------
    def manager_console(self) -> None:
        clear()
        self.banner()
        pin = getpass.getpass(paint("Manager PIN > ", WHITE))
        if pin != self.MANAGER_PIN:
            print(paint("Access denied.", WHITE))
            pause()
            return

        while True:
            clear()
            self.banner()
            print(paint("\nMANAGER CONSOLE", WHITE))
            print(paint("[1] Sales Analytics"))
            print(paint("[2] Edit Menu Price"))
            print(paint("[3] Comp/Discount Last Ticket"))
            print(paint("[4] Refund Last Card Transaction"))
            print(paint("[5] Inventory Snapshot"))
            print(paint("[6] Close Day (Z Report)"))
            print(paint("[7] Back", WHITE))
            cmd = input(paint("Select > ")).strip()

            if cmd == "1":
                self.sales_analytics()
            elif cmd == "2":
                self.edit_menu_price()
            elif cmd == "3":
                self.comp_last_order()
            elif cmd == "4":
                self.refund_last_card_transaction()
            elif cmd == "5":
                self.inventory_snapshot()
            elif cmd == "6":
                self.close_day()
            elif cmd == "7":
                return
            else:
                print(paint("Invalid option.", WHITE))
                pause()

    def sales_analytics(self) -> None:
        total_orders = len(self.daily_sales)
        gross = round(sum(s["total"] for s in self.daily_sales), 2)
        tax = round(sum(s["tax"] for s in self.daily_sales), 2)
        payment_breakdown: Dict[str, float] = {}
        for s in self.daily_sales:
            method = s["payment"]["method"]
            payment_breakdown[method] = payment_breakdown.get(method, 0.0) + s["total"]

        print(paint("\n=== REALTIME SALES ANALYTICS ===", WHITE))
        print(paint(f"Orders: {total_orders}"))
        print(paint(f"Gross: ${gross:.2f}"))
        print(paint(f"Tax:   ${tax:.2f}"))
        print(paint(f"Cash Drawer: ${self.cash_drawer:.2f}"))
        print(paint("Payments:", WHITE))
        if not payment_breakdown:
            print(paint("  none"))
        for k, v in payment_breakdown.items():
            print(paint(f"  - {k:<5} ${v:.2f}"))
        pause()

    def edit_menu_price(self) -> None:
        meal = self.choose_meal_period()
        if not meal:
            print(paint("Invalid meal period.", WHITE))
            pause()
            return
        self.show_menu(meal)
        try:
            idx = int(input(paint("Item number > ")).strip())
            item = self.menu[meal].get(idx)
            if not item:
                raise ValueError
            new_price = float(input(paint("New price > $")).strip())
            if new_price <= 0:
                raise ValueError
            item.price = round(new_price, 2)
            self.save_data()
            print(paint("Price updated.", WHITE))
        except ValueError:
            print(paint("Invalid input.", WHITE))
        pause()

    def comp_last_order(self) -> None:
        if not self.daily_sales:
            print(paint("No completed sales yet.", WHITE))
            pause()
            return
        last = self.daily_sales[-1]
        try:
            amt = float(input(paint("Comp amount for last ticket > $")).strip())
            if amt <= 0 or amt > last["total"]:
                raise ValueError
            last["comp"] = round(last.get("comp", 0.0) + amt, 2)
            last["total"] = round(max(0.0, last["total"] - amt), 2)
            print(paint("Comp applied to recorded sale.", WHITE))
            self.save_data()
        except ValueError:
            print(paint("Invalid comp amount.", WHITE))
        pause()

    def refund_last_card_transaction(self) -> None:
        for sale in reversed(self.daily_sales):
            if sale["payment"]["method"] in {"card", "tap", "qr"}:
                sale["status"] = "REFUNDED"
                sale["payment"]["refund_txn"] = f"RFND-{uuid.uuid4().hex[:10].upper()}"
                print(paint(f"Refunded order #{sale['order_id']}.", WHITE))
                self.save_data()
                pause()
                return
        print(paint("No card/tap/qr transactions to refund.", WHITE))
        pause()

    def inventory_snapshot(self) -> None:
        print(paint("\n=== INVENTORY ===", WHITE))
        for sku, qty in self.inventory.items():
            flag = "LOW" if qty < 15 else "OK"
            print(paint(f"{sku:<8} {qty:<4} {flag}"))
        pause()

    def close_day(self) -> None:
        print(paint("\n=== Z REPORT ===", WHITE))
        self.sales_analytics()
        confirm = input(paint("Type CLOSE to archive and reset day > ", WHITE)).strip().upper()
        if confirm == "CLOSE":
            archive_name = f"z_report_{dt.datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
            with open(archive_name, "w", encoding="utf-8") as f:
                json.dump(self.daily_sales, f, indent=2)
            self.daily_sales = []
            self.kitchen_queue = []
            self.save_data()
            print(paint(f"Day closed. Archive: {archive_name}", WHITE))
        else:
            print(paint("Close canceled.", WHITE))
        pause()


class NCRTouchPOSGUI:
    """Touch-first POS interface for NCR-style counter terminals."""

    def __init__(self, pos: DinerPOS) -> None:
        self.pos = pos
        self.current_meal = "breakfast"
        self.current_order: Optional[Order] = None

        self.root = tk.Tk()
        self.root.title("Zach Diner NCR Touch POS")
        self.root.geometry("1280x800")
        self.root.configure(bg="#03120a")

        default_font = ("Segoe UI", 15, "bold")

        header = tk.Frame(self.root, bg="#03120a")
        header.pack(fill="x", padx=12, pady=8)

        self.title_lbl = tk.Label(
            header,
            text="ZACH DINER :: NCR TOUCH POS",
            fg="#d7ffe7",
            bg="#03120a",
            font=("Consolas", 22, "bold"),
        )
        self.title_lbl.pack(side="left")

        self.clock_lbl = tk.Label(header, fg="#6dff9c", bg="#03120a", font=("Consolas", 14, "bold"))
        self.clock_lbl.pack(side="right")

        body = tk.Frame(self.root, bg="#03120a")
        body.pack(fill="both", expand=True, padx=12, pady=8)

        left = tk.Frame(body, bg="#03120a")
        left.pack(side="left", fill="both", expand=True)
        right = tk.Frame(body, bg="#03120a", width=420)
        right.pack(side="right", fill="y")

        top_controls = tk.Frame(left, bg="#03120a")
        top_controls.pack(fill="x", pady=6)

        for meal in ["breakfast", "lunch", "dinner"]:
            tk.Button(
                top_controls,
                text=meal.upper(),
                command=lambda m=meal: self.set_meal(m),
                font=default_font,
                bg="#0f3d24",
                fg="#ecfff4",
                activebackground="#1f6b42",
                width=12,
                height=2,
            ).pack(side="left", padx=6)

        tk.Button(
            top_controls,
            text="NEW ORDER",
            command=self.start_new_order,
            font=default_font,
            bg="#124d2e",
            fg="white",
            width=14,
            height=2,
        ).pack(side="left", padx=6)

        self.menu_area = tk.Frame(left, bg="#03120a")
        self.menu_area.pack(fill="both", expand=True, pady=8)

        tk.Label(right, text="CURRENT TICKET", fg="#d7ffe7", bg="#03120a", font=("Consolas", 18, "bold")).pack(anchor="w")

        self.order_text = tk.Text(right, width=38, height=22, font=("Consolas", 13), bg="#021008", fg="#8dffb8")
        self.order_text.pack(fill="x", pady=8)

        controls = tk.Frame(right, bg="#03120a")
        controls.pack(fill="x", pady=8)

        tk.Button(controls, text="REMOVE SELECTED SKU", command=self.remove_item_prompt, font=default_font, bg="#5b1d1d", fg="white", height=2).pack(fill="x", pady=4)
        tk.Button(controls, text="APPLY SAVE10", command=lambda: self.apply_promo("SAVE10"), font=default_font, bg="#335d17", fg="white", height=2).pack(fill="x", pady=4)
        tk.Button(controls, text="CHECKOUT CASH", command=lambda: self.checkout("cash"), font=default_font, bg="#0f4a2f", fg="white", height=2).pack(fill="x", pady=4)
        tk.Button(controls, text="CHECKOUT CHIP", command=lambda: self.checkout("card"), font=default_font, bg="#0f4a2f", fg="white", height=2).pack(fill="x", pady=4)
        tk.Button(controls, text="CHECKOUT TAP", command=lambda: self.checkout("tap"), font=default_font, bg="#0f4a2f", fg="white", height=2).pack(fill="x", pady=4)
        tk.Button(controls, text="CHECKOUT QR", command=lambda: self.checkout("qr"), font=default_font, bg="#0f4a2f", fg="white", height=2).pack(fill="x", pady=4)

        self.status_lbl = tk.Label(right, text="Ready.", fg="#ecfff4", bg="#03120a", font=("Segoe UI", 13, "bold"))
        self.status_lbl.pack(anchor="w", pady=8)

        self.start_new_order()
        self.render_menu_buttons()
        self.tick_clock()

    def tick_clock(self) -> None:
        self.clock_lbl.configure(text=dt.datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
        self.root.after(1000, self.tick_clock)

    def set_status(self, txt: str) -> None:
        self.status_lbl.configure(text=txt)

    def set_meal(self, meal: str) -> None:
        self.current_meal = meal
        self.render_menu_buttons()
        self.set_status(f"Meal menu switched to {meal}.")

    def start_new_order(self) -> None:
        self.current_order = Order(
            order_id=self.pos.next_order_id,
            ticket_code=secrets.token_hex(3).upper(),
            meal_period=self.current_meal,
            order_type="dine-in",
            created_at=self.pos.now(),
        )
        self.pos.next_order_id += 1
        self.render_order()
        self.set_status(f"Started Order #{self.current_order.order_id}")

    def render_menu_buttons(self) -> None:
        for child in self.menu_area.winfo_children():
            child.destroy()

        items = self.pos.menu[self.current_meal]
        row = 0
        col = 0
        for idx, itm in items.items():
            stock = self.pos.inventory.get(itm.sku, 999)
            txt = f"{itm.name}\n${itm.price:.2f}\nSKU:{itm.sku}  Stock:{stock}"
            btn = tk.Button(
                self.menu_area,
                text=txt,
                command=lambda i=itm: self.add_item(i),
                font=("Segoe UI", 14, "bold"),
                bg="#114027",
                fg="#e9fff2",
                activebackground="#1a613b",
                width=22,
                height=5,
                wraplength=220,
                justify="center",
            )
            btn.grid(row=row, column=col, padx=8, pady=8, sticky="nsew")
            col += 1
            if col > 2:
                col = 0
                row += 1

        for i in range(3):
            self.menu_area.columnconfigure(i, weight=1)

    def add_item(self, item: MenuItem) -> None:
        if not self.current_order:
            return
        stock = self.pos.inventory.get(item.sku, 999)
        if stock < 1:
            messagebox.showwarning("Out of stock", f"{item.name} is out of stock.")
            return
        self.current_order.add_line(item, 1)
        if item.sku in self.pos.inventory:
            self.pos.inventory[item.sku] -= 1
        self.render_order()
        self.render_menu_buttons()

    def remove_item_prompt(self) -> None:
        if not self.current_order:
            return
        sku = self.simple_prompt("Enter SKU to remove")
        if not sku:
            return
        removed = self.current_order.remove_line(sku.upper(), 1)
        if removed and sku.upper() in self.pos.inventory:
            self.pos.inventory[sku.upper()] += 1
        if not removed:
            messagebox.showinfo("Not found", "SKU not in current order.")
        self.render_order()
        self.render_menu_buttons()

    def simple_prompt(self, title: str) -> str:
        popup = tk.Toplevel(self.root)
        popup.title(title)
        popup.geometry("380x140")
        popup.configure(bg="#03120a")
        tk.Label(popup, text=title, bg="#03120a", fg="#e7fff0", font=("Segoe UI", 13, "bold")).pack(pady=8)
        entry = tk.Entry(popup, font=("Segoe UI", 14))
        entry.pack(pady=6)
        entry.focus_set()
        result = {"value": ""}

        def done() -> None:
            result["value"] = entry.get().strip()
            popup.destroy()

        tk.Button(popup, text="OK", command=done, font=("Segoe UI", 12, "bold"), bg="#124d2e", fg="white", width=12).pack(pady=6)
        popup.grab_set()
        self.root.wait_window(popup)
        return result["value"]

    def apply_promo(self, code: str) -> None:
        if not self.current_order:
            return
        if code == "SAVE10":
            self.current_order.discount_amount = round(self.current_order.subtotal() * 0.1, 2)
            self.set_status("Applied SAVE10 promo.")
        self.render_order()

    def checkout(self, method: str) -> None:
        if not self.current_order or not self.current_order.lines:
            messagebox.showwarning("No items", "Add items before checkout.")
            return

        total = self.current_order.total(self.pos.tax_rate)
        payment_record: dict

        if method == "cash":
            cash_txt = self.simple_prompt(f"Total ${total:.2f}. Enter cash received")
            try:
                cash = float(cash_txt)
                if cash < total:
                    raise ValueError
            except ValueError:
                messagebox.showerror("Payment", "Invalid or insufficient cash amount.")
                return
            payment_record = {
                "method": "cash",
                "received": round(cash, 2),
                "change": round(cash - total, 2),
                "approved": True,
                "transaction_id": "CASH",
            }
            self.pos.cash_drawer += total
        else:
            intent = PaymentGatewaySimulator.process(method, total)
            if not intent.approved:
                messagebox.showerror("Declined", "Transaction declined.")
                return
            payment_record = asdict(intent)

        self.current_order.status = "PAID"
        self.pos._enqueue_kitchen(self.current_order)
        self.pos._record_sale(self.current_order, payment_record)
        self.pos.save_data()

        messagebox.showinfo("Paid", f"Payment successful. Total ${total:.2f}")
        self.start_new_order()

    def render_order(self) -> None:
        self.order_text.delete("1.0", tk.END)
        if not self.current_order:
            return
        o = self.current_order
        self.order_text.insert(tk.END, f"Order #{o.order_id}  Ticket:{o.ticket_code}\n")
        self.order_text.insert(tk.END, f"Meal:{self.current_meal.upper()}  Type:{o.order_type}\n")
        self.order_text.insert(tk.END, "-" * 40 + "\n")
        for ln in o.lines:
            self.order_text.insert(tk.END, f"{ln.sku:<7} {ln.name:<18} x{ln.qty:<2} ${ln.total:>6.2f}\n")
        self.order_text.insert(tk.END, "-" * 40 + "\n")
        self.order_text.insert(tk.END, f"Subtotal: ${o.subtotal():.2f}\n")
        if o.discount_amount > 0:
            self.order_text.insert(tk.END, f"Discount: -${o.discount_amount:.2f}\n")
        self.order_text.insert(tk.END, f"Tax:      ${o.tax(self.pos.tax_rate):.2f}\n")
        self.order_text.insert(tk.END, f"TOTAL:    ${o.total(self.pos.tax_rate):.2f}\n")

    def run(self) -> None:
        self.root.mainloop()


if __name__ == "__main__":
    app = DinerPOS()
    if "--gui" in sys.argv:
        gui = NCRTouchPOSGUI(app)
        gui.run()
    else:
        app.main_menu()
