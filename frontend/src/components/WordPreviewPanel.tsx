import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clipboard, Printer, Download } from "lucide-react";

interface WordPreviewPanelProps {
  documentJson?: any | null;
  isGenerating?: boolean;
  error?: string;
}

function buildPreviewHtml(doc: any | null): string {
  if (!doc) {
    return `<div style="color:#bbb;font-style:italic">Chưa có nội dung để xem trước.</div>`;
  }
  const title = doc?.noiDung?.tieuDe || doc?.loaiVanBan || "Bản thảo";
  const sections: any[] = doc?.noiDung?.muc || [];
  const meta = doc?.meta || {};
  const ngayLap = meta?.ngayLap || "";

  const sectionHtml = sections
    .map((s) => {
      const heading = s?.heading || "";
      const paragraphs: string[] = s?.paragraphs || [];
      const ps = (paragraphs || [])
        .filter(Boolean)
        .map((p) => `<p>${String(p).replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>`) 
        .join("\n");
      return `<section>${heading ? `<h3>${heading}</h3>` : ""}${ps}</section>`;
    })
    .join("\n");

  return `
  <article class="word-preview">
    ${title ? `<h2>${title}</h2>` : ""}
    ${ngayLap ? `<div class="meta">Ngày lập: ${ngayLap}</div>` : ""}
    ${sectionHtml || `<p>(Đang soạn thảo...)</p>`}
  </article>`;
}

export const WordPreviewPanel: React.FC<WordPreviewPanelProps> = ({ documentJson, isGenerating, error }) => {
  const html = buildPreviewHtml(documentJson);

  const handleCopy = async () => {
    try {
      const text = (documentJson?.noiDung?.muc || [])
        .flatMap((m: any) => m?.paragraphs || [])
        .join("\n\n");
      await navigator.clipboard.writeText(text || "");
    } catch (e) {
      console.warn("Copy failed", e);
    }
  };

  const handlePrint = () => {
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>In văn bản</title>
      <style>
        body{background:#0a0a0a;color:#e5e5e5;font-family:system-ui,-apple-system,"Segoe UI",Roboto,Ubuntu,"Helvetica Neue",Arial,"Noto Sans","Apple Color Emoji","Segoe UI Emoji";margin:24px}
        h2{font-size:20px;margin:8px 0}
        h3{font-size:16px;margin:12px 0 6px;color:#9ca3af}
        p{line-height:1.6;margin:6px 0}
        .meta{font-size:12px;color:#9ca3af;margin-bottom:12px}
      </style>
    </head><body>${html}</body></html>`);
    win.document.close();
    win.focus();
    win.print();
    win.close();
  };

  const handleDownloadHtml = () => {
    const content = `<!doctype html><html><head><meta charset="utf-8"><title>Văn bản</title></head><body>${html}</body></html>`;
    const blob = new Blob([content], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "van-ban-xem-truoc.html";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <Card className="bg-neutral-800 border-neutral-700">
      <CardHeader className="flex items-center justify-between">
        <CardTitle className="text-neutral-100 text-sm">Soạn văn bản Word (Preview)</CardTitle>
        <div className="flex items-center gap-2">
          {/* Download (HTML) with transparent style to match image preview button */}
          <Button size="sm" variant="ghost" className="bg-transparent hover:bg-transparent transition-none text-white" onClick={handleDownloadHtml}>
            <Download className="h-4 w-4 mr-1" /> Tải về
          </Button>
          <Button size="sm" variant="outline" onClick={handleCopy}>
            <Clipboard className="h-4 w-4 mr-1" /> Sao chép
          </Button>
          <Button size="sm" variant="outline" onClick={handlePrint}>
            <Printer className="h-4 w-4 mr-1" /> In
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isGenerating && (
          <Badge variant="outline" className="text-[10px]">Đang tạo...</Badge>
        )}
        {error && (
          <div className="text-red-400 text-xs">{String(error)}</div>
        )}
        <div className="prose prose-invert max-w-none text-neutral-200">
          <style>{`
            .word-preview h2{font-size:18px;margin:6px 0;color:#e5e5e5}
            .word-preview h3{font-size:14px;margin:12px 0 6px;color:#9ca3af}
            .word-preview p{line-height:1.8;margin:6px 0}
            .word-preview .meta{font-size:12px;color:#9ca3af;margin-bottom:12px}
          `}</style>
          {/* Render raw HTML preview */}
          <div dangerouslySetInnerHTML={{ __html: html }} />
        </div>
      </CardContent>
    </Card>
  );
};