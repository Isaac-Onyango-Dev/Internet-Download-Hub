import { useState } from "react";
import { useDownloads, useCreateDownload } from "@/hooks/use-downloads";
import { DownloadItem } from "@/components/download-item";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link } from "wouter";
import { Download, LayoutDashboard, Plus, Settings2 } from "lucide-react";
import { cn } from "@/lib/utils";

export default function Popup() {
  const [url, setUrl] = useState("");
  const { data: downloads, isLoading } = useDownloads();
  const createMutation = useCreateDownload();

  const handleQuickAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url) return;
    
    // Simulate getting filename
    const filename = url.split('/').pop() || `file-${Date.now()}.dat`;
    
    createMutation.mutate({
      url,
      filename,
      totalBytes: Math.floor(Math.random() * 100000000) + 1000000, // Random size 1-100MB
      mimeType: "application/octet-stream"
    });
    setUrl("");
  };

  const activeDownloads = downloads?.filter(d => d.state === 'downloading' || d.state === 'queued');
  const recentDownloads = downloads?.slice(0, 5); // Show last 5
  
  return (
    <div className="w-full min-h-screen bg-background flex items-center justify-center p-4 font-body">
      {/* 
        This container mimics the extension popup dimensions.
        Chrome popups are usually max 800x600, but often smaller (~400x600).
      */}
      <div className="w-[380px] h-[600px] bg-background border-2 border-border rounded-xl shadow-2xl overflow-hidden flex flex-col relative">
        
        {/* Header */}
        <div className="p-4 bg-primary text-primary-foreground flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <div className="bg-white/20 p-1.5 rounded-lg">
              <Download className="w-5 h-5" />
            </div>
            <h1 className="font-display font-bold text-lg">TurboDL</h1>
          </div>
          <Link href="/dashboard" className="p-2 hover:bg-white/10 rounded-full transition-colors" title="Open Dashboard">
            <LayoutDashboard className="w-5 h-5" />
          </Link>
        </div>

        {/* Quick Add */}
        <div className="p-4 border-b border-border bg-muted/30">
          <form onSubmit={handleQuickAdd} className="flex gap-2">
            <Input 
              placeholder="Paste URL..." 
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="h-9 bg-background text-sm"
            />
            <Button size="sm" type="submit" disabled={!url || createMutation.isPending}>
              <Plus className="w-4 h-4" />
            </Button>
          </form>
        </div>

        {/* Lists */}
        <div className="flex-1 overflow-y-auto popup-scrollbar p-3 space-y-4">
          
          {/* Active Section */}
          {activeDownloads && activeDownloads.length > 0 && (
            <div className="space-y-2">
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">Active</h2>
              <div className="space-y-2">
                {activeDownloads.map(d => (
                  <DownloadItem key={d.id} download={d} compact />
                ))}
              </div>
            </div>
          )}

          {/* Recent Section */}
          <div className="space-y-2">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">Recent History</h2>
            {isLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map(i => <div key={i} className="h-14 bg-muted animate-pulse rounded-md" />)}
              </div>
            ) : (
              <div className="space-y-2">
                {recentDownloads?.map(d => (
                  <DownloadItem key={d.id} download={d} compact />
                ))}
              </div>
            )}
            
            {(!downloads || downloads.length === 0) && (
              <div className="text-center py-8 text-muted-foreground text-sm">
                No downloads yet
              </div>
            )}
          </div>
        </div>

        {/* Footer Stats */}
        <div className="p-3 bg-muted/50 border-t border-border flex justify-between items-center text-xs text-muted-foreground">
          <span>{activeDownloads?.length || 0} active</span>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span>Connected</span>
          </div>
        </div>
      </div>
    </div>
  );
}
