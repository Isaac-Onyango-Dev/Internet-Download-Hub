import { useState } from "react";
import { LayoutShell } from "@/components/layout-shell";
import { useDownloads, useClearCompletedDownloads } from "@/hooks/use-downloads";
import { useVideoDetect } from "@/hooks/use-video-detect";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Download, Image as ImageIcon, Settings, Loader2, Music, User, Trash2, 
  List, AlertCircle, HardDrive, PlayCircle, FolderOpen, Zap
} from "lucide-react";
import { useDownloadProgress } from "@/hooks/use-ws-progress";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { API_URLS } from "@/lib/api-config";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function Dashboard() {
  const [globalError, setGlobalError] = useState<{message: string} | null>(null);

  return (
    <LayoutShell>
      <div className="space-y-8 animate-in fade-in duration-300">
        
        {globalError && (
          <Alert variant="destructive" className="bg-destructive/10 border-destructive/20 text-destructive">
            <AlertCircle className="h-5 w-5" />
            <AlertTitle className="font-semibold text-lg">Error</AlertTitle>
            <AlertDescription className="text-base mt-2 flex flex-col gap-3">
              <p>{globalError.message}</p>
              <Button variant="outline" size="sm" className="w-fit border-destructive/30 hover:bg-destructive hover:text-white" onClick={() => setGlobalError(null)}>
                Dismiss
              </Button>
            </AlertDescription>
          </Alert>
        )}

        <Tabs defaultValue="downloader" className="w-full">
          <TabsList className="bg-muted p-1 h-12 w-full max-w-lg mb-8 rounded-lg">
            <TabsTrigger value="downloader" className="flex-1 gap-2 text-sm rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <Download className="w-4 h-4" />
              Downloader
            </TabsTrigger>
            <TabsTrigger value="queue" className="flex-1 gap-2 text-sm rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <List className="w-4 h-4" />
              Queue & History
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex-1 gap-2 text-sm rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <Settings className="w-4 h-4" />
              Settings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="downloader" className="focus-visible:outline-none">
            <VideoCapturePanel onScanStart={() => setGlobalError(null)} onError={(err) => setGlobalError(err)} />
          </TabsContent>

          <TabsContent value="queue" className="focus-visible:outline-none">
            <HistoryPanel />
          </TabsContent>

          <TabsContent value="settings" className="focus-visible:outline-none">
            <SettingsPanel />
          </TabsContent>
        </Tabs>
      </div>
    </LayoutShell>
  );
}

