import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getLoginUrl } from "@/const";
import { ShoppingCart, Users, BarChart3, Settings, LogOut, Clock } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";

export default function Home() {
  const { user, loading, isAuthenticated, logout } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-background to-muted px-4">
        <div className="max-w-md w-full text-center">
          <div className="mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-accent/10 mb-4">
              <ShoppingCart className="w-8 h-8 text-accent" />
            </div>
            <h1 className="text-4xl font-bold text-foreground mb-2">Chicken POS</h1>
            <p className="text-lg text-muted-foreground">
              Modern Point of Sale System for Your Restaurant
            </p>
          </div>

          <div className="space-y-4 mb-8">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-accent/20 flex items-center justify-center mt-0.5">
                <span className="text-sm font-semibold text-accent">✓</span>
              </div>
              <div className="text-left">
                <p className="font-semibold text-foreground">Touch-Optimized Interface</p>
                <p className="text-sm text-muted-foreground">Designed for restaurant environments</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-accent/20 flex items-center justify-center mt-0.5">
                <span className="text-sm font-semibold text-accent">✓</span>
              </div>
              <div className="text-left">
                <p className="font-semibold text-foreground">Real-Time Inventory</p>
                <p className="text-sm text-muted-foreground">Track stock and get low-stock alerts</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-accent/20 flex items-center justify-center mt-0.5">
                <span className="text-sm font-semibold text-accent">✓</span>
              </div>
              <div className="text-left">
                <p className="font-semibold text-foreground">Secure Payments</p>
                <p className="text-sm text-muted-foreground">Stripe integration with multiple methods</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-accent/20 flex items-center justify-center mt-0.5">
                <span className="text-sm font-semibold text-accent">✓</span>
              </div>
              <div className="text-left">
                <p className="font-semibold text-foreground">Analytics Dashboard</p>
                <p className="text-sm text-muted-foreground">Sales reports and performance metrics</p>
              </div>
            </div>
          </div>

          <a href={getLoginUrl()}>
            <Button className="w-full btn-touch bg-accent hover:bg-accent/90 text-accent-foreground">
              Sign In to Continue
            </Button>
          </a>
        </div>
      </div>
    );
  }

  return <Dashboard user={user} logout={logout} />;
}

function MenuGrid({ menuItems }: any) {
  const [, setLocation] = useLocation();

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {menuItems.map((item: any) => {
        const Icon = item.icon;
        return (
          <button
            key={item.label}
            onClick={() => setLocation(item.href)}
            className="text-left"
          >
            <Card className="p-6 card-elegant hover:shadow-lg cursor-pointer h-full transition-all">
              <div className={`w-12 h-12 rounded-lg ${item.bgColor} flex items-center justify-center mb-4`}>
                <Icon className={`w-6 h-6 ${item.color}`} />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-1">
                {item.label}
              </h3>
              <p className="text-sm text-muted-foreground">{item.description}</p>
            </Card>
          </button>
        );
      })}
    </div>
  );
}

function Dashboard({ user, logout }: any) {
  const { data: employee } = trpc.employee.getByUserId.useQuery({ userId: user?.id || 0 });
  const { data: openDrawer } = trpc.cashDrawer.getOpen.useQuery();

  const menuItems = [
    {
      icon: ShoppingCart,
      label: "New Order",
      description: "Create a new customer order",
      href: "/orders/new",
      color: "text-blue-600",
      bgColor: "bg-blue-50 dark:bg-blue-900/20",
    },
    {
      icon: Clock,
      label: "Active Orders",
      description: "View and manage active orders",
      href: "/orders/active",
      color: "text-orange-600",
      bgColor: "bg-orange-50 dark:bg-orange-900/20",
    },
    {
      icon: Users,
      label: "Customers",
      description: "Manage customer profiles",
      href: "/customers",
      color: "text-green-600",
      bgColor: "bg-green-50 dark:bg-green-900/20",
    },
    {
      icon: BarChart3,
      label: "Analytics",
      description: "View sales reports and insights",
      href: "/analytics",
      color: "text-purple-600",
      bgColor: "bg-purple-50 dark:bg-purple-900/20",
    },
    {
      icon: Settings,
      label: "Settings",
      description: "Configure menu and inventory",
      href: "/settings",
      color: "text-slate-600",
      bgColor: "bg-slate-50 dark:bg-slate-900/20",
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted">
      {/* Header */}
      <header className="bg-card border-b border-border sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
              <ShoppingCart className="w-6 h-6 text-accent" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">Chicken POS</h1>
          </div>

          <div className="flex items-center gap-4">
            {openDrawer && (
              <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 text-sm font-medium">
                <div className="w-2 h-2 rounded-full bg-green-600 dark:bg-green-400 animate-pulse"></div>
                Drawer Open
              </div>
            )}

            <div className="text-right">
              <p className="text-sm font-medium text-foreground">{user?.name}</p>
              <p className="text-xs text-muted-foreground">{user?.email}</p>
            </div>

            <Button
              variant="ghost"
              size="icon"
              onClick={logout}
              className="text-muted-foreground hover:text-foreground"
            >
              <LogOut className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {/* Welcome Section */}
        <div className="mb-12">
          <h2 className="text-3xl font-bold text-foreground mb-2">
            Welcome back, {user?.name?.split(" ")[0]}!
          </h2>
          <p className="text-lg text-muted-foreground">
            {new Date().toLocaleDateString("en-US", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-12">
          <Card className="p-6 card-elegant">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Today's Orders</p>
                <p className="text-3xl font-bold text-foreground">0</p>
              </div>
              <div className="w-12 h-12 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center">
                <ShoppingCart className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </Card>

          <Card className="p-6 card-elegant">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Today's Revenue</p>
                <p className="text-3xl font-bold text-foreground">$0.00</p>
              </div>
              <div className="w-12 h-12 rounded-lg bg-green-50 dark:bg-green-900/20 flex items-center justify-center">
                <BarChart3 className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </Card>

          <Card className="p-6 card-elegant">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Active Orders</p>
                <p className="text-3xl font-bold text-foreground">0</p>
              </div>
              <div className="w-12 h-12 rounded-lg bg-orange-50 dark:bg-orange-900/20 flex items-center justify-center">
                <Clock className="w-6 h-6 text-orange-600" />
              </div>
            </div>
          </Card>
        </div>

        {/* Menu Grid */}
        <MenuGrid menuItems={menuItems} />
      </main>
    </div>
  );
}
