import { useAuth } from "../_core/hooks/useAuth";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { useLocation } from "wouter";
import { ArrowLeft, Plus, Search, Phone, Star } from "lucide-react";
import { useState } from "react";

export default function Customers() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [searchTerm, setSearchTerm] = useState("");

  const customers = [
    {
      id: 1,
      name: "John Doe",
      phone: "(555) 123-4567",
      visits: 12,
      points: 450,
      totalSpent: "$1,245.50",
      lastVisit: "Today",
    },
    {
      id: 2,
      name: "Jane Smith",
      phone: "(555) 234-5678",
      visits: 8,
      points: 320,
      totalSpent: "$892.00",
      lastVisit: "2 days ago",
    },
    {
      id: 3,
      name: "Mike Johnson",
      phone: "(555) 345-6789",
      visits: 5,
      points: 180,
      totalSpent: "$495.75",
      lastVisit: "1 week ago",
    },
  ];

  const filteredCustomers = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.phone.includes(searchTerm)
  );

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
              <h1 className="text-2xl font-bold text-foreground">Customers</h1>
              <p className="text-sm text-muted-foreground">Manage loyalty and profiles</p>
            </div>
          </div>

          <Button className="btn-touch bg-accent hover:bg-accent/90 text-accent-foreground gap-2">
            <Plus className="w-5 h-5" />
            Add Customer
          </Button>
        </div>
      </header>

      {/* Search */}
      <div className="bg-card border-b border-border sticky top-16 z-40">
        <div className="container mx-auto px-4 py-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by name or phone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 rounded-lg border border-input bg-input text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>
      </div>

      {/* Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="grid gap-4">
          {filteredCustomers.map((customer) => (
            <Card
              key={customer.id}
              className="p-6 card-elegant hover:shadow-lg transition-shadow cursor-pointer"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-foreground mb-2">
                    {customer.name}
                  </h3>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
                    <Phone className="w-4 h-4" />
                    {customer.phone}
                  </div>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Visits</p>
                      <p className="font-semibold text-foreground">{customer.visits}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Total Spent</p>
                      <p className="font-semibold text-foreground">{customer.totalSpent}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Last Visit</p>
                      <p className="font-semibold text-foreground">{customer.lastVisit}</p>
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <div className="flex items-center gap-1 mb-2">
                    <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />
                    <span className="text-2xl font-bold text-foreground">
                      {customer.points}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">Loyalty Points</p>
                </div>
              </div>
            </Card>
          ))}
        </div>

        {filteredCustomers.length === 0 && (
          <div className="text-center py-12">
            <p className="text-lg text-muted-foreground">No customers found</p>
          </div>
        )}
      </main>
    </div>
  );
}
