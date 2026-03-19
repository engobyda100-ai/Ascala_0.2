import { useRef, useState } from 'react';
import { FileText, Upload, X } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { UploadedContextFile } from '@/lib/types';

interface AssetsPanelProps {
  appUrl: string;
  uploadedFiles: UploadedContextFile[];
  onAppUrlChange: (value: string) => void;
  onAddFiles: (files: FileList | File[]) => void;
  onRemoveFile: (fileId: string) => void;
}

export function AssetsPanel({
  appUrl,
  uploadedFiles,
  onAppUrlChange,
  onAddFiles,
  onRemoveFile,
}: AssetsPanelProps) {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <Card className="flex h-full min-h-0 flex-col overflow-hidden rounded-[22px] border-border/45 bg-white/58 shadow-[0_18px_40px_-28px_rgba(68,48,29,0.55)] backdrop-blur-sm">
      <CardHeader className="border-b border-border/45 px-4 pb-2.5 pt-3.5">
        <CardTitle className="text-base font-semibold">Project Assets</CardTitle>
        <CardDescription>
          App URL and attached files.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-1 space-y-4 overflow-y-auto px-4 py-3.5">
        <section className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="appUrl" className="text-[13px] font-medium leading-none">
              Primary app URL
            </label>
            <Input
              id="appUrl"
              type="url"
              placeholder="https://your-app.com"
              value={appUrl}
              onChange={(event) => onAppUrlChange(event.target.value)}
              className="h-9 border-border/50 bg-white/65 px-3 text-sm"
            />
          </div>
        </section>

        <section className="space-y-2.5">
          <div className="space-y-1">
            <h3 className="text-[13px] font-semibold">Attached context</h3>
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
            role="button"
            tabIndex={0}
            onClick={() => inputRef.current?.click()}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                inputRef.current?.click();
              }
            }}
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
              'rounded-2xl border border-dashed px-3.5 py-4 transition-colors',
              isDragging
                ? 'border-primary/50 bg-white/72'
                : 'border-border/55 bg-white/42 hover:bg-white/58'
            )}
          >
            <div className="flex flex-col items-start gap-2.5">
              <div className="rounded-full bg-white/80 p-2 text-foreground shadow-sm">
                <Upload className="h-3.5 w-3.5" />
              </div>
              <div className="space-y-1">
                <p className="text-[13px] font-medium">Drop files here or click to upload</p>
                <p className="text-[11px] leading-4 text-muted-foreground">
                  PDFs, docs, spreadsheets, and images.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 rounded-full border-border/55 bg-white/70 px-3 text-xs"
                onClick={(event) => {
                  event.stopPropagation();
                  inputRef.current?.click();
                }}
              >
                Choose files
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            {uploadedFiles.length === 0 ? (
              <div className="rounded-2xl border border-border/45 bg-white/35 px-3.5 py-3 text-xs text-muted-foreground">
                No files attached yet.
              </div>
            ) : (
              uploadedFiles.map((file) => (
                <div
                  key={file.id}
                  className="flex items-center justify-between gap-2.5 rounded-2xl border border-border/45 bg-white/44 px-3.5 py-2.5"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="rounded-full bg-white/80 p-1.5 text-muted-foreground shadow-sm">
                      <FileText className="h-3.5 w-3.5" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-medium leading-5">{file.name}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {formatFileSize(file.size)}
                        <span className="mx-1">·</span>
                        {formatIngestionStatus(file)}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onRemoveFile(file.id)}
                    className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-white/70 hover:text-foreground"
                    aria-label={`Remove ${file.name}`}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>
        </section>
      </CardContent>
    </Card>
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
