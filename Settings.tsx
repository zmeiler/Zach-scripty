import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useLocation } from "wouter";
import { ArrowLeft, Menu, Package, Users, AlertCircle } from "lucide-react";
import { useState } from "react";

export default function Settings() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState("menu");

  const menuItems = [
    { id: 1, name: "Crispy Chicken Combo", category: "Combos", price: "$24.99", available: true },
    { id: 2, name: "Spicy Wings (10pc)", category: "Wings", price: "$12.00", available: true },
    { id: 3, name: "Fried Chicken Breast", category: "Pieces", price: "$8.99", available: true },
    { id: 4, name: "Chicken Tenders", category: "Sides", price: "$6.99", available: false },
  ];

  const inventory = [
    { id: 1, name: "Chicken Breast", sku: "CHK-001", quantity: 45, unit: "kg", minimum: 20, status: "ok" },
    { id: 2, name: "Chicken Wings", sku: "CHK-002", quantity: 12, unit: "kg", minimum: 25, status: "low" },
    { id: 3, name: "Cooking Oil", sku: "OIL-001", quantity: 8, unit: "L", minimum: 10, status: "low" },
    { id: 4, name: "Flour", sku: "FLR-001", quantity: 50, unit: "kg", minimum: 30, status: "ok" },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted">
      {/* Header */}
      <header className="bg-card border-b border-border sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setLocation("/")}
              className="text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Settings</h1>
              <p className="text-sm text-muted-foreground">Configure menu and inventory</p>
            </div>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="bg-card border-b border-border sticky top-16 z-40">
        <div className="container mx-auto px-4">
          <div className="flex gap-8">
            <button
              onClick={() => setActiveTab("menu")}
              className={`px-4 py-3 border-b-2 font-medium transition-colors flex items-center gap-2 ${
                activeTab === "menu"
                  ? "border-accent text-accent"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Menu className="w-4 h-4" />
              Menu Items
            </button>
            <button
              onClick={() => setActiveTab("inventory")}
              className={`px-4 py-3 border-b-2 font-medium transition-colors flex items-center gap-2 ${
                activeTab === "inventory"
                  ? "border-accent text-accent"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Package className="w-4 h-4" />
              Inventory
            </button>
            <button
              onClick={() => setActiveTab("employees")}
              className={`px-4 py-3 border-b-2 font-medium transition-colors flex items-center gap-2 ${
                activeTab === "employees"
                  ? "border-accent text-accent"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Users className="w-4 h-4" />
              Employees
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <main className="container mx-auto px-4 py-8">
        {activeTab === "menu" && (
          <div className="space-y-4">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold text-foreground">Menu Items</h2>
              <Button className="btn-touch bg-accent hover:bg-accent/90 text-accent-foreground">
                Add Item
              </Button>
            </div>

            <div className="grid gap-4">
              {menuItems.map((item) => (
                <Card key={item.id} className="p-4 card-elegant">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold text-foreground">{item.name}</h3>
                      <p className="text-sm text-muted-foreground">{item.category}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-foreground">{item.price}</p>
                      <span
                        className={`text-sm font-medium ${
                          item.available
                            ? "text-green-600"
                            : "text-red-600"
                        }`}
                      >
                        {item.available ? "Available" : "Unavailable"}
                      </span>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {activeTab === "inventory" && (
          <div className="space-y-4">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold text-foreground">Inventory</h2>
              <Button className="btn-touch bg-accent hover:bg-accent/90 text-accent-foreground">
                Add Item
              </Button>
            </div>

            {/* Low Stock Alert */}
            <Card className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-yellow-900 dark:text-yellow-100">
                    Low Stock Alert
                  </h3>
                  <p className="text-sm text-yellow-800 dark:text-yellow-200">
                    2 items are below minimum stock levels. Please reorder soon.
                  </p>
                </div>
              </div>
            </Card>

            <div className="grid gap-4">
              {inventory.map((item) => (
                <Card key={item.id} className="p-4 card-elegant">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold text-foreground">{item.name}</h3>
                      <p className="text-sm text-muted-foreground">SKU: {item.sku}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-foreground">
                        {item.quantity} {item.unit}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Min: {item.minimum} {item.unit}
                      </p>
                      {item.status === "low" && (
                        <span className="text-xs font-medium text-red-600">
                          ⚠ Low Stock
                        </span>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {activeTab === "employees" && (
          <div className="space-y-4">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold text-foreground">Employees</h2>
              <Button className="btn-touch bg-accent hover:bg-accent/90 text-accent-foreground">
                Add Employee
              </Button>
            </div>

            <Card className="p-6 card-elegant">
              <div className="text-center py-8">
                <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-lg font-medium text-foreground mb-2">
                  Employee Management
                </p>
                <p className="text-sm text-muted-foreground mb-4">
                  Manage staff roles, shifts, and permissions
                </p>
                <Button className="btn-touch bg-accent hover:bg-accent/90 text-accent-foreground">
                  Coming Soon
                </Button>
              </div>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}
