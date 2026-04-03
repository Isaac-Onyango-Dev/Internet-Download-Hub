/**
 * PlaylistDialog — shown when the backend detects a playlist URL.
 *
 * The user can choose:
 *   A) Download the entire playlist
 *   B) Download a numeric range (first N to last M)
 *   C) Cherry-pick individual videos from a scrollable checklist
 *
 * On confirm, calls window.electronAPI.addPlaylistToQueue() with the
 * filtered entry list, then closes and navigates to the queue tab.
 */
import { useState, useMemo, useCallback, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, List, AlertTriangle } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PlaylistEntry {
  /** 1-based index as returned by yt-dlp */
  index: number;
  url: string;
  title: string;
  thumbnail?: string;
}

export interface PlaylistDialogData {
  title: string;
  count: number;
  entries: PlaylistEntry[];
}

type DownloadMode = 'all' | 'range' | 'select';

interface Props {
  open: boolean;
  data: PlaylistDialogData | null;
  onClose: () => void;
  /** Called with the entries the user picked plus the playlist title */
  onConfirm: (entries: PlaylistEntry[], opts: { playlistTitle: string }) => Promise<void>;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function PlaylistDialog({ open, data, onClose, onConfirm }: Props) {
  const [mode, setMode] = useState<DownloadMode>('all');
  const [rangeFrom, setRangeFrom] = useState('1');
  const [rangeTo, setRangeTo] = useState('');
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [rangeError, setRangeError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Reset internal state whenever the dialog opens with new data
  const entries = data?.entries ?? [];
  const total = data?.count ?? entries.length;
  const title = data?.title ?? 'Playlist';

  // Initialise rangeTo when data changes
  const defaultRangeTo = String(total);

  // ── Computed entry list based on mode ────────────────────────────────────

  const resolvedEntries = useMemo<PlaylistEntry[]>(() => {
    if (mode === 'all') return entries;

    if (mode === 'range') {
      const from = parseInt(rangeFrom, 10);
      const to = parseInt(rangeTo || defaultRangeTo, 10);
      if (!isNaN(from) && !isNaN(to)) {
        return entries.filter((e) => e.index >= from && e.index <= to);
      }
      return [];
    }

    // mode === 'select'
    return entries.filter((e) => selected.has(e.index));
  }, [mode, entries, rangeFrom, rangeTo, defaultRangeTo, selected]);

  // ── Validation ───────────────────────────────────────────────────────────

  const validateRange = useCallback(() => {
    const from = parseInt(rangeFrom, 10);
    const to = parseInt(rangeTo || defaultRangeTo, 10);
    if (isNaN(from) || from < 1) {
      setRangeError('Start must be at least 1');
      return false;
    }
    if (isNaN(to) || to > total) {
      setRangeError(`End cannot exceed ${total}`);
      return false;
    }
    if (from > to) {
      setRangeError('Start cannot be greater than End');
      return false;
    }
    setRangeError(null);
    return true;
  }, [rangeFrom, rangeTo, defaultRangeTo, total]);

  const canConfirm =
    !submitting &&
    (mode === 'all'
      ? entries.length > 0
      : mode === 'range'
        ? resolvedEntries.length > 0 && !rangeError
        : selected.size > 0);

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleModeChange = (m: DownloadMode) => {
    setMode(m);
    setRangeError(null);
  };

  const toggleEntry = (index: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === entries.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(entries.map((e) => e.index)));
    }
  };

