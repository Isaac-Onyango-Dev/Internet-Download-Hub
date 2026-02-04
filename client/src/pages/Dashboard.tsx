import { useState } from "react";
import { LayoutShell } from "@/components/layout-shell";
import { useDownloads, useCreateDownload, useClearCompletedDownloads } from "@/hooks/use-downloads";
import { DownloadItem } from "@/components/download-item";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Plus, Trash2, Search, Filter } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { api } from "@shared/routes";

const createSchema = api.downloads.create.input;

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState("all");
  const [search, setSearch] = useState("");
  const { data: downloads, isLoading } = useDownloads();
  const clearMutation = useClearCompletedDownloads();

  const filteredDownloads = downloads?.filter(d => {
    if (activeTab === "active") return d.state === "downloading" || d.state === "queued" || d.state === "paused";
    if (activeTab === "completed") return d.state === "completed";
    return true;
  }).filter(d => 
    d.filename.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <LayoutShell>
      <div className="space-y-8">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground">Downloads</h1>
            <p className="text-muted-foreground mt-1">Manage and track your file transfers.</p>
          </div>
          
          <div className="flex items-center gap-3">
            <AddDownloadDialog />
            <Button variant="outline" onClick={() => clearMutation.mutate()} disabled={clearMutation.isPending}>
              <Trash2 className="w-4 h-4 mr-2" />
              Clear Completed
            </Button>
          </div>
        </div>

        {/* Filters & Controls */}
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-card p-2 rounded-xl border border-border shadow-sm">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full md:w-auto">
            <TabsList className="bg-muted/50 p-1">
              <TabsTrigger value="all" className="px-4">All Files</TabsTrigger>
              <TabsTrigger value="active" className="px-4">Active</TabsTrigger>
              <TabsTrigger value="completed" className="px-4">Completed</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="relative w-full md:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="Search downloads..." 
              className="pl-9 bg-background border-border focus:ring-primary/20"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* Downloads List */}
        <div className="space-y-4">
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-24 bg-muted/30 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : filteredDownloads?.length === 0 ? (
            <div className="text-center py-20 border-2 border-dashed border-border rounded-xl bg-muted/10">
              <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                <Filter className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-medium text-foreground">No downloads found</h3>
              <p className="text-muted-foreground max-w-sm mx-auto mt-2">
                {search ? "Try adjusting your search terms." : "Add a new download URL to get started."}
              </p>
            </div>
          ) : (
            filteredDownloads?.map((download) => (
              <DownloadItem key={download.id} download={download} />
            ))
          )}
        </div>
      </div>
    </LayoutShell>
  );
}

function AddDownloadDialog() {
  const [open, setOpen] = useState(false);
  const createMutation = useCreateDownload();
  
  const form = useForm<z.infer<typeof createSchema>>({
    resolver: zodResolver(createSchema),
    defaultValues: {
      url: "",
      filename: "",
      totalBytes: 1024 * 1024 * 50, // Mock 50MB default
    }
  });

  const onSubmit = (data: z.infer<typeof createSchema>) => {
    // Infer filename from URL if empty
    if (!data.filename && data.url) {
      const urlParts = data.url.split('/');
      data.filename = urlParts[urlParts.length - 1] || "download.file";
    }
    
    createMutation.mutate(data, {
      onSuccess: () => {
        setOpen(false);
        form.reset();
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="shadow-lg shadow-primary/20 hover:shadow-primary/30">
          <Plus className="w-4 h-4 mr-2" />
          Add URL
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add New Download</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
            <FormField
              control={form.control}
              name="url"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>URL</FormLabel>
                  <FormControl>
                    <Input placeholder="https://example.com/file.zip" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="filename"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Filename (Optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="archive.zip" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? "Starting..." : "Start Download"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
