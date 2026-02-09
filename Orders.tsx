import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import { ArrowLeft, Plus } from "lucide-react";
import posLayout from "./pos-layout.json";

export default function Orders() {
  useAuth();
  const [location, setLocation] = useLocation();
  const modeFromPath = location.split("/")[2];
  const modeFromQuery =
    typeof window === "undefined"
      ? null
      : new URLSearchParams(window.location.search).get("mode");
  const supportedModes = new Set(["active", "completed", "history"]);
  const modeCandidate = modeFromQuery || modeFromPath || "active";
  const mode = supportedModes.has(modeCandidate) ? modeCandidate : "active";
  const { orderItems, summary, keypad, quickActions, categoryTabs, menuButtons, tenderButtons } =
    posLayout;

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <header className="sticky top-0 z-50 bg-white border-b border-slate-200">
        <div className="mx-auto max-w-[1400px] px-6 py-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setLocation("/")}
              className="h-11 w-11 rounded-md border border-slate-300 bg-white shadow-sm flex items-center justify-center hover:bg-slate-100"
              aria-label="Back to dashboard"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                Chicken POS
              </p>
              <h1 className="text-2xl font-bold">Order Entry</h1>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-md bg-emerald-100 px-3 py-2 text-sm font-semibold text-emerald-800">
              {mode.toUpperCase()} MODE
            </span>
            <button className="h-11 rounded-md bg-emerald-600 px-5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700">
              Open Drawer
            </button>
            <button className="h-11 rounded-md bg-slate-900 px-5 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 flex items-center gap-2">
              <Plus className="w-4 h-4" />
              New Ticket
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1400px] px-6 py-6">
        <div className="grid gap-6 xl:grid-cols-[280px_1fr_360px]">
          <section className="space-y-6">
            <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="text-sm font-semibold text-slate-500 uppercase mb-3">
                Quick Keys
              </h2>
              <div className="grid grid-cols-3 gap-2">
                {quickActions.map((action) => (
                  <button
                    key={action.label}
                    className={`aspect-square rounded-md border border-slate-200 text-sm font-semibold shadow-sm ${action.color}`}
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="text-sm font-semibold text-slate-500 uppercase mb-3">
                Keypad
              </h2>
              <div className="grid grid-cols-3 gap-2">
                {keypad.map((key) => (
                  <button
                    key={key.label}
                    className={`aspect-square rounded-md border border-slate-200 text-lg font-bold shadow-sm ${key.color}`}
                  >
                    {key.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="text-sm font-semibold text-slate-500 uppercase mb-3">
                Totals
              </h2>
              <div className="space-y-2 text-sm">
                {summary.map((line) => (
                  <div key={line.label} className="flex items-center justify-between">
                    <span className="text-slate-500">{line.label}</span>
                    <span className={`font-semibold ${line.emphasis ? "text-emerald-600" : ""}`}>
                      {line.value}
                    </span>
                  </div>
                ))}
              </div>
              <button className="mt-4 w-full rounded-md bg-emerald-600 py-3 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700">
                Pay Now
              </button>
            </div>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-4 py-3 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">Ticket 1084</h2>
                <p className="text-sm text-slate-500">Dine In • Table 4</p>
              </div>
              <span className="rounded-md bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
                Open
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold">Item</th>
                    <th className="px-4 py-3 text-center font-semibold">Qty</th>
                    <th className="px-4 py-3 text-right font-semibold">Price</th>
                  </tr>
                </thead>
                <tbody>
                  {orderItems.map((item) => (
                    <tr key={item.name} className="border-t border-slate-100">
                      <td className="px-4 py-3">
                        <p className="font-semibold">{item.name}</p>
                        <p className="text-xs text-slate-500">{item.modifier}</p>
                      </td>
                      <td className="px-4 py-3 text-center font-semibold">{item.quantity}</td>
                      <td className="px-4 py-3 text-right font-semibold">{item.price}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="border-t border-slate-200 p-4 grid grid-cols-3 gap-2">
              {["Discount", "Void Item", "Send to Kitchen"].map((action) => (
                <button
                  key={action}
                  className="h-12 rounded-md border border-slate-200 bg-white text-sm font-semibold shadow-sm hover:bg-slate-100"
                >
                  {action}
                </button>
              ))}
            </div>
          </section>

          <section className="space-y-6">
            <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="text-sm font-semibold text-slate-500 uppercase mb-3">
                Categories
              </h2>
              <div className="grid grid-cols-2 gap-2">
                {categoryTabs.map((tab) => (
                  <button
                    key={tab.label}
                    className={`h-14 rounded-md border border-slate-200 text-sm font-semibold shadow-sm ${tab.color}`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="text-sm font-semibold text-slate-500 uppercase mb-3">
                Menu Grid
              </h2>
              <div className="grid grid-cols-3 gap-2">
                {menuButtons.map((button) => (
                  <button
                    key={button.label}
                    className={`aspect-square rounded-md border border-slate-200 text-sm font-semibold shadow-sm ${button.color}`}
                  >
                    {button.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="text-sm font-semibold text-slate-500 uppercase mb-3">
                Tender
              </h2>
              <div className="grid grid-cols-3 gap-2">
                {tenderButtons.map((button) => (
                  <button
                    key={button.label}
                    className={`h-12 rounded-md border border-slate-200 text-sm font-semibold shadow-sm ${button.color}`}
                  >
                    {button.label}
                  </button>
                ))}
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
