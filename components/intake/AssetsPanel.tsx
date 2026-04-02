import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { FileText, Upload, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { InputMode, UploadedContextFile } from '@/lib/types';

interface AssetsPanelProps {
  appUrl: string;
  figmaUrl: string;
  inputMode: InputMode;
  screenshots: File[];
  videos: File[];
  uploadedFiles: UploadedContextFile[];
  onAppUrlChange: (value: string) => void;
  onFigmaUrlChange: (value: string) => void;
  onInputModeChange: (value: InputMode) => void;
  onAddScreenshots: (files: FileList | File[]) => void;
  onRemoveScreenshot: (index: number) => void;
  onAddVideos: (files: FileList | File[]) => void;
  onRemoveVideo: (index: number) => void;
  onAddFiles: (files: FileList | File[]) => void;
  onRemoveFile: (fileId: string) => void;
}

export function AssetsPanel({
  appUrl,
  figmaUrl,
  inputMode,
  screenshots,
  videos,
  uploadedFiles,
  onAppUrlChange,
  onFigmaUrlChange,
  onInputModeChange,
  onAddScreenshots,
  onRemoveScreenshot,
  onAddVideos,
  onRemoveVideo,
  onAddFiles,
  onRemoveFile,
}: AssetsPanelProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isScreenshotDragging, setIsScreenshotDragging] = useState(false);
  const [isVideoDragging, setIsVideoDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const screenshotInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  return (
    <Card className="flex h-full min-h-0 flex-col overflow-hidden rounded-[22px] border-border/45 bg-white/58 shadow-[0_28px_70px_-32px_rgba(68,48,29,0.72)] backdrop-blur-sm">
      <CardHeader className="min-h-[64px] justify-center border-b border-border/45 bg-[#e8dfd3] px-4 py-3">
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-black text-xs font-semibold text-white">
            1
          </span>
          <span>Project Assets</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 space-y-4 overflow-y-auto px-4 py-3.5">
        <section className="space-y-3">
          <div className="space-y-2">
            <div className="space-y-0.5">
              <h3 className="text-[13px] font-semibold">Product/Prototype</h3>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {(['url', 'figma', 'screenshots', 'video'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => onInputModeChange(mode)}
                  className={cn(
                    'inline-flex h-7 items-center rounded-full border px-2.5 text-[11px] font-medium capitalize transition-colors',
                    inputMode === mode
                      ? 'border-[#C26A43]/45 bg-white/85 text-foreground shadow-sm'
                      : 'border-border/50 bg-white/45 text-muted-foreground hover:bg-white/60'
                  )}
                >
                  {mode === 'figma' ? (
                    <Image
                      alt="Figma logo"
                      src="/figma-logo.png"
                      width={14}
                      height={14}
                      className="mr-1.5 h-3.5 w-3.5"
                    />
                  ) : null}
                  {mode === 'url' ? 'URL' : mode === 'figma' ? 'Figma' : mode === 'video' ? 'Video' : 'Screenshots'}
                </button>
              ))}
            </div>

            {inputMode === 'screenshots' ? (
              <>
                <input
                  ref={screenshotInputRef}
                  type="file"
                  multiple
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  className="hidden"
                  onChange={(event) => {
                    if (event.target.files?.length) {
                      onAddScreenshots(event.target.files);
                      event.target.value = '';
                    }
                  }}
                />

                <div
                  onDragEnter={(event) => {
                    event.preventDefault();
                    setIsScreenshotDragging(true);
                  }}
                  onDragOver={(event) => {
                    event.preventDefault();
                    setIsScreenshotDragging(true);
                  }}
                  onDragLeave={(event) => {
                    event.preventDefault();
                    setIsScreenshotDragging(false);
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    setIsScreenshotDragging(false);
                    if (event.dataTransfer.files?.length) {
                      onAddScreenshots(event.dataTransfer.files);
                    }
                  }}
                  className={cn(
                    'min-h-[112px] rounded-2xl border border-dashed px-3 py-3 transition-colors',
                    isScreenshotDragging
                      ? 'border-primary/50 bg-white/72'
                      : 'border-border/55 bg-white/42 hover:bg-white/58'
                  )}
                >
                  <div className="flex h-full items-center">
                    <div className="overflow-x-auto pb-1">
                      <div className="flex min-w-max gap-2">
                        <UploadTile
                          label="Add"
                          caption="Screens"
                          expanded={screenshots.length === 0}
                          onClick={() => screenshotInputRef.current?.click()}
                        />
                        {screenshots.map((file, index) => (
                          <ScreenshotTile
                            key={`${file.name}-${file.size}-${index}`}
                            file={file}
                            onRemove={() => onRemoveScreenshot(index)}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </>
            ) : inputMode === 'video' ? (
              <>
                <input
                  ref={videoInputRef}
                  type="file"
                  multiple
                  accept="video/mp4,video/quicktime,video/webm,video/ogg"
                  className="hidden"
                  onChange={(event) => {
                    if (event.target.files?.length) {
                      onAddVideos(event.target.files);
                      event.target.value = '';
                    }
                  }}
                />

                <div
                  onDragEnter={(event) => {
                    event.preventDefault();
                    setIsVideoDragging(true);
                  }}
                  onDragOver={(event) => {
                    event.preventDefault();
                    setIsVideoDragging(true);
                  }}
                  onDragLeave={(event) => {
                    event.preventDefault();
                    setIsVideoDragging(false);
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    setIsVideoDragging(false);
                    if (event.dataTransfer.files?.length) {
                      onAddVideos(event.dataTransfer.files);
                    }
                  }}
                  className={cn(
                    'min-h-[112px] rounded-2xl border border-dashed px-3 py-3 transition-colors',
                    isVideoDragging
                      ? 'border-primary/50 bg-white/72'
                      : 'border-border/55 bg-white/42 hover:bg-white/58'
                  )}
                >
                  <div className="flex h-full items-center">
                    <div className="overflow-x-auto pb-1">
                      <div className="flex min-w-max gap-2">
                        <UploadTile
                          label="Add"
                          caption="Videos"
                          expanded={videos.length === 0}
                          onClick={() => videoInputRef.current?.click()}
                        />
                        {videos.map((file, index) => (
                          <MediaFileTile
                            key={`${file.name}-${file.size}-${index}`}
                            file={file}
                            onRemove={() => onRemoveVideo(index)}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="space-y-1.5 pt-1">
                <Input
                  id="appUrl"
                  type="url"
                  placeholder={
                    inputMode === 'figma'
                      ? 'Paste your Figma link'
                      : 'https://your-app.com'
                  }
                  value={inputMode === 'figma' ? figmaUrl : appUrl}
                  onChange={(event) =>
                    inputMode === 'figma'
                      ? onFigmaUrlChange(event.target.value)
                      : onAppUrlChange(event.target.value)
                  }
                  className="h-9 border-border/50 bg-white/65 px-3 text-sm"
                />
                {inputMode === 'figma' ? (
                  <p className="px-1 text-[11px] text-muted-foreground">
                    Make sure your link has public view access
                  </p>
                ) : null}
              </div>
            )}
          </div>
        </section>

        <div className="border-t border-border/45 pt-3" />

        <section className="space-y-2.5 pt-0.5">
          <div className="space-y-0.5">
            <h3 className="text-[13px] font-semibold">Context files</h3>
            <p className="text-[11px] text-muted-foreground">
              Market research, Target market, Pitch deck, Executive Summary, Customer discovery, etc.
            </p>
          </div>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.ppt,.pptx,.png,.jpg,.jpeg,.webp,.gif"
            className="hidden"
            onChange={(event) => {
              if (event.target.files?.length) {
                onAddFiles(event.target.files);
                event.target.value = '';
              }
            }}
          />

          <div
            onDragEnter={(event) => {
              event.preventDefault();
              setIsDragging(true);
            }}
            onDragOver={(event) => {
              event.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={(event) => {
              event.preventDefault();
              setIsDragging(false);
            }}
            onDrop={(event) => {
              event.preventDefault();
              setIsDragging(false);
              if (event.dataTransfer.files?.length) {
                onAddFiles(event.dataTransfer.files);
              }
            }}
            className={cn(
              'min-h-[112px] rounded-2xl border border-dashed px-3 py-3 transition-colors',
              isDragging
                ? 'border-primary/50 bg-white/72'
                : 'border-border/55 bg-white/42 hover:bg-white/58'
            )}
          >
            <div className="flex h-full items-center">
              <div className="overflow-x-auto pb-1">
                <div className="flex min-w-max gap-2">
                  <UploadTile
                    label="Add"
                    caption="Files"
                    expanded={uploadedFiles.length === 0}
                    onClick={() => inputRef.current?.click()}
                  />
                  {uploadedFiles.map((file) => (
                    <ContextFileTile
                      key={file.id}
                      file={file}
                      onRemove={() => onRemoveFile(file.id)}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="border-t border-border/45 pt-3" />

        <section className="space-y-2.5 pb-0.5">
          <h3 className="text-[13px] font-semibold">Connect to your coding agent</h3>
          <div className="flex items-center gap-2 rounded-2xl border border-border/45 bg-white/38 px-3 py-2.5 blur-[0.6px] opacity-75">
            {['/api1.png', '/api2.png', '/api3.png', '/api4.png'].map((src, index) => (
              <div
                key={`${src}-${index}`}
                className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl border border-border/50 bg-white/70"
              >
                <Image
                  alt={`Coding agent provider ${index + 1}`}
                  src={src}
                  width={28}
                  height={28}
                  className="h-7 w-7 object-contain"
                  unoptimized
                />
              </div>
            ))}
          </div>
        </section>
      </CardContent>
    </Card>
  );
}

function UploadTile({
  label,
  caption,
  expanded = false,
  onClick,
}: {
  label: string;
  caption: string;
  expanded?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex h-20 shrink-0 flex-col items-center justify-center rounded-2xl border border-dashed border-border/55 bg-white/70 text-center transition-colors hover:bg-white/85',
        expanded ? 'min-w-[148px] px-3' : 'w-20'
      )}
    >
      <Upload className="h-4 w-4 text-foreground" />
      <span className="mt-1 text-[11px] font-medium text-foreground">{label}</span>
      <span className="text-[10px] text-muted-foreground">{caption}</span>
    </button>
  );
}

function ScreenshotTile({
  file,
  onRemove,
}: {
  file: File;
  onRemove: () => void;
}) {
  const [previewUrl, setPreviewUrl] = useState('');

  useEffect(() => {
    const nextUrl = URL.createObjectURL(file);
    setPreviewUrl(nextUrl);

    return () => {
      URL.revokeObjectURL(nextUrl);
    };
  }, [file]);

  return (
    <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl border border-border/45 bg-white/44">
      {previewUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img alt={file.name} src={previewUrl} className="h-full w-full object-cover" />
      ) : null}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[rgba(26,20,15,0.72)] to-transparent px-2 py-1">
        <p className="truncate text-[10px] font-medium text-white">{file.name}</p>
      </div>
      <button
        type="button"
        onClick={onRemove}
        className="absolute right-1 top-1 rounded-full bg-white/88 p-1 text-muted-foreground shadow-sm transition-colors hover:bg-white hover:text-foreground"
        aria-label={`Remove ${file.name}`}
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}

function ContextFileTile({
  file,
  onRemove,
}: {
  file: UploadedContextFile;
  onRemove: () => void;
}) {
  return (
    <div className="relative flex h-20 w-20 shrink-0 flex-col justify-between rounded-2xl border border-border/45 bg-white/44 p-2">
      <div className="rounded-full bg-white/80 p-1.5 text-muted-foreground shadow-sm w-fit">
        <FileText className="h-3.5 w-3.5" />
      </div>
      <div>
        <p className="line-clamp-2 text-[10px] font-medium leading-3.5">{file.name}</p>
        <p className="mt-0.5 text-[9px] text-muted-foreground">
          {formatIngestionStatus(file)}
        </p>
      </div>
      <button
        type="button"
        onClick={onRemove}
        className="absolute right-1 top-1 rounded-full bg-white/88 p-1 text-muted-foreground shadow-sm transition-colors hover:bg-white hover:text-foreground"
        aria-label={`Remove ${file.name}`}
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}

function MediaFileTile({
  file,
  onRemove,
}: {
  file: File;
  onRemove: () => void;
}) {
  return (
    <div className="relative flex h-20 w-20 shrink-0 flex-col justify-between rounded-2xl border border-border/45 bg-white/44 p-2">
      <div className="rounded-full bg-white/80 p-1.5 text-muted-foreground shadow-sm w-fit">
        <FileText className="h-3.5 w-3.5" />
      </div>
      <div>
        <p className="line-clamp-2 text-[10px] font-medium leading-3.5">{file.name}</p>
        <p className="mt-0.5 text-[9px] text-muted-foreground">
          {formatFileSize(file.size)}
        </p>
      </div>
      <button
        type="button"
        onClick={onRemove}
        className="absolute right-1 top-1 rounded-full bg-white/88 p-1 text-muted-foreground shadow-sm transition-colors hover:bg-white hover:text-foreground"
        aria-label={`Remove ${file.name}`}
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}

function formatFileSize(size: number) {
  if (size < 1024) {
    return `${size} B`;
  }

  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }

  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function formatIngestionStatus(file: UploadedContextFile) {
  if (file.ingestionStatus === 'uploading') {
    return 'Uploading';
  }

  if (file.ingestionStatus === 'parsed') {
    return 'Text ready';
  }

  if (file.ingestionStatus === 'error') {
    return 'Upload failed';
  }

  if (file.ingestionError) {
    return 'Metadata only';
  }

  return 'Stored';
}
