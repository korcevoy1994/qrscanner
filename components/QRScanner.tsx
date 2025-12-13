'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Html5Qrcode, Html5QrcodeScannerState, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { Camera, CameraOff, Flashlight, FlashlightOff, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn, hapticFeedback } from '@/lib/utils';

interface QRScannerProps {
  onScan: (data: string) => void;
  isActive?: boolean;
  className?: string;
}

interface CameraDevice {
  id: string;
  label: string;
}

export default function QRScanner({ onScan, isActive = true, className }: QRScannerProps) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const isTransitioningRef = useRef(false);
  const lastScannedCodeRef = useRef<string | null>(null);
  const cooldownTimerRef = useRef<NodeJS.Timeout | null>(null);
  const mountedRef = useRef(false);

  const [isScanning, setIsScanning] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [cameras, setCameras] = useState<CameraDevice[]>([]);
  const [currentCameraIndex, setCurrentCameraIndex] = useState(0);
  const [hasTorch, setHasTorch] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastScanned, setLastScanned] = useState<string | null>(null);

  const elementId = useRef(`qr-scanner-${Math.random().toString(36).slice(2, 9)}`);

  // Mount detection
  useEffect(() => {
    mountedRef.current = true;
    setIsMounted(true);

    return () => {
      mountedRef.current = false;
      if (cooldownTimerRef.current) {
        clearTimeout(cooldownTimerRef.current);
      }
    };
  }, []);

  // Get available cameras
  useEffect(() => {
    if (!isMounted) return;

    Html5Qrcode.getCameras()
      .then((devices) => {
        if (devices && devices.length) {
          const sortedCameras = [...devices].sort((a, b) => {
            const aIsBack = a.label.toLowerCase().includes('back') || a.label.toLowerCase().includes('rear');
            const bIsBack = b.label.toLowerCase().includes('back') || b.label.toLowerCase().includes('rear');
            if (aIsBack && !bIsBack) return -1;
            if (!aIsBack && bIsBack) return 1;
            return 0;
          });
          setCameras(sortedCameras);
        }
      })
      .catch((err) => {
        console.error('Error getting cameras:', err);
        setError('Не удалось получить доступ к камерам');
      });
  }, [isMounted]);

  // Parse QR data - передаём весь JSON для валидации по order_id/ticket_id
  const parseQRData = useCallback((decodedText: string): string => {
    try {
      // Проверяем что это валидный JSON
      let qrData = JSON.parse(decodedText);
      if (typeof qrData === 'string') {
        qrData = JSON.parse(qrData);
      }
      // Возвращаем весь JSON как строку для передачи в API
      return JSON.stringify(qrData);
    } catch {
      // Если не JSON - возвращаем как есть (legacy формат)
      return decodedText;
    }
  }, []);

  // Stop scanning safely
  const stopScanning = useCallback(async () => {
    if (!scannerRef.current || isTransitioningRef.current) return;

    isTransitioningRef.current = true;

    try {
      const state = scannerRef.current.getState();
      if (state === Html5QrcodeScannerState.SCANNING || state === Html5QrcodeScannerState.PAUSED) {
        await scannerRef.current.stop();
      }
    } catch (err) {
      // Ignore errors during stop
    }

    setIsScanning(false);
    setTorchOn(false);
    setHasTorch(false);
    isTransitioningRef.current = false;
  }, []);

  // Start scanning
  const startScanning = useCallback(async () => {
    if (!mountedRef.current || cameras.length === 0) return;
    if (isTransitioningRef.current) return;

    // Stop any existing scanning first
    if (scannerRef.current) {
      await stopScanning();
      // Small delay to ensure cleanup
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    if (!mountedRef.current) return;

    isTransitioningRef.current = true;
    setError(null);
    lastScannedCodeRef.current = null;

    try {
      // Create new scanner instance with QR-only format for faster detection
      scannerRef.current = new Html5Qrcode(elementId.current, {
        verbose: false,
        formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
      });

      const camera = cameras[currentCameraIndex];

      await scannerRef.current.start(
        camera.id,
        {
          fps: 30, // Higher FPS for faster detection
          qrbox: (viewfinderWidth, viewfinderHeight) => {
            // Use 80% of the smaller dimension for larger scanning area
            const minDimension = Math.min(viewfinderWidth, viewfinderHeight);
            const size = Math.floor(minDimension * 0.85);
            return { width: size, height: size };
          },
          aspectRatio: 1,
          disableFlip: false,
        },
        (decodedText) => {
          if (!mountedRef.current) return;

          const result = parseQRData(decodedText);

          // Skip if this is the same code we just scanned
          if (result === lastScannedCodeRef.current) return;

          // Clear any existing cooldown timer
          if (cooldownTimerRef.current) {
            clearTimeout(cooldownTimerRef.current);
          }

          // Store the scanned code
          lastScannedCodeRef.current = result;
          setLastScanned(result);

          // Haptic feedback on scan
          hapticFeedback('success');

          onScan(result);

          // Reset after 5 seconds of no scanning (allows rescan if user moves away and back)
          cooldownTimerRef.current = setTimeout(() => {
            lastScannedCodeRef.current = null;
          }, 5000);
        },
        () => {}
      );

      if (mountedRef.current) {
        setIsScanning(true);

        // Check for torch support
        try {
          const capabilities = scannerRef.current.getRunningTrackCapabilities() as MediaTrackCapabilities & { torch?: boolean };
          setHasTorch(!!capabilities?.torch);
        } catch {
          setHasTorch(false);
        }
      }
    } catch (err: any) {
      console.error('Error starting scanner:', err);
      if (mountedRef.current) {
        setError(err.message || 'Ошибка запуска камеры');
        setIsScanning(false);
      }
    }

    isTransitioningRef.current = false;
  }, [cameras, currentCameraIndex, parseQRData, onScan, stopScanning]);

  // Toggle torch
  const toggleTorch = useCallback(async () => {
    if (!scannerRef.current || !hasTorch || isTransitioningRef.current) return;

    try {
      await scannerRef.current.applyVideoConstraints({
        // @ts-ignore
        advanced: [{ torch: !torchOn }],
      });
      setTorchOn(!torchOn);
    } catch (err) {
      console.error('Error toggling torch:', err);
    }
  }, [hasTorch, torchOn]);

  // Select camera by id
  const selectCamera = useCallback((cameraId: string) => {
    if (isTransitioningRef.current) return;
    const index = cameras.findIndex(c => c.id === cameraId);
    if (index !== -1 && index !== currentCameraIndex) {
      setCurrentCameraIndex(index);
    }
  }, [cameras, currentCameraIndex]);

  // Start when cameras are available and component is active
  useEffect(() => {
    if (!isMounted || cameras.length === 0 || !isActive) return;

    startScanning();

    return () => {
      // Cleanup on unmount or when becoming inactive
      if (scannerRef.current) {
        const scanner = scannerRef.current;
        scannerRef.current = null;

        (async () => {
          try {
            const state = scanner.getState();
            if (state === Html5QrcodeScannerState.SCANNING || state === Html5QrcodeScannerState.PAUSED) {
              await scanner.stop();
            }
          } catch {
            // Ignore cleanup errors
          }
        })();
      }
    };
  }, [isMounted, cameras, currentCameraIndex, isActive]);

  // Handle active state changes
  useEffect(() => {
    if (!isMounted) return;

    if (!isActive && isScanning) {
      stopScanning();
    }
  }, [isActive, isScanning, isMounted, stopScanning]);

  if (!isMounted) {
    return (
      <div className={cn('flex flex-col gap-4', className)}>
        <div className="relative w-full aspect-square bg-black/90 rounded-2xl overflow-hidden">
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col gap-4', className)}>
      {/* Camera area */}
      <div className="relative w-full aspect-square bg-black rounded-2xl overflow-hidden">
        {/* Scanner container */}
        <div id={elementId.current} className="absolute inset-0 [&_video]:w-full [&_video]:h-full [&_video]:object-cover [&>div]:!border-0 [&>div]:!shadow-none [&_#qr-shaded-region]:!border-0 [&_#qr-shaded-region]:hidden" />

        {/* Scanning overlay frame */}
        {isScanning && (
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/40" />

            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[85%] h-[85%]">
              <div className="absolute top-0 left-0 w-16 h-16 border-t-4 border-l-4 border-primary rounded-tl-2xl" />
              <div className="absolute top-0 right-0 w-16 h-16 border-t-4 border-r-4 border-primary rounded-tr-2xl" />
              <div className="absolute bottom-0 left-0 w-16 h-16 border-b-4 border-l-4 border-primary rounded-bl-2xl" />
              <div className="absolute bottom-0 right-0 w-16 h-16 border-b-4 border-r-4 border-primary rounded-br-2xl" />

              {/* Scanning line */}
              <div className="absolute inset-0 overflow-hidden">
                <div className="h-0.5 bg-gradient-to-r from-transparent via-primary to-transparent shadow-[0_0_8px_2px_rgba(var(--primary-rgb),0.5)] animate-scan" />
              </div>
            </div>
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm p-6">
            <CameraOff className="w-16 h-16 text-destructive mb-4" />
            <p className="text-destructive text-center font-medium mb-4">{error}</p>
            <Button onClick={startScanning} variant="outline" className="gap-2">
              <RefreshCw className="w-4 h-4" />
              Повторить
            </Button>
          </div>
        )}

        {/* Not scanning state */}
        {!isScanning && !error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm">
            <Camera className="w-16 h-16 text-muted-foreground mb-4" />
            <p className="text-muted-foreground text-center mb-4">Камера не активна</p>
            <Button onClick={startScanning} className="gap-2">
              <Camera className="w-4 h-4" />
              Включить камеру
            </Button>
          </div>
        )}

        {/* Status badge */}
        <div className="absolute top-4 left-4">
          <Badge variant={isScanning ? 'default' : 'secondary'} className="gap-1.5">
            <span className={cn('w-2 h-2 rounded-full', isScanning ? 'bg-green-400 animate-pulse' : 'bg-muted-foreground')} />
            {isScanning ? 'Сканирование' : 'Ожидание'}
          </Badge>
        </div>

        {/* Last scanned indicator */}
        {lastScanned && (
          <div className="absolute top-4 right-4">
            <Badge variant="outline" className="bg-background/80 backdrop-blur-sm max-w-[150px] truncate">
              {lastScanned}
            </Badge>
          </div>
        )}
      </div>

      {/* Controls panel - outside camera area */}
      {(cameras.length > 1 || hasTorch) && (
        <div className="flex items-center justify-center gap-3">
          {cameras.length > 1 && (
            <Select value={cameras[currentCameraIndex]?.id} onValueChange={selectCamera}>
              <SelectTrigger className="w-[200px]">
                <Camera className="w-4 h-4 mr-2 shrink-0" />
                <SelectValue placeholder="Выберите камеру" />
              </SelectTrigger>
              <SelectContent>
                {cameras.map((camera, index) => (
                  <SelectItem key={camera.id} value={camera.id}>
                    {camera.label || `Камера ${index + 1}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {hasTorch && (
            <Button
              variant={torchOn ? 'default' : 'outline'}
              onClick={toggleTorch}
              className="gap-2"
            >
              {torchOn ? <FlashlightOff className="w-4 h-4" /> : <Flashlight className="w-4 h-4" />}
              {torchOn ? 'Выкл. фонарик' : 'Вкл. фонарик'}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
