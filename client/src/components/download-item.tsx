import { Download, UpdateDownloadRequest } from "@shared/schema";
import { formatDistanceToNow } from "date-fns";
import { File, FileAudio, FileVideo, FileArchive, FileImage, FileText, Pause, Play, X, Clock, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { useUpdateDownload, useDeleteDownload } from "@/hooks/use-downloads";

interface DownloadItemProps {
  download: Download;
  compact?: boolean;
}

export function DownloadItem({ download, compact = false }: DownloadItemProps) {
  const updateMutation = useUpdateDownload();
  const deleteMutation = useDeleteDownload();

  const getFileIcon = (mimeType: string | null, filename: string) => {
    if (mimeType?.includes("video") || filename.endsWith(".mp4") || filename.endsWith(".mkv")) return <FileVideo className="w-5 h-5 text-blue-500" />;
    if (mimeType?.includes("audio") || filename.endsWith(".mp3") || filename.endsWith(".wav")) return <FileAudio className="w-5 h-5 text-purple-500" />;
    if (mimeType?.includes("image") || filename.endsWith(".jpg") || filename.endsWith(".png")) return <FileImage className="w-5 h-5 text-green-500" />;
    if (filename.endsWith(".zip") || filename.endsWith(".rar") || filename.endsWith(".exe")) return <FileArchive className="w-5 h-5 text-yellow-500" />;
    if (mimeType?.includes("pdf")) return <FileText className="w-5 h-5 text-red-500" />;
    return <File className="w-5 h-5 text-gray-500" />;
  };

  const getStatusColor = (state: string) => {
    switch(state) {
      case "downloading": return "text-primary";
      case "completed": return "text-green-500";
      case "error": return "text-destructive";
      case "paused": return "text-yellow-500";
      default: return "text-muted-foreground";
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const percent = download.totalBytes > 0 
    ? Math.round((download.receivedBytes || 0) / download.totalBytes * 100) 
    : 0;

  const handlePauseResume = () => {
    const newState = download.state === "downloading" ? "paused" : "downloading";
    updateMutation.mutate({ id: download.id, state: newState });
  };

  const handleDelete = () => {
    deleteMutation.mutate(download.id);
  };

  if (compact) {
    return (
      <div className="bg-card rounded-lg p-3 border border-border shadow-sm hover:shadow-md transition-all group">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-muted rounded-md shrink-0">
            {getFileIcon(download.mimeType, download.filename)}
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-medium truncate" title={download.filename}>
              {download.filename}
            </h4>
            <div className="flex items-center justify-between text-xs text-muted-foreground mt-1">
              <span>{formatBytes(download.receivedBytes || 0)} / {formatBytes(download.totalBytes || 0)}</span>
              <span className={cn("font-medium", getStatusColor(download.state))}>
                {download.state === 'downloading' ? `${percent}%` : download.state}
              </span>
            </div>
            {download.state === 'downloading' && (
              <Progress value={percent} className="h-1 mt-2" />
            )}
          </div>
          <div className="flex flex-col gap-1">
            {(download.state === 'downloading' || download.state === 'paused') && (
              <Button size="icon" variant="ghost" className="h-6 w-6" onClick={handlePauseResume}>
                {download.state === 'downloading' ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
              </Button>
            )}
            <Button size="icon" variant="ghost" className="h-6 w-6 text-muted-foreground hover:text-destructive" onClick={handleDelete}>
              <X className="w-3 h-3" />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Full Dashboard View
  return (
    <div className="bg-card rounded-xl p-4 md:p-6 border border-border/50 shadow-sm hover:shadow-lg transition-all duration-300 group relative overflow-hidden">
      {/* Background Progress Tint */}
      {download.state === 'downloading' && (
        <div 
          className="absolute bottom-0 left-0 h-1 bg-primary/20 transition-all duration-500 ease-out" 
          style={{ width: `${percent}%` }}
        />
      )}

      <div className="flex flex-col md:flex-row md:items-center gap-4">
        {/* Icon */}
        <div className="w-12 h-12 rounded-xl bg-muted/50 flex items-center justify-center shrink-0 border border-border/50">
          {getFileIcon(download.mimeType, download.filename)}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold truncate" title={download.filename}>
              {download.filename}
            </h3>
            <span className={cn(
              "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border",
              download.state === 'completed' ? "bg-green-500/10 text-green-600 border-green-500/20" :
              download.state === 'error' ? "bg-red-500/10 text-red-600 border-red-500/20" :
              "bg-primary/10 text-primary border-primary/20"
            )}>
              {download.state}
            </span>
          </div>
          
          <div className="flex items-center gap-4 text-xs text-muted-foreground font-mono">
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-current opacity-50" />
              {formatBytes(download.totalBytes || 0)}
            </span>
            <span className="flex items-center gap-1.5">
              <Clock className="w-3 h-3" />
              {download.createdAt ? formatDistanceToNow(new Date(download.createdAt), { addSuffix: true }) : 'Just now'}
            </span>
            {download.savePath && (
              <span className="hidden md:inline-flex truncate max-w-[200px] opacity-70">
                {download.savePath}
              </span>
            )}
          </div>
        </div>

        {/* Controls & Progress */}
        <div className="flex items-center gap-4 md:w-1/3">
          <div className="flex-1 space-y-2">
            <div className="flex justify-between text-xs font-medium">
              <span className="text-muted-foreground">Progress</span>
              <span>{percent}%</span>
            </div>
            <div className="relative h-2 w-full bg-muted rounded-full overflow-hidden">
              <div 
                className={cn(
                  "absolute top-0 left-0 h-full rounded-full transition-all duration-500",
                  download.state === 'completed' ? "bg-green-500" :
                  download.state === 'error' ? "bg-destructive" :
                  "bg-primary animate-stripe bg-[length:1rem_1rem] bg-gradient-to-r from-primary via-primary/80 to-primary"
                )}
                style={{ width: `${percent}%` }}
              />
            </div>
          </div>

          <div className="flex items-center gap-1">
            {(download.state === 'downloading' || download.state === 'paused') && (
              <Button
                size="icon"
                variant="outline"
                className="rounded-full w-8 h-8 hover:bg-primary hover:text-primary-foreground hover:border-primary transition-colors"
                onClick={handlePauseResume}
              >
                {download.state === 'downloading' ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              </Button>
            )}
            
            <Button
              size="icon"
              variant="ghost"
              className="rounded-full w-8 h-8 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
              onClick={handleDelete}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
