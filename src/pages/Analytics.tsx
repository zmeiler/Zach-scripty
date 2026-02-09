import { useAuth } from "../_core/hooks/useAuth";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { useLocation } from "wouter";
import { ArrowLeft, TrendingUp, DollarSign, ShoppingCart, Clock } from "lucide-react";

export default function Analytics() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  const stats = [
    {
      label: "Today's Revenue",
      value: "$2,450.50",
      change: "+12.5%",
      icon: DollarSign,
      color: "text-green-600",
      bgColor: "bg-green-50 dark:bg-green-900/20",
    },
    {
      label: "Total Orders",
      value: "48",
      change: "+8 from yesterday",
      icon: ShoppingCart,
      color: "text-blue-600",
      bgColor: "bg-blue-50 dark:bg-blue-900/20",
    },
    {
      label: "Average Order Value",
      value: "$51.05",
      change: "+2.3%",
      icon: TrendingUp,
      color: "text-purple-600",
      bgColor: "bg-purple-50 dark:bg-purple-900/20",
    },
    {
      label: "Peak Hour",
      value: "12:00 PM",
      change: "18 orders",
      icon: Clock,
      color: "text-orange-600",
      bgColor: "bg-orange-50 dark:bg-orange-900/20",
    },
  ];

  const topItems = [
    { name: "Crispy Chicken Combo", orders: 24, revenue: "$576.00" },
    { name: "Spicy Wings (10pc)", orders: 18, revenue: "$288.00" },
    { name: "Fried Chicken Breast", orders: 16, revenue: "$304.00" },
    { name: "Chicken Tenders", orders: 14, revenue: "$210.00" },
    { name: "Grilled Chicken Sandwich", orders: 12, revenue: "$156.00" },
  ];

  const hourlyData = [
    { hour: "10 AM", orders: 5, revenue: 125 },
    { hour: "11 AM", orders: 12, revenue: 312 },
    { hour: "12 PM", orders: 18, revenue: 468 },
    { hour: "1 PM", orders: 14, revenue: 364 },
    { hour: "2 PM", orders: 8, revenue: 208 },
    { hour: "5 PM", orders: 10, revenue: 260 },
    { hour: "6 PM", orders: 15, revenue: 390 },
    { hour: "7 PM", orders: 12, revenue: 312 },
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
              <h1 className="text-2xl font-bold text-foreground">Analytics</h1>
              <p className="text-sm text-muted-foreground">Sales reports and insights</p>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="container mx-auto px-4 py-8">
        {/* Key Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <Card key={stat.label} className="p-6 card-elegant">
                <div className="flex items-start justify-between mb-4">
                  <div className={`w-12 h-12 rounded-lg ${stat.bgColor} flex items-center justify-center`}>
                    <Icon className={`w-6 h-6 ${stat.color}`} />
                  </div>
                  <span className="text-sm font-medium text-green-600">
                    {stat.change}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground mb-1">{stat.label}</p>
                <p className="text-2xl font-bold text-foreground">{stat.value}</p>
              </Card>
            );
          })}
        </div>

        {/* Top Items */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          <Card className="p-6 card-elegant">
            <h3 className="text-lg font-semibold text-foreground mb-4">Top Items</h3>
            <div className="space-y-4">
              {topItems.map((item, index) => (
                <div key={item.name} className="flex items-center justify-between pb-4 border-b border-border last:border-0">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center">
                      <span className="text-sm font-semibold text-accent">
                        {index + 1}
                      </span>
                    </div>
                    <div>
                      <p className="font-medium text-foreground">{item.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {item.orders} orders
                      </p>
                    </div>
                  </div>
                  <p className="font-semibold text-foreground">{item.revenue}</p>
                </div>
              ))}
            </div>
          </Card>

          {/* Hourly Breakdown */}
          <Card className="p-6 card-elegant">
            <h3 className="text-lg font-semibold text-foreground mb-4">
              Hourly Breakdown
            </h3>
            <div className="space-y-3">
              {hourlyData.map((data) => (
                <div key={data.hour} className="flex items-center gap-3">
                  <div className="w-16 text-sm font-medium text-muted-foreground">
                    {data.hour}
                  </div>
                  <div className="flex-1 h-8 bg-muted rounded-lg overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-accent to-orange-500 rounded-lg"
                      style={{ width: `${(data.orders / 18) * 100}%` }}
                    ></div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-foreground">
                      {data.orders}
                    </p>
                    <p className="text-xs text-muted-foreground">${data.revenue}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Summary */}
        <Card className="p-6 card-elegant">
          <h3 className="text-lg font-semibold text-foreground mb-4">
            Daily Summary
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Cash Sales</p>
              <p className="text-2xl font-bold text-foreground">$1,245.00</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">Card Sales</p>
              <p className="text-2xl font-bold text-foreground">$1,205.50</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">Total Tax</p>
              <p className="text-2xl font-bold text-foreground">$196.40</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">Discounts</p>
              <p className="text-2xl font-bold text-foreground">$45.00</p>
            </div>
          </div>
        </Card>
      </main>
    </div>
  );
}
