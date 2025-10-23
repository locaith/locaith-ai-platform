import { InputForm } from "./InputForm";

interface WelcomeScreenProps {
  handleSubmit: (
    submittedInputValue: string,
    effort: string
  ) => void;
  onCancel: () => void;
  isLoading: boolean;
  onImageStart?: (imageData: { id: string; prompt: string; aspectRatio: string; isEdit: boolean; originalFile?: File }) => void;
  onImageGenerated?: (imageData: { id: string; dataUrl: string; prompt: string; aspectRatio: string; isEdit: boolean; originalFile?: File }) => void;
  onError?: (errorMessage: string) => void;
  // NEW: controlled input mode from App
  mode?: "chat" | "image";
  onModeChange?: (mode: "chat" | "image") => void;
  // NEW: recent image for editing
  recentPreview?: string | null;
  lastImageUrl?: string | null;
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({
  handleSubmit,
  onCancel,
  isLoading,
  onImageStart,
  onImageGenerated,
  onError,
  mode,
  onModeChange,
  recentPreview,
  lastImageUrl,
}) => (
  <div className="h-full flex flex-col items-center justify-center text-center px-4 flex-1 w-full max-w-3xl mx-auto gap-4">
    <div>
      <h1 className="text-5xl md:text-6xl font-semibold text-neutral-100 mb-3">
        Welcome.
      </h1>
      <p className="text-xl md:text-2xl text-neutral-400">
        How can I help you today?
      </p>
    </div>
    <div className="w-full mt-4">
      <InputForm
          onSubmit={handleSubmit}
          isLoading={isLoading}
          onCancel={onCancel}
          hasHistory={false}
          onImageStart={onImageStart}
          onImageGenerated={onImageGenerated}
          onError={onError}
          mode={mode}
          onModeChange={onModeChange}
          recentPreview={recentPreview}
          lastImageUrl={lastImageUrl}
        />
    </div>
  </div>
);
