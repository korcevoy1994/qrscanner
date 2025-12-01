'use client';

import { useRef, useState, useCallback } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Upload, Image as ImageIcon, X, Check, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface QRFileUploadProps {
  onScan: (data: string) => void;
  className?: string;
}

type UploadState = 'idle' | 'dragging' | 'processing' | 'success' | 'error';

export default function QRFileUpload({ onScan, className }: QRFileUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<UploadState>('idle');
  const [preview, setPreview] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const elementId = useRef(`qr-file-reader-${Math.random().toString(36).slice(2, 9)}`);

  // Parse QR data
  const parseQRData = useCallback((decodedText: string): string => {
    try {
      let qrData = JSON.parse(decodedText);
      if (typeof qrData === 'string') {
        qrData = JSON.parse(qrData);
      }
      return qrData.ticket_number || qrData.ticketNumber || decodedText;
    } catch {
      return decodedText;
    }
  }, []);

  // Process file
  const processFile = useCallback(async (file: File) => {
    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Пожалуйста, загрузите изображение');
      setState('error');
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      setError('Файл слишком большой (макс. 10 МБ)');
      setState('error');
      return;
    }

    setState('processing');
    setError(null);
    setResult(null);

    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);

    // Scan QR code
    try {
      const scanner = new Html5Qrcode(elementId.current);
      const decodedText = await scanner.scanFile(file, true);
      const parsedResult = parseQRData(decodedText);

      setResult(parsedResult);
      setState('success');

      // Vibrate on success
      if (navigator.vibrate) {
        navigator.vibrate(100);
      }

      onScan(parsedResult);
    } catch (err) {
      console.error('Error scanning file:', err);
      setError('QR код не найден на изображении');
      setState('error');
    }
  }, [parseQRData, onScan]);

  // Handle file input change
  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
    // Reset input for re-upload of same file
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [processFile]);

  // Handle drag events
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setState('dragging');
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setState('idle');
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const file = e.dataTransfer.files?.[0];
    if (file) {
      processFile(file);
    } else {
      setState('idle');
    }
  }, [processFile]);

  // Handle click
  const handleClick = useCallback(() => {
    if (state !== 'processing') {
      fileInputRef.current?.click();
    }
  }, [state]);

  // Reset state
  const handleReset = useCallback(() => {
    setState('idle');
    setPreview(null);
    setResult(null);
    setError(null);
  }, []);

  // Handle paste
  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (items) {
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) {
            processFile(file);
            break;
          }
        }
      }
    }
  }, [processFile]);

  return (
    <div className={cn('w-full', className)}>
      {/* Hidden elements */}
      <div id={elementId.current} className="hidden" />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Drop zone */}
      <Card
        onClick={handleClick}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onPaste={handlePaste}
        tabIndex={0}
        className={cn(
          'relative overflow-hidden cursor-pointer transition-all duration-300 border-2 border-dashed',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          state === 'idle' && 'border-muted-foreground/25 hover:border-primary/50 hover:bg-accent/50',
          state === 'dragging' && 'border-primary bg-primary/10 scale-[1.02]',
          state === 'processing' && 'border-primary/50 bg-primary/5',
          state === 'success' && 'border-green-500/50 bg-green-500/5',
          state === 'error' && 'border-destructive/50 bg-destructive/5',
        )}
      >
        {/* Preview image */}
        {preview && (
          <div className="relative aspect-video w-full overflow-hidden">
            <img
              src={preview}
              alt="Preview"
              className={cn(
                'w-full h-full object-contain transition-all duration-300',
                state === 'processing' && 'opacity-50 blur-sm',
              )}
            />

            {/* Processing overlay */}
            {state === 'processing' && (
              <div className="absolute inset-0 flex items-center justify-center bg-background/50 backdrop-blur-sm">
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="w-12 h-12 text-primary animate-spin" />
                  <p className="text-sm font-medium text-muted-foreground">Обработка изображения...</p>
                </div>
              </div>
            )}

            {/* Success overlay */}
            {state === 'success' && (
              <div className="absolute inset-0 flex items-center justify-center bg-green-500/20 backdrop-blur-sm">
                <div className="flex flex-col items-center gap-3">
                  <div className="w-16 h-16 rounded-full bg-green-500 flex items-center justify-center animate-in zoom-in duration-300">
                    <Check className="w-8 h-8 text-white" />
                  </div>
                  <Badge variant="secondary" className="bg-background/80">
                    {result}
                  </Badge>
                </div>
              </div>
            )}

            {/* Error overlay */}
            {state === 'error' && (
              <div className="absolute inset-0 flex items-center justify-center bg-destructive/20 backdrop-blur-sm">
                <div className="flex flex-col items-center gap-3">
                  <div className="w-16 h-16 rounded-full bg-destructive flex items-center justify-center animate-in zoom-in duration-300">
                    <AlertCircle className="w-8 h-8 text-white" />
                  </div>
                  <p className="text-sm font-medium text-destructive">{error}</p>
                </div>
              </div>
            )}

            {/* Reset button */}
            {(state === 'success' || state === 'error') && (
              <Button
                variant="secondary"
                size="icon"
                onClick={(e) => {
                  e.stopPropagation();
                  handleReset();
                }}
                className="absolute top-3 right-3 rounded-full w-8 h-8"
              >
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>
        )}

        {/* Empty state */}
        {!preview && (
          <div className="p-8 sm:p-12 flex flex-col items-center justify-center gap-4">
            <div className={cn(
              'w-20 h-20 rounded-full flex items-center justify-center transition-all duration-300',
              state === 'idle' && 'bg-muted',
              state === 'dragging' && 'bg-primary/20 scale-110',
            )}>
              {state === 'dragging' ? (
                <ImageIcon className="w-10 h-10 text-primary animate-pulse" />
              ) : (
                <Upload className="w-10 h-10 text-muted-foreground" />
              )}
            </div>

            <div className="text-center space-y-2">
              <h3 className="text-lg font-semibold">
                {state === 'dragging' ? 'Отпустите файл' : 'Загрузить изображение'}
              </h3>
              <p className="text-sm text-muted-foreground max-w-xs">
                Перетащите изображение сюда, вставьте из буфера обмена или нажмите для выбора
              </p>
            </div>

            <div className="flex flex-wrap justify-center gap-2 mt-2">
              <Badge variant="outline" className="text-xs">JPG</Badge>
              <Badge variant="outline" className="text-xs">PNG</Badge>
              <Badge variant="outline" className="text-xs">GIF</Badge>
              <Badge variant="outline" className="text-xs">WEBP</Badge>
            </div>
          </div>
        )}
      </Card>

      {/* Keyboard hint */}
      <p className="text-xs text-muted-foreground text-center mt-3">
        Совет: используйте <kbd className="px-1.5 py-0.5 rounded bg-muted font-mono text-[10px]">Ctrl+V</kbd> для вставки из буфера обмена
      </p>
    </div>
  );
}
