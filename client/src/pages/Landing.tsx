import { Link } from "wouter";
import { ArrowRight, Download, Zap, Shield, Globe, Play, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export default function Landing() {
  const [showInstall, setShowInstall] = useState(false);

  return (
    <div className="min-h-screen bg-background font-body selection:bg-primary/20">
      {/* Navigation */}
      <nav className="fixed w-full z-50 top-0 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center">
              <Download className="w-5 h-5" />
            </div>
            <span className="font-display font-bold text-xl">TurboDL</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors">
              Dashboard Demo
            </Link>
            <Link href="/popup" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors">
              Popup Demo
            </Link>
            <Button size="sm" onClick={() => setShowInstall(true)}>
              Download Now
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-16 md:pt-48 md:pb-32 px-4 relative overflow-hidden">
        {/* Background Gradients */}
        <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 -z-10" />
        <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-accent/5 rounded-full blur-3xl translate-y-1/4 -translate-x-1/4 -z-10" />

        <div className="max-w-7xl mx-auto text-center space-y-8">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium animate-in fade-in slide-in-from-bottom-4 duration-700">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
            </span>
            v2.0 Now Available
          </div>

          <h1 className="text-5xl md:text-7xl font-display font-bold tracking-tight text-foreground max-w-4xl mx-auto animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-150">
            Download files up to <span className="text-gradient">500% faster</span> directly in your browser.
          </h1>

          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-300">
            The lightweight, privacy-focused download manager that replaces IDM. 
            Multi-threaded technology, fully integrated, absolutely free.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4 animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-500">
            <Button size="lg" className="h-14 px-8 rounded-full text-base shadow-xl shadow-primary/20 hover:shadow-2xl hover:shadow-primary/30 transition-all hover:-translate-y-0.5" onClick={() => setShowInstall(true)}>
              Add to Chrome — It's Free
              <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
            <Button size="lg" variant="outline" className="h-14 px-8 rounded-full text-base border-2" asChild>
              <Link href="/dashboard">View Live Demo</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-24 bg-muted/30 border-t border-border/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-3 gap-8">
            <FeatureCard 
              icon={Zap}
              title="Multi-threaded Speed"
              description="Splits files into multiple segments to download simultaneously, maximizing your bandwidth usage."
            />
            <FeatureCard 
              icon={Shield}
              title="Privacy First"
              description="No tracking, no ads, no account required. Your download history stays local on your device."
            />
            <FeatureCard 
              icon={Globe}
              title="Universal Support"
              description="Works on all major sites including YouTube, Vimeo, and supports all file types automatically."
            />
          </div>
        </div>
      </section>

      {/* Install Dialog */}
      <Dialog open={showInstall} onOpenChange={setShowInstall}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-2xl font-display">Install TurboDL</DialogTitle>
          </DialogHeader>
          <div className="space-y-6 py-4">
            <div className="p-4 bg-muted rounded-lg border border-border text-sm text-muted-foreground">
              Since this is a demo, we simulate the installation process. In a real scenario, this would link to the Chrome Web Store.
            </div>
            <ol className="space-y-4">
              <li className="flex gap-4">
                <span className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-bold shrink-0 text-sm">1</span>
                <div>
                  <p className="font-medium text-foreground">Download Source</p>
                  <p className="text-sm text-muted-foreground">Get the extension package.</p>
                </div>
              </li>
              <li className="flex gap-4">
                <span className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-bold shrink-0 text-sm">2</span>
                <div>
                  <p className="font-medium text-foreground">Open Extensions</p>
                  <p className="text-sm text-muted-foreground">Go to chrome://extensions in your browser.</p>
                </div>
              </li>
              <li className="flex gap-4">
                <span className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-bold shrink-0 text-sm">3</span>
                <div>
                  <p className="font-medium text-foreground">Load Unpacked</p>
                  <p className="text-sm text-muted-foreground">Enable Developer Mode and select the folder.</p>
                </div>
              </li>
            </ol>
            <Button className="w-full" onClick={() => setShowInstall(false)}>
              Got it, thanks!
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FeatureCard({ icon: Icon, title, description }: { icon: any, title: string, description: string }) {
  return (
    <div className="p-8 rounded-2xl bg-background border border-border hover:border-primary/50 hover:shadow-lg transition-all duration-300 group">
      <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
        <Icon className="w-6 h-6" />
      </div>
      <h3 className="text-xl font-bold font-display mb-3 text-foreground">{title}</h3>
      <p className="text-muted-foreground leading-relaxed">{description}</p>
    </div>
  );
}