  const handleConfirm = async () => {
    if (mode === 'range' && !validateRange()) return;
    setSubmitting(true);
    try {
      await onConfirm(resolvedEntries, { playlistTitle: title });
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    if (submitting) return;
    onClose();
  };

  // Reset selection when dialog opens (avoids stale state from previous open)
  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) handleClose();
    else {
      setMode('all');
      setRangeFrom('1');
      setRangeTo('');
      setSelected(new Set());
      setRangeError(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="max-w-2xl w-full bg-[#111827] border border-white/10 text-white shadow-2xl"
        onEscapeKeyDown={handleClose}
      >
        {/* ── Header ── */}
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-semibold">
            <List className="h-5 w-5 text-blue-400 shrink-0" />
            Playlist Detected
          </DialogTitle>
          <DialogDescription asChild>
            <div className="mt-1 space-y-0.5 text-sm text-white/60">
              <p className="font-medium text-white/80 truncate max-w-lg">{title}</p>
              <p>
                {total} video{total !== 1 ? 's' : ''} found
              </p>
            </div>
          </DialogDescription>
        </DialogHeader>

        {/* ── Large-playlist warning ── */}
        {total >= 500 && (
          <Alert className="border-yellow-500/30 bg-yellow-500/10">
            <AlertTriangle className="h-4 w-4 text-yellow-400" />
            <AlertDescription className="text-yellow-300 text-sm">
              This playlist has {total}+ videos. Loading the full list may take a moment.
            </AlertDescription>
          </Alert>
        )}

        {/* ── Download mode selector ── */}
        <section className="space-y-3">
          <p className="text-sm font-medium text-white/70">Download Options</p>
          <RadioGroup
            value={mode}
            onValueChange={(v) => handleModeChange(v as DownloadMode)}
            className="space-y-2"
          >
            {/* All */}
            <div className="flex items-center gap-3 rounded-lg border border-white/10 px-4 py-3 hover:bg-white/5 cursor-pointer">
              <RadioGroupItem value="all" id="mode-all" />
              <Label htmlFor="mode-all" className="cursor-pointer text-sm">
                Download entire playlist <span className="text-white/50">({total} videos)</span>
              </Label>
            </div>

            {/* Range */}
            <div className="rounded-lg border border-white/10 px-4 py-3 hover:bg-white/5">
              <div className="flex items-center gap-3">
                <RadioGroupItem value="range" id="mode-range" />
                <Label htmlFor="mode-range" className="cursor-pointer text-sm">
                  Download a range
                </Label>
              </div>
              {mode === 'range' && (
                <div className="mt-3 flex items-center gap-3 pl-7">
                  <Input
                    type="number"
                    min={1}
                    max={total}
                    value={rangeFrom}
                    onChange={(e) => {
                      setRangeFrom(e.target.value);
                      setRangeError(null);
                    }}
                    onBlur={validateRange}
                    className="w-20 bg-white/5 border-white/20 text-white text-center"
                    aria-label="From video number"
                  />
                  <span className="text-white/50 text-sm">to</span>
                  <Input
                    type="number"
                    min={1}
                    max={total}
                    placeholder={defaultRangeTo}
                    value={rangeTo}
                    onChange={(e) => {
                      setRangeTo(e.target.value);
                      setRangeError(null);
                    }}
                    onBlur={validateRange}
                    className="w-20 bg-white/5 border-white/20 text-white text-center"
                    aria-label="To video number"
                  />
                  {resolvedEntries.length > 0 && !rangeError && (
                    <span className="text-white/40 text-xs">
                      {resolvedEntries.length} video{resolvedEntries.length !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>
              )}
              {mode === 'range' && rangeError && (
                <p className="mt-2 pl-7 text-red-400 text-xs">{rangeError}</p>
              )}
            </div>

            {/* Select specific */}
            <div className="rounded-lg border border-white/10 px-4 py-3 hover:bg-white/5">
              <div className="flex items-center gap-3">
                <RadioGroupItem value="select" id="mode-select" />
                <Label htmlFor="mode-select" className="cursor-pointer text-sm">
                  Select specific videos
                </Label>
              </div>

              {mode === 'select' && entries.length > 0 && (
                <div className="mt-3 pl-2 space-y-2">
                  {/* Select all toggle */}
                  <div className="flex items-center gap-2 pl-2 pb-1 border-b border-white/10">
                    <Checkbox
                      id="select-all"
                      checked={selected.size === entries.length}
                      onCheckedChange={toggleAll}
                      aria-label="Select all videos"
                    />
                    <Label htmlFor="select-all" className="cursor-pointer text-xs text-white/60">
                      {selected.size === entries.length ? 'Deselect All' : 'Select All'}
                    </Label>
                    <span className="ml-auto text-xs text-white/40">
                      {selected.size} of {entries.length} selected
                    </span>
                  </div>

                  {/* Video list */}
                  <ScrollArea className="h-56 pr-2">
                    <ul className="space-y-1">
                      {entries.map((entry) => (
                        <li
                          key={entry.index}
                          className="flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-white/5 cursor-pointer"
                          onClick={() => toggleEntry(entry.index)}
                        >
                          <Checkbox
                            checked={selected.has(entry.index)}
                            onCheckedChange={() => toggleEntry(entry.index)}
                            aria-label={`Select ${entry.title}`}
                          />
                          {entry.thumbnail && (
                            <img
                              src={entry.thumbnail}
                              alt=""
                              className="w-14 h-9 rounded object-cover shrink-0 bg-white/5"
                              loading="lazy"
                            />
                          )}
                          <span className="text-xs text-white/40 w-6 shrink-0 text-right">
                            {entry.index}.
                          </span>
                          <span className="text-sm text-white/90 truncate flex-1 min-w-0">
                            {entry.title}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </ScrollArea>

                  {/* No selection warning */}
                  {selected.size === 0 && (
                    <p className="text-xs text-yellow-400 pl-2">
                      Select at least one video to continue
                    </p>
                  )}
                </div>
              )}
            </div>
          </RadioGroup>
        </section>

        {/* ── Footer ── */}
        <div className="flex justify-end gap-3 pt-2 border-t border-white/10">
          <Button
            variant="outline"
            className="border-white/20 bg-transparent text-white/70 hover:bg-white/10"
            onClick={handleClose}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            className="bg-blue-600 hover:bg-blue-500 text-white"
            onClick={handleConfirm}
            disabled={!canConfirm}
            aria-label="Add selected videos to download queue"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Adding to Queue…
              </>
            ) : (
              `Add ${resolvedEntries.length > 0 ? resolvedEntries.length : total} video${(resolvedEntries.length || total) !== 1 ? 's' : ''} to Queue`
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