function VideoCapturePanel({ onScanStart, onError }: { onScanStart?: () => void, onError: (err: {message: string}) => void }) {
  const [scanUrl, setScanUrl] = useState("");
  const videoDetect = useVideoDetect();

  const handleScan = (e: React.FormEvent) => {
    e.preventDefault();
    if (!scanUrl.trim()) return;
    if (onScanStart) onScanStart();
    videoDetect.reset(); // Instantly clear previous results
    videoDetect.mutate(scanUrl);
  };

  const handleDownload = (video: any, format?: any, audioOnly: boolean = false) => {
    const cleanTitle = video.title ? video.title.replace(/[^a-z0-9]/gi, "_").slice(0, 50) : "video";
    const ext = audioOnly ? "mp3" : (format?.ext || "mp4");
    const filename = `${cleanTitle}.${ext}`;

    const streamUrl = `${API_URLS.streamDownload}?url=${encodeURIComponent(video.url)}`
      + (format?.formatId ? `&formatId=${encodeURIComponent(format.formatId)}` : "")
      + (audioOnly ? `&audioOnly=true` : "")
      + `&filename=${encodeURIComponent(filename)}`;

    fetch(streamUrl, { method: 'HEAD' })
      .then(async (res) => {
        if (!res.ok) {
          const text = await res.text();
          console.error(`[API Error] URL: ${streamUrl} | Status: ${res.status}`);
          console.error(`[API Error] Response: ${text}`);

          let errorMessage = "Server returned an error without a message.";
          try {
            const data = JSON.parse(text);
            if (data.message) errorMessage = data.message;
          } catch (e) {
            errorMessage = text;
          }

          onError({ message: `Download failed: ${errorMessage}` });
          return;
        }
        const a = document.createElement('a');
        a.href = streamUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      })
      .catch(err => {
        console.error(`[API Error] Network failure hitting ${streamUrl}:`, err);
        onError({ message: "Could not reach the server to start the download. Please check your connection." });
      });
  };

  const handleTestConnection = async () => {
    try {
      const res = await fetch(API_URLS.health);
      const text = await res.text();
      console.log(`[API Test] URL: ${API_URLS.health} | Status: ${res.status}`);
      console.log(`[API Test] Response: ${text}`);
      alert(`Server Response:\nStatus: ${res.status}\nBody: ${text}`);
    } catch (err: any) {
      console.error(`[API Test Error]`, err);
      alert(`Connection failed: ${err.message}`);
    }
  };

  return (
    <div className="space-y-8">
      <Card className="border-border bg-card shadow-sm">
        <CardContent className="p-6 md:p-8">
          <div className="mb-6 flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
            <div>
              <h2 className="text-3xl font-bold tracking-tight mb-2">Download a Video</h2>
              <p className="text-muted-foreground text-base">Paste a video link from YouTube, Twitter, Vimeo, or others to get started.</p>
            </div>
            <Button variant="outline" size="sm" onClick={handleTestConnection} className="shrink-0 text-xs">
              <AlertCircle className="w-3 h-3 mr-2" />
              Test Server Connection
            </Button>
          </div>

          <form onSubmit={handleScan} className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Input
                placeholder="Paste your video link here..."
                value={scanUrl}
                onChange={(e) => setScanUrl(e.target.value)}
                className="h-14 md:text-lg bg-input border-border focus-visible:ring-primary focus-visible:border-primary shadow-sm rounded-lg"
              />
            </div>
            <Button 
              type="submit" 
              size="lg" 
              disabled={!scanUrl || videoDetect.isPending} 
              className="h-14 px-8 text-base btn-primary rounded-lg shrink-0"
            >
              {videoDetect.isPending ? (
                <><Loader2 className="w-5 h-5 mr-3 animate-spin" /> Getting Info...</>
              ) : (
                <><Download className="w-5 h-5 mr-3" /> Get Video Info</>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {videoDetect.data && (
        <div className="space-y-6">
          {videoDetect.data.map((video, idx) => (
            <Card key={idx} className="overflow-hidden border-border bg-card shadow-md">
              <div className="flex flex-col md:flex-row">
                {/* Video Thumbnail Section */}
                <div className="md:w-72 bg-muted relative shrink-0">
                  <div className="aspect-video w-full h-full relative group">
                    {video.thumbnail ? (
                      <img src={video.thumbnail} className="w-full h-full object-cover" alt="Video thumbnail" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ImageIcon className="w-12 h-12 text-muted-foreground/30" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/20" />
                    <div className="absolute bottom-2 right-2 px-2 py-1 bg-black/80 rounded text-xs font-medium text-white flex items-center gap-1">
                      <PlayCircle className="w-3 h-3" />
                      {video.duration ? `${Math.floor(video.duration / 60)}:${(video.duration % 60).toString().padStart(2, '0')}` : "LIVE"}
                    </div>
                  </div>
                </div>

                {/* Video Details & Actions */}
                <div className="flex-1 p-6 flex flex-col">
                  <div className="mb-6 border-b border-border/50 pb-6">
                    <h3 className="text-xl md:text-2xl font-bold leading-snug mb-2 pr-4">{video.title || "Unknown Video"}</h3>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1.5 bg-muted px-2 py-1 rounded-md text-foreground">
                        <User className="w-4 h-4" /> {video.uploader || "Anonymous"}
                      </span>
                      <span className="capitalize">{video.sourceType || "Web"}</span>
                    </div>
                  </div>

                  <div className="mt-auto space-y-4">
                    <div className="flex flex-col sm:flex-row gap-3">
                      <Button 
                        size="lg"
                        className="btn-primary flex-1 sm:flex-none text-base h-14"
                        onClick={() => handleDownload(video)}
                      >
                        <Download className="w-5 h-5 mr-2" /> Download Best Quality
                      </Button>
                      <Button 
                        variant="outline" 
                        size="lg"
                        className="flex-1 sm:flex-none h-14 text-base border-border hover:bg-muted"
                        onClick={() => handleDownload(video, null, true)} 
                      >
                        <Music className="w-5 h-5 mr-2" /> Download Audio Only
                      </Button>
                    </div>

                    {/* Simple options for advanced users */}
                    <div className="pt-4 mt-4 border-t border-border flex flex-col sm:flex-row items-start sm:items-center gap-4">
                      <span className="text-sm font-medium text-muted-foreground whitespace-nowrap">Specific Quality:</span>
                      <div className="flex flex-wrap gap-2">
                        {video.formats
                          .filter((f: any) => f.vcodec !== 'none' && f.resolution)
                          .slice(0, 3) // Only show the top 3 best formats to avoid clutter
                          .map((f: any) => {
                            // Translate resolution to plain english
                            let qualityLabel = f.resolution;
                            if (f.resolution?.includes("1080")) qualityLabel = "High Quality (1080p)";
                            else if (f.resolution?.includes("720")) qualityLabel = "Standard (720p)";
                            else if (f.resolution?.includes("480") || f.resolution?.includes("360")) qualityLabel = "Small File";

                            // Convert raw bytes to MB
                            const sizeMB = Math.round(f.filesize / (1024 * 1024));
                            const sizeLabel = sizeMB > 0 ? `${sizeMB} MB` : 'Unknown size';

                            return (
                              <Button 
                                key={f.formatId} 
                                variant="secondary" 
                                size="sm" 
                                onClick={() => handleDownload(video, f)}
                                className="bg-muted hover:bg-muted/80 text-foreground"
                              >
                                {qualityLabel} • {sizeLabel}
                              </Button>
                            );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function HistoryPanel() {
  const { data: downloads, isLoading } = useDownloads();
  const clearMutation = useClearCompletedDownloads();
  const progressMap = useDownloadProgress();

  if (isLoading) return (
    <div className="space-y-4">
      {[1, 2, 3].map(i => (
        <div key={i} className="h-24 bg-card border border-border animate-pulse rounded-lg" />
      ))}
    </div>
  );

  return (
    <Card className="border-border shadow-sm">
      <div className="p-6 border-b border-border flex flex-col sm:flex-row gap-4 sm:items-center justify-between">
        <div>
          <h3 className="text-2xl font-bold">Download Queue</h3>
          <p className="text-muted-foreground mt-1">Videos you are downloading or have saved recently.</p>
        </div>
        <Button 
          variant="outline" 
          className="border-border text-muted-foreground hover:bg-destructive/10 hover:text-destructive shrink-0" 
          onClick={() => clearMutation.mutate()}
        >
          <Trash2 className="w-4 h-4 mr-2" /> Clear Finished Items
        </Button>
      </div>

      <ScrollArea className="h-[600px]">
        <div className="p-6 space-y-3">
          {downloads?.map((dl) => {
            const live = progressMap[dl.id];
            const currentPercent = live ? live.percent : (dl.state === 'completed' ? 100 : 0);
            
            // Map technical states to plain english
            const statusLabel = 
              live ? "Downloading..." :
              dl.state === 'completed' ? "Saved!" :
              dl.state === 'error' ? "Failed" : 
              "Waiting";

            return (
              <div key={dl.id} className="p-4 rounded-lg border border-border bg-muted/30">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded bg-background flex items-center justify-center shrink-0 border border-border shadow-sm">
                    {live ? <Loader2 className="w-5 h-5 text-primary animate-spin" /> : <PlayCircle className="w-6 h-6 text-muted-foreground" />}
                  </div>
                  
                  <div className="flex-1 min-w-0 flex flex-col gap-2">
                    <div className="flex items-start justify-between gap-4">
                      <p className="font-semibold truncate text-base text-foreground" title={dl.filename}>{dl.filename}</p>
                      <span className={`text-sm font-medium shrink-0 px-2 py-0.5 rounded ${
                        dl.state === 'completed' ? 'text-green-500 bg-green-500/10' : 
                        dl.state === 'error' ? 'text-destructive bg-destructive/10' : 
                        'text-primary bg-primary/10'
                      }`}>
                        {statusLabel}
                      </span>
                    </div>
                    
                    <div className="space-y-1">
                      <Progress value={currentPercent} className="h-2 w-full bg-border" />
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>{currentPercent}% complete</span>
                        {live && <span>Time remaining: {live.eta}</span>}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
          
          {downloads?.length === 0 && (
            <div className="text-center py-20 flex flex-col items-center">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <List className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-bold">Your queue is empty</h3>
              <p className="text-muted-foreground mt-1">Go to the Downloader tab to add a video.</p>
            </div>
          )}
        </div>
      </ScrollArea>
    </Card>
  );
}

function SettingsPanel() {
  return (
    <div className="max-w-3xl space-y-6">
      <Card className="border-border shadow-sm">
        <div className="p-6 border-b border-border">
          <h2 className="text-2xl font-bold">Settings</h2>
          <p className="text-muted-foreground mt-1">Manage exactly how your app downloads video files.</p>
        </div>
        <CardContent className="p-6 md:p-8 space-y-8">
          
          <div className="space-y-3">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <FolderOpen className="w-5 h-5 text-primary" /> Where to save downloads
            </h3>
            <p className="text-sm text-muted-foreground">Choose the folder on your computer where video files should be kept.</p>
            <Input defaultValue="Downloads/" className="max-w-md bg-input border-border" />
          </div>

          <div className="space-y-3">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Zap className="w-5 h-5 text-primary" /> Download speed (Concurrent jobs)
            </h3>
            <p className="text-sm text-muted-foreground">How many videos should download at the exact same time. Pick a lower number if your internet feels slow.</p>
             <Select defaultValue="3">
              <SelectTrigger className="w-full max-w-sm bg-input border-border h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1 at a time (Slowest)</SelectItem>
                <SelectItem value="2">2 at a time</SelectItem>
                <SelectItem value="3">3 at a time (Recommended)</SelectItem>
                <SelectItem value="5">5 at a time (Fastest)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-3">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Image className="w-5 h-5 text-primary" /> Default video quality
            </h3>
            <p className="text-sm text-muted-foreground">If you press the main Download button, this is the quality the app will pick automatically.</p>
            <Select defaultValue="best">
              <SelectTrigger className="w-full max-w-sm bg-input border-border h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="best">Highest Quality Available</SelectItem>
                <SelectItem value="1080p">High (1080p)</SelectItem>
                <SelectItem value="720p">Standard (720p)</SelectItem>
                <SelectItem value="480p">Small File (480p)</SelectItem>
              </SelectContent>
            </Select>
          </div>

        </CardContent>
      </Card>
    </div>
  );
}

// Fixed missing icon import for Image above
import { Image } from "lucide-react";
