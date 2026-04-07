import { useState, useCallback } from 'react';
import { LayoutShell } from '@/components/layout-shell';
import { webAPI } from '@/lib/web-api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
    Download,
    AlertCircle,
    ExternalLink,
    Trash2,
    Download as DownloadIcon,
    Clock,
    Loader2,
} from 'lucide-react';

interface VideoInfo {
    url: string;
    title: string;
    thumbnail?: string;
    formats: Array<{
        formatId: string;
        label: string;
        quality: string;
        ext: string;
    }>;
}

interface DownloadRecord {
    id: string;
    title: string;
    filename: string;
    timestamp: number;
}

const WEB_DOWNLOADS_KEY = 'idh_web_downloads';

export default function DashboardWeb() {
    const [urlInput, setUrlInput] = useState('');
    const [selectedFormat, setSelectedFormat] = useState('best-video');
    const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isDownloading, setIsDownloading] = useState(false);
    const [recentDownloads, setRecentDownloads] = useState<DownloadRecord[]>(() => {
        try {
            return JSON.parse(localStorage.getItem(WEB_DOWNLOADS_KEY) || '[]');
        } catch {
            return [];
        }
    });

    const handleFetchInfo = useCallback(async () => {
        if (!urlInput.trim()) {
            setError('Please enter a video URL');
            return;
        }

        setIsLoading(true);
        setError(null);
        setVideoInfo(null);

        try {
            const response = await webAPI.fetchVideoInfo(urlInput);
            // Handle the response structure: { success: true, data: videoInfo, meta: {...} }
            const videoData = response.data || response;
            setVideoInfo(videoData);
            setSelectedFormat('best-video');
        } catch (err: unknown) {
            const errorMsg = err instanceof Error ? err.message : String(err);
            setError(errorMsg);
            setVideoInfo(null);
        } finally {
            setIsLoading(false);
        }
    }, [urlInput]);

    const handleDownload = useCallback(async () => {
        if (!videoInfo) return;

        setIsDownloading(true);
        setError(null);

        try {
            const ext = videoInfo.formats.find(f => f.formatId === selectedFormat)?.ext || 'mp4';
            const filename = `${videoInfo.title.replace(/[^a-z0-9]/gi, '_').slice(0, 50)}.${ext}`;

            await webAPI.startDownload({
                url: urlInput,
                filename,
                formatId: selectedFormat,
            });

            // Add to recent downloads
            const newRecord: DownloadRecord = {
                id: Date.now().toString(),
                title: videoInfo.title,
                filename,
                timestamp: Date.now(),
            };

            const updated = [newRecord, ...recentDownloads].slice(0, 10);
            setRecentDownloads(updated);
            localStorage.setItem(WEB_DOWNLOADS_KEY, JSON.stringify(updated));

            // Reset form
            setUrlInput('');
            setVideoInfo(null);

            setError(null);
        } catch (err: unknown) {
            const errorMsg = err instanceof Error ? err.message : String(err);
            setError(errorMsg);
        } finally {
            setIsDownloading(false);
        }
    }, [videoInfo, urlInput, selectedFormat, recentDownloads]);

    const handleClearHistory = useCallback(() => {
        if (confirm('Clear download history?')) {
            setRecentDownloads([]);
            localStorage.removeItem(WEB_DOWNLOADS_KEY);
        }
    }, []);

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !isLoading && !videoInfo) {
            handleFetchInfo();
        }
    };

    return (
        <LayoutShell>
            <div className="max-w-4xl mx-auto space-y-6 py-6">
                {/* Info Banner */}
                <Alert className="border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-100">
                    <Download className="h-4 w-4" />
                    <AlertTitle>Web Version</AlertTitle>
                    <AlertDescription>
                        Files download directly to your browser&apos;s Downloads folder. No installation needed — works in any browser.
                        Supports YouTube, TikTok, Twitter, Instagram, Reddit, and 50+ other sites.
                    </AlertDescription>
                </Alert>

                {/* Main Download Card */}
                <Card>
                    <CardContent className="p-6 space-y-4">
                        {/* URL Input */}
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Video URL</label>
                            <div className="flex gap-2">
                                <Input
                                    placeholder="Paste YouTube, TikTok, Twitter, or other video link..."
                                    value={urlInput}
                                    onChange={e => setUrlInput(e.target.value)}
                                    onKeyPress={handleKeyPress}
                                    disabled={isLoading || isDownloading}
                                    className="flex-1"
                                />
                                <Button
                                    onClick={handleFetchInfo}
                                    disabled={isLoading || !urlInput.trim()}
                                    className="min-w-32"
                                >
                                    {isLoading ? (
                                        <>
                                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                            Getting Info...
                                        </>
                                    ) : (
                                        'Get Info'
                                    )}
                                </Button>
                            </div>
                        </div>

                        {/* Error Message */}
                        {error && (
                            <Alert variant="destructive">
                                <AlertCircle className="h-4 w-4" />
                                <AlertTitle>Error</AlertTitle>
                                <AlertDescription>{error}</AlertDescription>
                            </Alert>
                        )}

                        {/* Video Info */}
                        {videoInfo && (
                            <div className="space-y-4">
                                {/* Thumbnail */}
                                {videoInfo.thumbnail && (
                                    <div className="relative overflow-hidden rounded-lg bg-muted">
                                        <img
                                            src={videoInfo.thumbnail}
                                            alt={videoInfo.title}
                                            className="w-full h-auto max-h-64 object-cover"
                                        />
                                    </div>
                                )}

                                {/* Title */}
                                <div>
                                    <p className="font-semibold text-lg line-clamp-2">{videoInfo.title}</p>
                                </div>

                                {/* Quality Selection */}
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Download Quality</label>
                                    <Select value={selectedFormat} onValueChange={setSelectedFormat}>
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {videoInfo.formats.map(fmt => (
                                                <SelectItem key={fmt.formatId} value={fmt.formatId}>
                                                    {fmt.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                {/* Download Button */}
                                <Button
                                    onClick={handleDownload}
                                    disabled={isDownloading}
                                    size="lg"
                                    className="w-full"
                                >
                                    {isDownloading ? (
                                        <>
                                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                            Downloading...
                                        </>
                                    ) : (
                                        <>
                                            <Download className="h-4 w-4 mr-2" />
                                            Download to Browser
                                        </>
                                    )}
                                </Button>

                                {/* Info Text */}
                                <p className="text-xs text-muted-foreground">
                                    📥 File will appear in your Downloads folder (typically: {'\u007E'}/Downloads)
                                </p>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Recent Downloads */}
                {recentDownloads.length > 0 && (
                    <Card>
                        <CardContent className="p-6 space-y-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Clock className="h-5 w-5" />
                                    <h3 className="font-semibold">Recent Downloads</h3>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={handleClearHistory}
                                    className="text-destructive hover:bg-destructive/10"
                                >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Clear
                                </Button>
                            </div>

                            <div className="space-y-2 max-h-96 overflow-y-auto">
                                {recentDownloads.map(record => (
                                    <div
                                        key={record.id}
                                        className="flex items-center gap-3 p-3 rounded-lg border bg-muted/50 hover:bg-muted transition-colors"
                                    >
                                        <DownloadIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium truncate">{record.title}</p>
                                            <p className="text-xs text-muted-foreground truncate">{record.filename}</p>
                                        </div>
                                        <div className="text-xs text-muted-foreground shrink-0">
                                            {new Date(record.timestamp).toLocaleTimeString([], {
                                                hour: '2-digit',
                                                minute: '2-digit',
                                            })}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Browser Support Info */}
                <Alert className="border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Supported Browsers</AlertTitle>
                    <AlertDescription>
                        Chrome, Firefox, Safari, and Edge. Works best on desktop. Mobile browsers may have download limitations
                        depending on your device.
                    </AlertDescription>
                </Alert>

                {/* Why Web Version */}
                <Card className="bg-muted/50">
                    <CardContent className="p-6 space-y-3">
                        <h4 className="font-semibold">Web vs Desktop Version</h4>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                                <p className="font-medium text-green-700 dark:text-green-400">✓ Web Version</p>
                                <ul className="text-muted-foreground space-y-1 mt-2">
                                    <li>• No installation needed</li>
                                    <li>• Works everywhere</li>
                                    <li>• Instant access</li>
                                </ul>
                            </div>
                            <div>
                                <p className="font-medium text-blue-700 dark:text-blue-400">⚡ Desktop Version</p>
                                <ul className="text-muted-foreground space-y-1 mt-2">
                                    <li>• 1000+ sites</li>
                                    <li>• Batch downloads</li>
                                    <li>• MP3 extraction</li>
                                </ul>
                            </div>
                        </div>
                        <Button variant="outline" className="w-full mt-4" asChild>
                            <a href="https://github.com/Isaac-Onyango-Dev/Internet-Download-Hub/releases/latest" target="_blank" rel="noreferrer">
                                <ExternalLink className="h-4 w-4 mr-2" />
                                Download Desktop Version
                            </a>
                        </Button>
                    </CardContent>
                </Card>
            </div>
        </LayoutShell>
    );
}
