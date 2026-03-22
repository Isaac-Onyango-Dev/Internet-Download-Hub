import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { Download, HardDrive, Settings, Heart } from "lucide-react";

interface LayoutShellProps {
  children: ReactNode;
}

export function LayoutShell({ children }: LayoutShellProps) {
  const [location] = useLocation();
  const [successMsg] = useState<string | null>(null); // Defensive declaration to prevent undefined errors

  const navItems = [
    { href: "/", label: "Downloader", icon: Download },
    { href: "/queue", label: "Queue & History", icon: HardDrive },
    { href: "/settings", label: "Settings", icon: Settings },
    { href: "/support", label: "Support", icon: Heart },
  ];

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground font-sans">
      {/* Sidebar — fixed, never moves */}
      <aside className="w-64 min-w-64 h-screen flex-shrink-0 overflow-hidden sticky top-0 border-r border-border bg-card p-4 flex flex-col gap-8 z-50">
        <div className="flex items-center gap-3 px-2 mt-2">
          <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center text-primary-foreground shadow-sm overflow-hidden">
            <img
              src="./icon.png"
              alt="Internet Download Hub"
              className="w-6 h-6 object-contain"
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
          </div>
          <div>
            <span className="font-bold text-base tracking-tight text-foreground block leading-none">Internet Download Hub</span>
          </div>
        </div>

        <nav className="flex-1 space-y-1 mt-4">
          {navItems.map((item) => {
            const Icon = item.icon;
            // Since we use Tabs in Dashboard.tsx, the location is always "/", 
            // but for UI representation, we will mock the active state logic later 
            // or just rely on the internal Tabs if they handle it.
            // For now, assume this is a pure aesthetic shell or we pass activeTab down.
            // We'll update Dashboard.tsx to sync with the URL Hash for real routing feelings.
            const isActive = location === item.href || (location === "/" && item.href === "/");
            
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-md transition-colors font-medium cursor-pointer",
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <Icon className={cn("w-5 h-5", isActive ? "text-primary" : "")} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Only this scrolls */}
      <main className="flex-1 h-screen overflow-y-auto overflow-x-hidden">
        <div className="w-full h-full p-4 md:p-8 max-w-5xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
