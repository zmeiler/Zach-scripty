import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useLocation } from "wouter";
import { ArrowLeft, Plus, Clock, CheckCircle, AlertCircle } from "lucide-react";

export default function Orders() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const mode = new URLSearchParams(window.location.search).get("mode") || "active";

  const orders = [
    {
      id: 1,
      orderNumber: "ORD-001",
      customer: "John Doe",
      items: 3,
      total: "$45.99",
      status: "preparing",
      time: "5 min ago",
    },
    {
      id: 2,
      orderNumber: "ORD-002",
      customer: "Jane Smith",
      items: 2,
      total: "$32.50",
      status: "ready",
      time: "2 min ago",
    },
    {
      id: 3,
      orderNumber: "ORD-003",
      customer: "Walk-in",
      items: 1,
      total: "$18.99",
      status: "pending",
      time: "Just now",
    },
  ];

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "pending":
        return <AlertCircle className="w-5 h-5 text-yellow-600" />;
      case "preparing":
        return <Clock className="w-5 h-5 text-blue-600" />;
      case "ready":
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      default:
        return null;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return "badge-pending";
      case "preparing":
        return "badge-preparing";
      case "ready":
        return "badge-ready";
      default:
        return "";
    }
  };

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
              <h1 className="text-2xl font-bold text-foreground">Orders</h1>
              <p className="text-sm text-muted-foreground">Manage customer orders</p>
            </div>
          </div>

          <Button className="btn-touch bg-accent hover:bg-accent/90 text-accent-foreground gap-2">
            <Plus className="w-5 h-5" />
            New Order
          </Button>
        </div>
      </header>

      {/* Tabs */}
      <div className="bg-card border-b border-border sticky top-16 z-40">
        <div className="container mx-auto px-4">
          <div className="flex gap-8">
            <button
              onClick={() => setLocation("/orders?mode=active")}
              className={`px-4 py-3 border-b-2 font-medium transition-colors ${
                mode === "active"
                  ? "border-accent text-accent"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              Active Orders
            </button>
            <button
              onClick={() => setLocation("/orders?mode=completed")}
              className={`px-4 py-3 border-b-2 font-medium transition-colors ${
                mode === "completed"
                  ? "border-accent text-accent"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              Completed
            </button>
            <button
              onClick={() => setLocation("/orders?mode=history")}
              className={`px-4 py-3 border-b-2 font-medium transition-colors ${
                mode === "history"
                  ? "border-accent text-accent"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              History
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="grid gap-4">
          {orders.map((order) => (
            <Card
              key={order.id}
              className="p-6 card-elegant hover:shadow-lg transition-shadow cursor-pointer"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold text-foreground">
                      {order.orderNumber}
                    </h3>
                    <span className={`badge-status ${getStatusBadge(order.status)}`}>
                      {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">
                    Customer: {order.customer}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {order.items} items • {order.time}
                  </p>
                </div>

                <div className="text-right">
                  <p className="text-2xl font-bold text-foreground mb-2">
                    {order.total}
                  </p>
                  <div className="flex items-center justify-end gap-2">
                    {getStatusIcon(order.status)}
                    <span className="text-sm font-medium text-muted-foreground">
                      {order.status === "ready" ? "Ready" : "In Progress"}
                    </span>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>

        {orders.length === 0 && (
          <div className="text-center py-12">
            <p className="text-lg text-muted-foreground">No orders found</p>
          </div>
        )}
      </main>
    </div>
  );
}
