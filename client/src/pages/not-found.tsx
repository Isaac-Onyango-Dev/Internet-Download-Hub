import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle, Home, ArrowLeft } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background p-6 animate-in fade-in duration-300">
      <Card className="w-full max-w-md mx-4 border-border/50">
        <CardContent className="pt-8 pb-6">
          <div className="flex flex-col items-center text-center">
            <div className="p-4 rounded-full bg-destructive/10 mb-6">
              <AlertCircle className="h-12 w-12 text-destructive" />
            </div>
            
            <div className="mb-2">
              <span className="text-6xl font-bold text-muted-foreground/30">404</span>
            </div>
            
            <h1 className="text-2xl font-bold text-foreground mb-2">Page Not Found</h1>
            
            <p className="text-muted-foreground text-sm leading-relaxed mb-8 max-w-xs">
              This page doesn&apos;t exist. Please return to the main app or check your URL.
            </p>

            <div className="flex gap-3 w-full">
              <Button
                onClick={() => window.history.back()}
                variant="outline"
                className="flex-1 gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                Go Back
              </Button>
              <Button
                onClick={() => (window.location.href = '/')}
                className="flex-1 gap-2"
              >
                <Home className="w-4 h-4" />
                Return to App
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
