import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { SquarePen, Brain, StopCircle, ArrowUp, Image as ImageIcon, Video, Wand2, Wrench, ChevronDown, Globe, PenTool, Paperclip, X } from "lucide-react";
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

// Helper functions

// Updated InputFormProps
interface InputFormProps {
  onSubmit: (inputValue: string, effort: string) => void;
  onCancel: () => void;
  isLoading: boolean;
  hasHistory: boolean;
  mode?: "chat" | "image";
  onModeChange?: (mode: "chat" | "image") => void;
  onImageStart?: (imageData: { id: string; prompt: string; aspectRatio: string; isEdit: boolean; originalFile?: File }) => void;
  onImageGenerated?: (imageData: { id: string; dataUrl: string; prompt: string; aspectRatio: string; isEdit: boolean; originalFile?: File }) => void;
  onError?: (errorMessage: string) => void;
  // NEW: Props for recent image data to enable editing
  recentPreview?: string | null;
  lastImageUrl?: string | null;
}

export const InputForm: React.FC<InputFormProps> = ({
  onSubmit,
  onCancel,
  isLoading,
  hasHistory,
  mode: externalMode,
  onModeChange,
  onImageStart,
  onImageGenerated,
  onError,
  recentPreview,
  lastImageUrl,
}) => {
  const [internalInputValue, setInternalInputValue] = useState("");
  const [effort, setEffort] = useState("medium");
  // Image tool states
  const [internalMode, setInternalMode] = useState<"chat" | "image">("chat");
  const mode = externalMode ?? internalMode;
  
  const setMode = (newMode: "chat" | "image") => {
    if (onModeChange) {
      onModeChange(newMode);
    } else {
      setInternalMode(newMode);
    }
  };
  

  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [aspectRatio, setAspectRatio] = useState<string>("1:1");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageLoading, setImageLoading] = useState<boolean>(false);
  const [autoImageIntentEnabled, setAutoImageIntentEnabled] = useState<boolean>(true);
  const [justSubmitted, setJustSubmitted] = useState<boolean>(false);
  const [recentImageGenerated, setRecentImageGenerated] = useState<boolean>(false);
  const [lastGeneratedImageId, setLastGeneratedImageId] = useState<string | null>(null);
  
  // Auto-set mode when image intent is detected
  useEffect(() => {
    // If user has generated an image, disable auto-detection completely to avoid confusion
    if (lastGeneratedImageId || !autoImageIntentEnabled) {
      return; // Don't auto-switch modes when user has generated an image or auto-detection is disabled
    }
    
    if (!attachmentFile && !justSubmitted) {
      const hasImageIntent = internalInputValue.trim() && isImageIntent(internalInputValue) && !isAskAboutImages(internalInputValue);
      
      if (hasImageIntent && mode !== "image") {
        setMode("image");
      }
      // Note: Removed auto-switch to chat mode to maintain image mode persistence
    }
    
    // Reset justSubmitted flag when user starts typing again
    if (justSubmitted && internalInputValue.trim()) {
      setJustSubmitted(false);
    }
    
    // Reset recentImageGenerated flag when user starts typing non-image content
    if (recentImageGenerated && internalInputValue.trim()) {
      const hasImageIntent = isImageIntent(internalInputValue) && !isAskAboutImages(internalInputValue);
      if (!hasImageIntent) {
        setRecentImageGenerated(false);
      }
    }
  }, [internalInputValue, autoImageIntentEnabled, mode, attachmentFile, justSubmitted, imageLoading, recentImageGenerated, lastGeneratedImageId]);

  // Intent detection: auto choose image tool like ChatGPT
  const isImageIntent = (text: string) => {
    const t = (text || "").toLowerCase();
    
    // Exclude phrases that contain image keywords but are not image creation requests
    const excludePatterns = [
      "hình như",
      "hình thức",
      "hình dạng",
      "hình thành",
      "hình phạt",
      "hình ảnh về",
      "ảnh hưởng",
      "ảnh của",
      "ảnh trong",
      "ảnh này",
      "ảnh đó",
      "ảnh nào",
      "photo của",
      "photo trong",
      "photo này",
      "photo đó",
      "image của",
      "image trong",
      "image này",
      "image đó",
    ];
    
    // Check if text contains exclude patterns
    if (excludePatterns.some(pattern => t.includes(pattern))) {
      return false;
    }
    
    const keywords = [
      "tạo ảnh",
      "tạo hình ảnh",
      "vẽ ảnh",
      "vẽ hình",
      "chỉnh sửa ảnh",
      "sửa ảnh",
      "edit image",
      "generate image",
      "create image",
      "draw image",
      "make image",
      "design image",
    ];
    return keywords.some((k) => t.includes(k));
  };

  // Detect if user is asking about images rather than requesting creation
  const isAskAboutImages = (text: string) => {
    const t = (text || "").toLowerCase();
    const askWords = [
      "hỏi",
      "cách",
      "làm sao",
      "có thể",
      "được không",
      "what",
      "how",
      "cách dùng",
      "các mẫu ảnh",
      "ví dụ ảnh",
      // strengthened intent words
      "cơ chế",
      "nguyên lý",
      "cách hoạt động",
      "hoạt động",
      "giải thích",
      "phân tích",
      "tại sao",
      "vì sao",
      "explain",
      "mechanism",
      "workflow",
      "principle",
      "theory",
      "mô hình",
      // design-related asks
      "thiết kế",
      "design",
    ];
    return isImageIntent(t) && (askWords.some((k) => t.includes(k)) || t.includes("?"));
  };

  // Detect if user wants to edit the current image
  const isEditIntent = (text: string) => {
    const t = (text || "").toLowerCase();
    const editKeywords = [
      "sửa",
      "chỉnh sửa", 
      "thay đổi",
      "edit",
      "modify",
      "change",
      "điều chỉnh",
      "cải thiện",
      "làm cho",
      "thêm",
      "bớt",
      "xóa",
      "remove",
      "add",
      "improve",
      "better",
      "tốt hơn",
      "đẹp hơn",
      "rõ hơn",
      "sáng hơn",
      "tối hơn",
      "lớn hơn",
      "nhỏ hơn",
      "đổi",
      "fix",
      "adjust",
      "update",
      "cho thêm",
      "thêm vào",
      "bỏ đi",
      "nâng cấp"
    ];
    return editKeywords.some(keyword => t.includes(keyword));
  };

  // Call backend intent classifier for ambiguous cases
  const classifyImageIntent = async (
    text: string
  ): Promise<{ intent: "create" | "chat"; confidence: number }> => {
    const url = import.meta.env.DEV
      ? "/api/intent/image"
      : "http://localhost:8123/api/intent/image";
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_input: text }),
    });
    try {
      const json = await res.json();
      const intent = json?.intent === "create" ? "create" : "chat";
      const confidence = Number(json?.confidence ?? 0);
      return { intent, confidence };
    } catch (_) {
      return { intent: "chat", confidence: 0 };
    }
  };

  const handleInternalSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    const trimmed = internalInputValue.trim();
    if (!trimmed) return;

    // Decide routing: prefer explicit mode or attachment; else infer by classifier + explicit verbs
    let routeToImage = mode === "image" || !!attachmentFile;
    if (!routeToImage) {
      const keywordSuggestsImage = isImageIntent(trimmed);
      if (keywordSuggestsImage) {
        try {
          const { intent, confidence } = await classifyImageIntent(trimmed);
          const explicitCreate = /(^|\s)(tạo|vẽ|render|generate)\b/i.test(trimmed);
          routeToImage = (intent === "create" && confidence >= 0.6) || (explicitCreate && !isAskAboutImages(trimmed));
        } catch (_) {
          // fall back to explicit verbs only when classifier fails
          routeToImage = /(^|\s)(tạo|vẽ|render|generate)\b/i.test(trimmed) && !isAskAboutImages(trimmed);
        }
      }
    }

    console.info('[InputForm] Submit pressed', { mode, routeToImage, text: trimmed, aspectRatio });
    if (routeToImage) {
      // Ensure UI switches to image mode so preview panel is visible
      if (mode !== "image") setMode("image");

      // Determine if this should be an edit operation
      // Check for: uploaded file OR (edit intent AND (lastGeneratedImageId OR recentPreview available))
      const shouldEdit: boolean = !!attachmentFile || (isEditIntent(trimmed) && (!!lastGeneratedImageId || !!recentPreview || !!lastImageUrl || !!imagePreview));
      
      // Debug edit mode detection
      console.log('[InputForm] Edit mode detection:', {
        shouldEdit,
        attachmentFile: !!attachmentFile,
        lastGeneratedImageId,
        isEditIntent: isEditIntent(trimmed),
        trimmed,
        recentPreview: !!recentPreview,
        lastImageUrl: !!lastImageUrl,
        imagePreview: !!imagePreview
      });
      
      // Immediately emit start event so chat shows user + AI placeholder
      const opId = `${Date.now()}`;
      if (onImageStart) {
        onImageStart({
          id: opId,
          prompt: trimmed,
          aspectRatio,
          isEdit: shouldEdit,
          originalFile: attachmentFile || undefined,
        });
      }

      try {
        setImageLoading(true);
        setImagePreview(null);
        let dataUrl = "";
        let lastJson: any = null; // giữ JSON để hiển thị lý do nếu không có ảnh
        if (shouldEdit) {
          console.log('[InputForm] Edit mode - Available sources:', {
            attachmentFile: !!attachmentFile,
            recentPreview: !!recentPreview,
            lastImageUrl: !!lastImageUrl,
            imagePreview: !!imagePreview,
            lastGeneratedImageId
          });
          
          const fd = new FormData();
          fd.append("prompt", trimmed);
          fd.append("aspect_ratio", aspectRatio);
          
          // Priority order for image source: attachmentFile > recentPreview > lastImageUrl > imagePreview
          if (attachmentFile) {
            fd.append("file", attachmentFile);
            console.info('[InputForm] Using uploaded file for edit');
          } 
          else if (recentPreview) {
            try {
              // Convert data URL to blob
              const response = await fetch(recentPreview);
              const blob = await response.blob();
              const file = new File([blob], `recent_image.png`, { type: 'image/png' });
              fd.append("file", file);
              console.info('[InputForm] Using recentPreview for edit');
            } catch (err) {
              console.error('[InputForm] Failed to convert recentPreview to file:', err);
              throw new Error("Không thể sử dụng ảnh gần nhất để chỉnh sửa");
            }
          }
          else if (lastImageUrl) {
            try {
              // Convert data URL to blob
              const response = await fetch(lastImageUrl);
              const blob = await response.blob();
              const file = new File([blob], `last_image.png`, { type: 'image/png' });
              fd.append("file", file);
              console.info('[InputForm] Using lastImageUrl for edit');
            } catch (err) {
              console.error('[InputForm] Failed to convert lastImageUrl to file:', err);
              throw new Error("Không thể sử dụng ảnh gần nhất để chỉnh sửa");
            }
          }
          else if (imagePreview && lastGeneratedImageId) {
            try {
              // Convert data URL to blob
              const response = await fetch(imagePreview);
              const blob = await response.blob();
              const file = new File([blob], `image_${lastGeneratedImageId}.png`, { type: 'image/png' });
              fd.append("file", file);
              console.info('[InputForm] Using imagePreview for edit', { imageId: lastGeneratedImageId });
            } catch (err) {
              console.error('[InputForm] Failed to convert imagePreview to file:', err);
              throw new Error("Không thể sử dụng ảnh gần nhất để chỉnh sửa");
            }
          }
          else {
            throw new Error("Không có ảnh nào để chỉnh sửa. Vui lòng tạo ảnh mới hoặc tải lên ảnh.");
          }
          const url = import.meta.env.DEV ? "/api/image/edit" : "http://localhost:8123/api/image/edit";

          // Validate URL before fetch
          if (!url || typeof url !== "string" || url.trim() === "") {
            throw new Error("Invalid URL for image edit");
          }
          console.info('[InputForm] POST /api/image/edit', { aspectRatio, hasFile: !!attachmentFile, prompt: trimmed });

          const res = await fetch(url, { method: "POST", body: fd });
          let json: any = null;
          try {
            json = await res.json();
          } catch (_) {
            json = null;
          }
          lastJson = json;
          if (!res.ok) {
            const detail = Array.isArray(json?.detail)
              ? json.detail.map((d: any) => d?.msg || d).join("; ")
              : (json?.detail || json?.message);
            throw new Error(detail || `Image edit failed: ${res.status}`);
          }
          if (!json) throw new Error("No response body");
          dataUrl = json?.data_url || "";
        } else {
          const url = import.meta.env.DEV ? "/api/image/generate" : "http://localhost:8123/api/image/generate";

          // Validate URL before fetch
          if (!url || typeof url !== "string" || url.trim() === "") {
            throw new Error("Invalid URL for image generate");
          }
          console.info('[InputForm] POST /api/image/generate', { aspectRatio, prompt: trimmed });

          const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ prompt: trimmed, aspect_ratio: aspectRatio }),
          });
          let json: any = null;
          try {
            json = await res.json();
          } catch (_) {
            json = null;
          }
          lastJson = json;
          if (!res.ok) {
            const detail = Array.isArray(json?.detail)
              ? json.detail.map((d: any) => d?.msg || d).join("; ")
              : (json?.detail || json?.message);
            throw new Error(detail || `Image generate failed: ${res.status}`);
          }
          if (!json) throw new Error("No response body");
          dataUrl = json?.data_url || "";
        }
        if (dataUrl) {
          console.info('[InputForm] Image data_url received');
          setImagePreview(dataUrl);

          // Call callback to add image to chat history like ChatGPT/Gemini
          if (onImageGenerated) {
            onImageGenerated({
              id: opId,
              dataUrl,
              prompt: trimmed,
              aspectRatio,
              isEdit: shouldEdit,
              originalFile: attachmentFile || undefined,
            });
          }

          // Mark that we just generated an image to prevent mode reset
          setRecentImageGenerated(true);
          
          // Track the last generated image for edit functionality
          setLastGeneratedImageId(opId);
          
          // Disable auto-detection after successful image generation to avoid confusion
          setAutoImageIntentEnabled(false);
          
          // Clear input after successful image generation to allow new prompts
          setInternalInputValue("");
          
          // Keep image mode active for continued image generation
           // Do not auto-reset recentImageGenerated; user can type non-image content or press X to exit image mode
        } else {
          console.warn('[InputForm] No image returned', lastJson);
          const reason = Array.isArray(lastJson?.detail)
            ? lastJson.detail.map((d: any) => d?.msg || d).join("; ")
            : (lastJson?.detail || lastJson?.message || lastJson?.caption || (lastJson?.no_image ? "Model returned no image" : ""));
          const errorMsg = reason ? `Không nhận được ảnh: ${reason}` : "Model không trả về ảnh. Có thể bị chặn bởi safety hoặc cấu hình không hợp lệ.";
          
          if (onError) {
            onError(`Xin lỗi, tôi không thể tạo ảnh này. ${errorMsg} Vui lòng thử lại với mô tả khác.`);
          } else {
            alert(errorMsg);
          }
        }
      } catch (err) {
        console.error(err);
        const msg = (err as any)?.message || "Tạo/Chỉnh sửa ảnh thất bại. Vui lòng thử lại.";
        
        if (onError) {
          onError(`Xin lỗi, có lỗi xảy ra khi tạo ảnh. Vui lòng thử lại sau.`);
        } else {
          alert(msg);
        }
        
        // Keep image mode active - don't auto-disable on error
        // User can manually exit image mode if needed
        // setMode("chat");
        // setAutoImageIntentEnabled(true);
        // setRecentImageGenerated(false);
        // setLastGeneratedImageId(null);
      } finally {
        setImageLoading(false);
      }
      return;
    }

    // Fall back to normal chat
    onSubmit(trimmed, effort);
    setJustSubmitted(true);
    setInternalInputValue("");
  };

  const handleToolClick = (tool: "word" | "image" | "video" | "marketing" | "website") => {
    if (tool === "image") {
      setMode("image");
      setAutoImageIntentEnabled(false); // Disable auto-detection when manually activated
      return;
    }
    if (tool === "word") {
      // Trigger opening the RightPanel with Word preview
      const prompt = internalInputValue.trim();
      window.dispatchEvent(new CustomEvent("wordToolOpen", { detail: { prompt } }));
      console.info("Word tool triggered", { prompt });
      return;
    }
    // Placeholder hooks for future integration
    const msg =
      tool === "video"
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

  const isSubmitDisabled = !internalInputValue.trim() || imageLoading;
  const showImageControls = mode === "image" || !!attachmentFile || (isImageIntent(internalInputValue) && !isAskAboutImages(internalInputValue));

  return (
    <form onSubmit={handleInternalSubmit} className={`flex flex-col gap-2 p-4 max-w-3xl mx-auto w-full`}>
      <div className="group relative rounded-2xl bg-white/5 backdrop-blur-md border border-white/10 focus-within:border-cyan-400 focus-within:ring-4 focus-within:ring-cyan-400/20 shadow-[0_10px_30px_rgba(0,0,0,0.35)] hover:shadow-[0_10px_30px_rgba(0,0,0,0.25)] transition-all duration-300">
        <Textarea
          value={internalInputValue}
          onChange={(e) => setInternalInputValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleInternalSubmit(); } }}
          placeholder={showImageControls ? "Mô tả ảnh muốn tạo/sửa..." : "Nhập nội dung..."}
          className="w-full bg-transparent px-6 py-5 text-white placeholder-white/70 focus:outline-none caret-cyan-400 resize-none border-0 focus:ring-0 outline-none focus-visible:ring-0 shadow-none md:text-base min-h-[56px] max-h-[200px] rounded-2xl"
          rows={1}
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2">
          {isLoading ? (
            <Button 
              type="button" 
              variant="ghost" 
              size="icon" 
              className="text-red-500 hover:text-red-400 hover:bg-red-500/10 p-2 cursor-pointer rounded-xl transition-all duration-200 active:scale-95" 
              onClick={onCancel}
            >
              <StopCircle className="h-5 w-5" />
            </Button>
          ) : (
            <Button 
              type="submit" 
              className={`rounded-xl px-4 py-2 font-semibold shadow transition-all duration-200 active:scale-95 ${
                isSubmitDisabled 
                  ? "bg-white/10 text-white/50 cursor-not-allowed" 
                  : "bg-gradient-to-br from-cyan-400 to-teal-500 text-slate-900 hover:shadow-cyan-500/25"
              }`} 
              disabled={isSubmitDisabled}
            >
              Gửi ↑
            </Button>
          )}
        </div>
      </div>
      <div className="flex items-center justify-between">
        <div className="flex flex-row gap-2">
          {/* Effort pill with glassmorphism */}
          <div className="flex flex-row gap-2 bg-white/5 border border-white/10 text-white/80 rounded-full px-3 py-1.5">
            <div className="flex flex-row items-center text-sm">
              <Brain className="h-4 w-4 mr-2" />
              Effort
            </div>
            <Select value={effort} onValueChange={setEffort}>
              <SelectTrigger className="w-[120px] bg-transparent border-none cursor-pointer text-white/80">
                <SelectValue placeholder="Effort" />
              </SelectTrigger>
              <SelectContent className="bg-white/10 backdrop-blur-md border border-white/20 text-white">
                <SelectItem
                  value="low"
                  className="hover:bg-white/20 focus:bg-white/20 cursor-pointer text-white"
                >
                  Low
                </SelectItem>
                <SelectItem
                  value="medium"
                  className="hover:bg-white/20 focus:bg-white/20 cursor-pointer text-white"
                >
                  Medium
                </SelectItem>
                <SelectItem
                  value="high"
                  className="hover:bg-white/20 focus:bg-white/20 cursor-pointer text-white"
                >
                  High
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          {showImageControls ? (
            // Image mode: Show "Tạo ảnh" with X button
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                className="flex items-center gap-2 px-3 py-1.5 h-8 text-xs bg-blue-600 border-blue-500 text-white hover:bg-blue-700 rounded-xl rounded-t-sm"
                disabled
              >
                <ImageIcon className="w-3 h-3" />
                <span>Tạo ảnh</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setMode("chat");
                  setAutoImageIntentEnabled(true);
                  setJustSubmitted(false);
                  setRecentImageGenerated(false);
                  setLastGeneratedImageId(null);
                }}
                className="flex items-center justify-center w-8 h-8 p-0 bg-white/5 border border-white/10 text-white/80 hover:text-white hover:bg-white/10 rounded-full transition-all duration-200"
                title="Tắt chế độ tạo ảnh"
              >
                <X className="w-3 h-3" />
              </Button>
            </div>
          ) : (
            // Normal mode: Show Tools dropdown
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  className="flex items-center gap-2 px-3 py-1.5 h-8 text-xs bg-white/5 border border-white/10 text-white/80 hover:text-white hover:bg-white/10 rounded-full transition-all duration-200"
                >
                  <Wrench className="w-3 h-3" />
                  <span>Tools</span>
                  <ChevronDown className="w-3 h-3" />
                </Button>
              </DropdownMenuTrigger>
            <DropdownMenuContent className="w-48 bg-white/10 backdrop-blur-md border border-white/20">
              <DropdownMenuItem
                onClick={() => handleToolClick("word")}
                className="flex items-center gap-2 px-3 py-2 text-white hover:bg-white/20 cursor-pointer transition-colors"
              >
                <PenTool className="w-4 h-4" />
                <span>Soạn văn bản Word</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => handleToolClick("image")}
                className="flex items-center gap-2 px-3 py-2 text-white hover:bg-white/20 cursor-pointer transition-colors"
              >
                <ImageIcon className="w-4 h-4" />
                <span>Tạo ảnh</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => handleToolClick("video")}
                className="flex items-center gap-2 px-3 py-2 text-white hover:bg-white/20 cursor-pointer transition-colors"
              >
                <Video className="w-4 h-4" />
                <span>Tạo video</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => handleToolClick("marketing")}
                className="flex items-center gap-2 px-3 py-2 text-white hover:bg-white/20 cursor-pointer transition-colors"
              >
                <Wand2 className="w-4 h-4" />
                <span>Viết bài marketing</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => handleToolClick("website")}
                className="flex items-center gap-2 px-3 py-2 text-white hover:bg-white/20 cursor-pointer transition-colors"
              >
                <Globe className="w-4 h-4" />
                <span>Tạo website</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          )}
          {showImageControls && (
            <>
              <input id="image-file-input" type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
              <Button
                type="button"
                variant="outline"
                className="flex items-center gap-2 px-3 py-1.5 h-8 text-xs bg-white/5 border border-white/10 text-white/80 hover:text-white hover:bg-white/10 rounded-full transition-all duration-200"
                onClick={() => document.getElementById('image-file-input')?.click()}
              >
                <Paperclip className="w-3 h-3" />
                <span>Đính kèm ảnh</span>
              </Button>
              <div className="flex items-center gap-1 px-2 h-8 text-xs bg-white/5 border border-white/10 text-white/80 rounded-full">
                <span>Tỉ lệ</span>
                <Select value={aspectRatio} onValueChange={setAspectRatio}>
                  <SelectTrigger className="w-[90px] bg-transparent border-none h-8 text-white">
                    <SelectValue placeholder="1:1" />
                  </SelectTrigger>
                  <SelectContent className="bg-white/10 backdrop-blur-md border border-white/20">
                    <SelectItem value="1:1" className="text-white hover:bg-white/20">1:1</SelectItem>
                    <SelectItem value="16:9" className="text-white hover:bg-white/20">16:9</SelectItem>
                    <SelectItem value="9:16" className="text-white hover:bg-white/20">9:16</SelectItem>
                    <SelectItem value="4:3" className="text-white hover:bg-white/20">4:3</SelectItem>
                    <SelectItem value="3:4" className="text-white hover:bg-white/20">3:4</SelectItem>
                    <SelectItem value="2:3" className="text-white hover:bg-white/20">2:3</SelectItem>
                    <SelectItem value="3:2" className="text-white hover:bg-white/20">3:2</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {attachmentFile && (
                <Button
                  type="button"
                  variant="ghost"
                  className="flex items-center gap-1 px-2 h-8 text-xs text-white/80 hover:text-white hover:bg-white/10 rounded-full transition-all duration-200"
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
            className="bg-white/5 border border-white/10 text-white/80 hover:text-white hover:bg-white/10 cursor-pointer rounded-full pl-2 transition-all duration-200"
            variant="default"
            onClick={() => window.location.reload()}
          >
            <SquarePen size={16} />
            New Search
          </Button>
        )}
      </div>


    </form>
  );
};
