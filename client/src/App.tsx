import { useEffect, useState } from "react";
import { Switch, Route, Router, Redirect } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ErrorBoundary } from "@/components/error-boundary";
import Dashboard from "@/pages/Dashboard";
import Support from "@/pages/Support";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ExternalLink, Loader2 } from "lucide-react";

const EULA_URL =
  "https://github.com/Isaac-Onyango-Dev/Internet-Download-Hub/blob/main/EULA.txt";

function NavigationRouter() {
  const [location] = useHashLocation();
  

  return (
    <Router hook={useHashLocation}>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/queue" component={Dashboard} />
        <Route path="/settings" component={Dashboard} />
        <Route path="/support" component={Support} />
        <Route>
          {() => {
             return <Redirect to="/" />;
          }}
        </Route>
      </Switch>
    </Router>
  );
}

function App() {
  const [eulaGate, setEulaGate] = useState<"loading" | "show" | "done">("loading");
  const [eulaChecked, setEulaChecked] = useState(false);
  const [eulaSaving, setEulaSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!window.electronAPI?.getSettings) {
        if (!cancelled) setEulaGate("done");
        return;
      }
      try {
        const s = await window.electronAPI.getSettings();
        const ok =
          Number((s as { eula_age_acknowledged?: number }).eula_age_acknowledged) === 1;
        if (!cancelled) setEulaGate(ok ? "done" : "show");
      } catch {
        if (!cancelled) setEulaGate("done");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleEulaContinue = async () => {
    if (!window.electronAPI?.saveSettings || !eulaChecked) return;
    setEulaSaving(true);
    try {
      await window.electronAPI.saveSettings({ eulaAgeAcknowledged: 1 });
      setEulaGate("done");
    } finally {
      setEulaSaving(false);
    }
  };

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Dialog open={eulaGate === "show"} onOpenChange={() => {}}>
            <DialogContent
              className="[&>button]:hidden sm:max-w-md"
              onPointerDownOutside={(e) => e.preventDefault()}
              onEscapeKeyDown={(e) => e.preventDefault()}
              onInteractOutside={(e) => e.preventDefault()}
            >
              <DialogHeader>
                <DialogTitle>Before you continue</DialogTitle>
                <DialogDescription className="text-left space-y-3 pt-1">
                  <span className="block">
                    This app is for adults only. By continuing you confirm you meet the minimum age in
                    your region and accept the End User License Agreement.
                  </span>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 text-primary underline-offset-4 hover:underline text-sm font-medium"
                    onClick={() => window.electronAPI?.openExternal(EULA_URL)}
                  >
                    Read the EULA
                    <ExternalLink className="h-3.5 w-3.5" />
                  </button>
                </DialogDescription>
              </DialogHeader>
              <div className="flex items-start space-x-3 py-2">
                <Checkbox
                  id="eula-ack"
                  checked={eulaChecked}
                  onCheckedChange={(v) => setEulaChecked(v === true)}
                />
                <Label htmlFor="eula-ack" className="text-sm font-normal leading-snug cursor-pointer">
                  I am of legal age where I live and I agree to the EULA.
                </Label>
              </div>
              <DialogFooter>
                <Button onClick={handleEulaContinue} disabled={!eulaChecked || eulaSaving}>
                  {eulaSaving ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving…
                    </>
                  ) : (
                    "Continue"
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          {eulaGate !== "loading" && <NavigationRouter />}
          {eulaGate === "loading" && (
            <div className="min-h-[40vh] flex items-center justify-center text-muted-foreground text-sm">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          )}
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
