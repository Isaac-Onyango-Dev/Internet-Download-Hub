import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { LayoutDashboard, Download, Settings, MonitorPlay } from "lucide-react";

interface LayoutShellProps {
  children: ReactNode;
}

export function LayoutShell({ children }: LayoutShellProps) {
  const [location] = useLocation();

  const navItems = [
    { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
    { href: "/popup", label: "Popup View", icon: MonitorPlay },
    { href: "/", label: "Landing Page", icon: Download },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col md:flex-row font-body">
      {/* Sidebar for Desktop */}
      <aside className="w-full md:w-64 border-b md:border-r border-border bg-card/30 backdrop-blur-sm p-4 flex flex-col gap-6 sticky top-0 z-50">
        <div className="flex items-center gap-3 px-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white shadow-lg shadow-primary/20">
            <Download className="w-6 h-6" />
          </div>
          <span className="font-display font-bold text-xl tracking-tight">TurboDL</span>
        </div>

        <nav className="flex-1 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-md shadow-primary/25 font-medium"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <Icon className={cn("w-5 h-5", isActive ? "text-primary-foreground" : "text-muted-foreground group-hover:text-foreground")} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 bg-muted/50 rounded-xl border border-border/50 text-sm">
          <p className="font-semibold text-foreground mb-1">Simulator Mode</p>
          <p className="text-muted-foreground text-xs leading-relaxed">
            This dashboard simulates the extension's internal state. Changes here reflect in the Popup UI.
          </p>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 bg-background/50 relative overflow-hidden">
        {/* Background ambient blobs */}
        <div className="absolute top-0 left-0 w-full h-96 bg-gradient-to-b from-primary/5 to-transparent -z-10 pointer-events-none" />
        
        <div className="max-w-7xl mx-auto p-4 md:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
