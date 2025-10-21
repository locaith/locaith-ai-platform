import React, { useMemo, useEffect, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { ProcessedEvent } from "@/components/ActivityTimeline";
import { safeCreateURL } from "@/lib/errorHandler";

interface SearchResultsPanelProps {
  processedEvents: ProcessedEvent[];
  isLoading: boolean;
}

function dedupeSources(sources: any[]): any[] {
  const seen = new Set<string>();
  const out: any[] = [];
  for (const s of sources) {
    const url = s.url || s.link || s.source || s.href;
    if (!url || typeof url !== "string" || url.trim() === "") continue;
    
    let hostname = "";
    const trimmedUrl = url.trim();
    if (trimmedUrl.length < 4) {
      hostname = trimmedUrl;
    } else {
      const urlObj = safeCreateURL(trimmedUrl);
      if (urlObj) {
        hostname = urlObj.hostname;
      } else {
        console.warn('Invalid URL in dedupeSources:', url);
        hostname = String(url).substring(0, 50); // Fallback to truncated string
      }
    }
    const key = hostname + "|" + (s.title || "") + "|" + (s.snippet || "");
    if (!seen.has(key)) {
      seen.add(key);
      out.push({ ...s, url });
    }
  }
  return out;
}

function extractSources(events: ProcessedEvent[]): any[] {
  const all = events.flatMap((e) => (e.sources || e.details?.sources || []));
  return dedupeSources(all);
}

const safeHostname = (url: string): string => {
  if (!url || typeof url !== "string" || url.trim() === "") return "";
  
  const trimmedUrl = url.trim();
  
  // Check if it's a valid HTTP/HTTPS URL
  if (/^https?:\/\//i.test(trimmedUrl)) {
    // Additional validation for URL length and basic structure
    if (trimmedUrl.length < 8 || !trimmedUrl.includes('.')) {
      return trimmedUrl;
    }
    
    const urlObj = safeCreateURL(trimmedUrl);
    if (urlObj) {
      return urlObj.hostname;
    } else {
      console.warn('Invalid URL in safeHostname:', url);
      return String(url || "").substring(0, 50);
    }
  }
  
  return trimmedUrl;
};

const HostLink: React.FC<{ url: string; title?: string }> = ({ url, title }) => {
  const hostname = useMemo(() => safeHostname(url), [url]);
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="underline text-neutral-100 hover:text-white">
      {title || hostname}
    </a>
  );
};

const SourcePreview: React.FC<{ url: string }> = ({ url }) => {
  const [data, setData] = useState<{ title?: string; image?: string } | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    let mounted = true;
    async function fetchPreview() {
      setLoading(true);
      try {
        const base = import.meta.env.DEV ? "/api/preview" : "http://localhost:8123/api/preview";
        
        // Validate base URL and input URL
        if (!base || typeof base !== "string" || base.trim() === "") {
          throw new Error("Invalid base URL for preview");
        }
        if (!url || typeof url !== "string" || url.trim() === "") {
          throw new Error("Invalid URL for preview");
        }
        
        const res = await fetch(`${base}?url=${encodeURIComponent(url)}`);
        const json = await res.json();
        if (mounted) setData(json);
      } catch (e) {
        console.warn('Preview fetch error:', e);
        // silent fail
      } finally {
        if (mounted) setLoading(false);
      }
    }
    fetchPreview();
    return () => { mounted = false; };
  }, [url]);

  if (loading) {
    return <Skeleton className="h-16 w-24 rounded-md" />;
  }
  if (!data || (!data.image && !data.title)) {
    return null;
  }
  return (
    <div className="flex items-center gap-2">
      {data.image && (
        <img src={data.image} alt="preview" className="h-16 w-24 object-cover rounded-md border border-neutral-700" loading="lazy" />
      )}
      {data.title && (
        <div className="text-xs text-neutral-300 line-clamp-2">{data.title}</div>
      )}
    </div>
  );
};

export const SearchResultsPanel: React.FC<SearchResultsPanelProps> = ({ processedEvents, isLoading }) => {
  const sources = useMemo(() => extractSources(processedEvents), [processedEvents]);

  return (
    <Card className="bg-neutral-800 border-neutral-700">
      <CardHeader>
        <CardTitle className="text-neutral-100 text-sm">Sources</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading && sources.length === 0 ? (
          <div className="space-y-2">
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-6 w-2/3" />
          </div>
        ) : sources.length === 0 ? (
          <p className="text-xs text-neutral-400">Không có nguồn nào.</p>
        ) : (
          <ScrollArea className="max-h-64 custom-scroll pr-2">
            <ul className="space-y-3">
              {sources.map((s, idx) => (
                <li key={idx} className="flex items-start gap-3">
                  <div className="shrink-0">
                    <SourcePreview url={s.url} />
                  </div>
                  <div className="flex-1">
                    <HostLink url={s.url} title={s.title} />
                    {s.snippet && (
                      <p className="text-xs text-neutral-300 mt-1">{s.snippet}</p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
};