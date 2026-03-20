import { LayoutShell } from "@/components/layout-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Heart, LifeBuoy, Mail, MessageSquare } from "lucide-react";

export default function Support() {
  return (
    <LayoutShell>
      <div className="space-y-8 animate-in fade-in duration-300">
        <div className="mb-8">
          <h2 className="text-3xl font-bold tracking-tight mb-2 flex items-center gap-3">
            <Heart className="text-primary w-8 h-8" /> 
            Support
          </h2>
          <p className="text-muted-foreground text-base">
            Need help with your downloads? We're here for you.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="border-border bg-card shadow-sm hover:border-primary/50 transition-colors cursor-pointer">
            <CardContent className="p-6 flex flex-col items-center text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                <LifeBuoy className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xl font-semibold mb-1">Help Center</h3>
                <p className="text-sm text-muted-foreground">
                  Browse our knowledge base and FAQs to find quick answers to common questions.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border bg-card shadow-sm hover:border-primary/50 transition-colors cursor-pointer">
            <CardContent className="p-6 flex flex-col items-center text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                <MessageSquare className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xl font-semibold mb-1">Community Forum</h3>
                <p className="text-sm text-muted-foreground">
                  Join the discussion, share tips, and connect with other users in our community.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border bg-card shadow-sm md:col-span-2 hover:border-primary/50 transition-colors cursor-pointer">
            <CardContent className="p-6 flex flex-col md:flex-row items-center gap-6">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
                <Mail className="w-6 h-6" />
              </div>
              <div className="flex-1 text-center md:text-left">
                <h3 className="text-xl font-semibold mb-1">Contact Us Directly</h3>
                <p className="text-sm text-muted-foreground">
                  Still can't find what you're looking for? Reach out to our support team directly. We typically respond within 24 hours.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </LayoutShell>
  );
}
