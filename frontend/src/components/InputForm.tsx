import { useState } from "react";
import { Button } from "@/components/ui/button";
import { SquarePen, Brain, StopCircle, ArrowUp, Image as ImageIcon, Video, Wand2, Wrench, ChevronDown, FileText, Palette, Globe, PenTool, Paperclip, Download, X } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Updated InputFormProps
interface InputFormProps {
  onSubmit: (inputValue: string, effort: string) => void;
  onCancel: () => void;
  isLoading: boolean;
  hasHistory: boolean;
}

export const InputForm: React.FC<InputFormProps> = ({
  onSubmit,
  onCancel,
  isLoading,
  hasHistory,
}) => {
  const [internalInputValue, setInternalInputValue] = useState("");
  const [effort, setEffort] = useState("medium");
  // Image tool states
  const [mode, setMode] = useState<"chat" | "image">("chat");
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [aspectRatio, setAspectRatio] = useState<string>("1:1");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageLoading, setImageLoading] = useState<boolean>(false);

  const handleInternalSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (mode === "image") {
      if (!internalInputValue.trim()) return;
      try {
        setImageLoading(true);
        setImagePreview(null);
        let dataUrl = "";
        if (attachmentFile) {
          const fd = new FormData();
          fd.append("prompt", internalInputValue.trim());
          fd.append("aspect_ratio", aspectRatio);
          fd.append("file", attachmentFile);
          const url = import.meta.env.DEV ? "/api/image/edit" : "http://localhost:8123/api/image/edit";
          const res = await fetch(url, { method: "POST", body: fd });
          if (!res.ok) throw new Error(`Image edit failed: ${res.status}`);
          const json = await res.json();
          dataUrl = json?.data_url || "";
        } else {
          const url = import.meta.env.DEV ? "/api/image/generate" : "http://localhost:8123/api/image/generate";
          const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ prompt: internalInputValue.trim(), aspect_ratio: aspectRatio }),
          });
          if (!res.ok) throw new Error(`Image generate failed: ${res.status}`);
          const json = await res.json();
          dataUrl = json?.data_url || "";
        }
        if (dataUrl) setImagePreview(dataUrl);
      } catch (err) {
        console.error(err);
        alert("Tạo/Chỉnh sửa ảnh thất bại. Vui lòng thử lại.");
      } finally {
        setImageLoading(false);
      }
      return;
    }
    if (!internalInputValue.trim()) return;
    onSubmit(internalInputValue, effort);
    setInternalInputValue("");
  };

  const handleToolClick = (tool: "word" | "image" | "video" | "marketing" | "website") => {
    if (tool === "image") {
      setMode("image");
      return;
    }
    // Placeholder hooks for future integration
    const msg =
      tool === "word"
        ? "Soạn văn bản Word: Tính năng đang phát triển."
        : tool === "image"
        ? "Tạo ảnh: Tính năng đang phát triển."
        : tool === "video"
        ? "Tạo video: Tính năng đang phát triển."
        : tool === "marketing"
        ? "Viết bài marketing: Tính năng đang phát triển."
        : "Tạo website: Tính năng đang phát triển.";
    // Non-blocking hint for the user
    console.info(msg);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] || null;
    setAttachmentFile(f);
  };

  const isSubmitDisabled = (mode === "image" ? !internalInputValue.trim() : !internalInputValue.trim()) || isLoading || imageLoading;

  return (
    <form onSubmit={handleInternalSubmit} className={`flex flex-col gap-2 p-4 max-w-3xl mx-auto w-full`}>
      <div className={`flex flex-row items-center justify-between text-white rounded-3xl rounded-bl-sm ${hasHistory ? "rounded-br-sm" : ""} break-words min-h-7 bg-neutral-700 px-4 pt-3 `}>
        <Textarea
          value={internalInputValue}
          onChange={(e) => setInternalInputValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleInternalSubmit(); } }}
          placeholder={mode === "image" ? "Mô tả ảnh muốn tạo/sửa..." : "Nhập nội dung..."}
          className={`w-full text-neutral-100 placeholder-neutral-500 resize-none border-0 focus:outline-none focus:ring-0 outline-none focus-visible:ring-0 shadow-none md:text-base  min-h-[56px] max-h-[200px]`}
          rows={1}
        />
        <div className="-mt-3">
          {isLoading ? (
            <Button type="button" variant="ghost" size="icon" className="text-red-500 hover:text-red-400 hover:bg-red-500/10 p-2 cursor-pointer rounded-full transition-all duration-200" onClick={onCancel}>
              <StopCircle className="h-5 w-5" />
            </Button>
          ) : (
            <Button type="submit" variant="ghost" className={`${isSubmitDisabled ? "text-neutral-500" : "text-blue-500 hover:text-blue-400 hover:bg-blue-500/10"} p-2 cursor-pointer rounded-full transition-all duration-200 text-base`} disabled={isSubmitDisabled}>
              {mode === "image" ? "Tạo ảnh" : "Search"}
              <ArrowUp className="h-5 w-5" />
            </Button>
          )}
        </div>
      </div>
      <div className="flex items-center justify-between">
        <div className="flex flex-row gap-2">
          {/* Tools dropdown unchanged */}
          <div className="flex flex-row gap-2 bg-neutral-700 border-neutral-600 text-neutral-300 focus:ring-neutral-500 rounded-xl rounded-t-sm pl-2  max-w-[100%] sm:max-w-[90%]">
            <div className="flex flex-row items-center text-sm">
              <Brain className="h-4 w-4 mr-2" />
              Effort
            </div>
            <Select value={effort} onValueChange={setEffort}>
              <SelectTrigger className="w-[120px] bg-transparent border-none cursor-pointer">
                <SelectValue placeholder="Effort" />
              </SelectTrigger>
              <SelectContent className="bg-neutral-700 border-neutral-600 text-neutral-300 cursor-pointer">
                <SelectItem
                  value="low"
                  className="hover:bg-neutral-600 focus:bg-neutral-600 cursor-pointer"
                >
                  Low
                </SelectItem>
                <SelectItem
                  value="medium"
                  className="hover:bg-neutral-600 focus:bg-neutral-600 cursor-pointer"
                >
                  Medium
                </SelectItem>
                <SelectItem
                  value="high"
                  className="hover:bg-neutral-600 focus:bg-neutral-600 cursor-pointer"
                >
                  High
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                className="flex items-center gap-2 px-3 py-1.5 h-8 text-xs bg-neutral-700 border-neutral-600 text-neutral-300 hover:text-white hover:bg-neutral-600 rounded-xl rounded-t-sm"
              >
                <Wrench className="w-3 h-3" />
                <span>Tools</span>
                <ChevronDown className="w-3 h-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-48 bg-neutral-700 border-neutral-600">
              <DropdownMenuItem
                onClick={() => handleToolClick("word")}
                className="flex items-center gap-2 px-3 py-2 text-neutral-300 hover:bg-neutral-600 cursor-pointer"
              >
                <PenTool className="w-4 h-4" />
                <span>Soạn văn bản Word</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => handleToolClick("image")}
                className="flex items-center gap-2 px-3 py-2 text-neutral-300 hover:bg-neutral-600 cursor-pointer"
              >
                <ImageIcon className="w-4 h-4" />
                <span>Tạo ảnh</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => handleToolClick("video")}
                className="flex items-center gap-2 px-3 py-2 text-neutral-300 hover:bg-neutral-600 cursor-pointer"
              >
                <Video className="w-4 h-4" />
                <span>Tạo video</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => handleToolClick("marketing")}
                className="flex items-center gap-2 px-3 py-2 text-neutral-300 hover:bg-neutral-600 cursor-pointer"
              >
                <Wand2 className="w-4 h-4" />
                <span>Viết bài marketing</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => handleToolClick("website")}
                className="flex items-center gap-2 px-3 py-2 text-neutral-300 hover:bg-neutral-600 cursor-pointer"
              >
                <Globe className="w-4 h-4" />
                <span>Tạo website</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {mode === "image" && (
            <>
              <input id="image-file-input" type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
              <Button
                type="button"
                variant="outline"
                className="flex items-center gap-2 px-3 py-1.5 h-8 text-xs bg-neutral-700 border-neutral-600 text-neutral-300 hover:text-white hover:bg-neutral-600 rounded-xl rounded-t-sm"
                onClick={() => document.getElementById('image-file-input')?.click()}
              >
                <Paperclip className="w-3 h-3" />
                <span>Đính kèm ảnh</span>
              </Button>
              <div className="flex items-center gap-1 px-2 h-8 text-xs bg-neutral-700 border-neutral-600 text-neutral-300 rounded-xl rounded-t-sm">
                <span>Tỉ lệ</span>
                <Select value={aspectRatio} onValueChange={setAspectRatio}>
                  <SelectTrigger className="w-[90px] bg-transparent border-none h-8">
                    <SelectValue placeholder="1:1" />
                  </SelectTrigger>
                  <SelectContent className="bg-neutral-700 border-neutral-600">
                    <SelectItem value="1:1">1:1</SelectItem>
                    <SelectItem value="16:9">16:9</SelectItem>
                    <SelectItem value="9:16">9:16</SelectItem>
                    <SelectItem value="4:3">4:3</SelectItem>
                    <SelectItem value="3:4">3:4</SelectItem>
                    <SelectItem value="2:3">2:3</SelectItem>
                    <SelectItem value="3:2">3:2</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {attachmentFile && (
                <Button
                  type="button"
                  variant="ghost"
                  className="flex items-center gap-1 px-2 h-8 text-xs text-neutral-300 hover:text-white hover:bg-neutral-600 rounded-xl rounded-t-sm"
                  onClick={() => setAttachmentFile(null)}
                >
                  <X className="w-3 h-3" />
                  <span>Bỏ ảnh</span>
                </Button>
              )}
            </>
          )}
        </div>
        {hasHistory && (
          <Button
            className="bg-neutral-700 border-neutral-600 text-neutral-300 cursor-pointer rounded-xl rounded-t-sm pl-2 "
            variant="default"
            onClick={() => window.location.reload()}
          >
            <SquarePen size={16} />
            New Search
          </Button>
        )}
      </div>

      {/* Image preview panel */}
      {mode === "image" && imagePreview && (
        <div className="mt-2 rounded-xl border border-neutral-700 bg-neutral-800 p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-neutral-300">Preview</span>
            <a href={imagePreview} download={`locaith-image-${Date.now()}.png`} className="text-xs">
              <Button size="sm" variant="outline" className="text-xs">
                <Download className="h-3 w-3 mr-1" /> Tải về
              </Button>
            </a>
          </div>
          <img src={imagePreview} alt="generated" className="max-h-[360px] w-auto rounded-md border border-neutral-700" />
          {attachmentFile && (
            <p className="text-[11px] text-neutral-400 mt-2">Ảnh đang chỉnh: {attachmentFile.name}</p>
          )}
        </div>
      )}
    </form>
  );
};
