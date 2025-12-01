'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Html5Qrcode, Html5QrcodeScannerState } from 'html5-qrcode';
import { Camera, CameraOff, Flashlight, FlashlightOff, SwitchCamera, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

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
  const hasScannedRef = useRef(false);
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
    setIsMounted(true);
    return () => setIsMounted(false);
  }, []);

  // Get available cameras
  useEffect(() => {
    if (!isMounted) return;

    Html5Qrcode.getCameras()
      .then((devices) => {
        if (devices && devices.length) {
          // Prefer back camera
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

  // Start scanning
  const startScanning = useCallback(async () => {
    if (!isMounted || cameras.length === 0 || isScanning) return;

    setError(null);
    hasScannedRef.current = false;

    try {
      if (!scannerRef.current) {
        scannerRef.current = new Html5Qrcode(elementId.current, {
          verbose: false,
        });
      }

      const scanner = scannerRef.current;
      const camera = cameras[currentCameraIndex];

      await scanner.start(
        camera.id,
        {
          fps: 15,
          qrbox: { width: 280, height: 280 },
          aspectRatio: 1,
          disableFlip: false,
        },
        (decodedText) => {
          if (!hasScannedRef.current) {
            hasScannedRef.current = true;
            const result = parseQRData(decodedText);
            setLastScanned(result);

            // Vibrate on success
            if (navigator.vibrate) {
              navigator.vibrate(100);
            }

            onScan(result);

            // Pause briefly to prevent double scans
            scanner.pause(false);
            setTimeout(() => {
              hasScannedRef.current = false;
              if (scanner.getState() === Html5QrcodeScannerState.PAUSED) {
                scanner.resume();
              }
            }, 1500);
          }
        },
        () => {} // Ignore scan errors
      );

      setIsScanning(true);

      // Check for torch support
      try {
        const capabilities = scanner.getRunningTrackCapabilities() as MediaTrackCapabilities & { torch?: boolean };
        setHasTorch(!!capabilities?.torch);
      } catch {
        setHasTorch(false);
      }
    } catch (err: any) {
      console.error('Error starting scanner:', err);
      setError(err.message || 'Ошибка запуска камеры');
      setIsScanning(false);
    }
  }, [isMounted, cameras, currentCameraIndex, isScanning, parseQRData, onScan]);

  // Stop scanning
  const stopScanning = useCallback(async () => {
    if (!scannerRef.current) return;

    try {
      const state = scannerRef.current.getState();
      if (state === Html5QrcodeScannerState.SCANNING || state === Html5QrcodeScannerState.PAUSED) {
        await scannerRef.current.stop();
      }
    } catch (err) {
      console.error('Error stopping scanner:', err);
    }

    setIsScanning(false);
    setTorchOn(false);
    setHasTorch(false);
  }, []);

  // Toggle torch
  const toggleTorch = useCallback(async () => {
    if (!scannerRef.current || !hasTorch) return;

    try {
      await scannerRef.current.applyVideoConstraints({
        // @ts-ignore - torch is a valid constraint
        advanced: [{ torch: !torchOn }],
      });
      setTorchOn(!torchOn);
    } catch (err) {
      console.error('Error toggling torch:', err);
    }
  }, [hasTorch, torchOn]);

  // Switch camera
  const switchCamera = useCallback(async () => {
    if (cameras.length < 2) return;

    await stopScanning();
    setCurrentCameraIndex((prev) => (prev + 1) % cameras.length);
  }, [cameras.length, stopScanning]);

  // Auto-start on camera change
  useEffect(() => {
    if (isActive && cameras.length > 0 && !isScanning) {
      startScanning();
    }
  }, [isActive, cameras, currentCameraIndex]);

  // Cleanup on unmount or when inactive
  useEffect(() => {
    if (!isActive && isScanning) {
      stopScanning();
    }

    return () => {
      if (scannerRef.current) {
        stopScanning().then(() => {
          scannerRef.current?.clear();
          scannerRef.current = null;
        });
      }
    };
  }, [isActive, isScanning, stopScanning]);

  if (!isMounted) {
    return (
      <div className={cn('relative w-full aspect-square bg-black/90 rounded-2xl overflow-hidden', className)}>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className={cn('relative w-full aspect-square bg-black rounded-2xl overflow-hidden', className)}>
      {/* Scanner container */}
      <div id={elementId.current} className="absolute inset-0 [&_video]:w-full [&_video]:h-full [&_video]:object-cover" />

      {/* Scanning overlay frame */}
      {isScanning && (
        <div className="absolute inset-0 pointer-events-none">
          {/* Dark overlay with cutout */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/40" />

          {/* Scanning frame */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72">
            {/* Corner brackets with glow */}
            <div className="absolute top-0 left-0 w-16 h-16 border-t-4 border-l-4 border-primary rounded-tl-2xl shadow-[0_0_20px_rgba(var(--primary-rgb),0.5)]" />
            <div className="absolute top-0 right-0 w-16 h-16 border-t-4 border-r-4 border-primary rounded-tr-2xl shadow-[0_0_20px_rgba(var(--primary-rgb),0.5)]" />
            <div className="absolute bottom-0 left-0 w-16 h-16 border-b-4 border-l-4 border-primary rounded-bl-2xl shadow-[0_0_20px_rgba(var(--primary-rgb),0.5)]" />
            <div className="absolute bottom-0 right-0 w-16 h-16 border-b-4 border-r-4 border-primary rounded-br-2xl shadow-[0_0_20px_rgba(var(--primary-rgb),0.5)]" />

            {/* Scanning line */}
            <div className="absolute inset-x-4 top-4 bottom-4 overflow-hidden">
              <div className="w-full h-1 bg-gradient-to-r from-transparent via-primary to-transparent animate-scan shadow-[0_0_15px_rgba(var(--primary-rgb),0.8)]" />
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

      {/* Controls */}
      {isScanning && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2">
          {hasTorch && (
            <Button
              variant={torchOn ? 'default' : 'secondary'}
              size="icon"
              onClick={toggleTorch}
              className="rounded-full w-12 h-12 backdrop-blur-sm"
            >
              {torchOn ? <FlashlightOff className="w-5 h-5" /> : <Flashlight className="w-5 h-5" />}
            </Button>
          )}

          {cameras.length > 1 && (
            <Button
              variant="secondary"
              size="icon"
              onClick={switchCamera}
              className="rounded-full w-12 h-12 backdrop-blur-sm"
            >
              <SwitchCamera className="w-5 h-5" />
            </Button>
          )}
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
  );
}
