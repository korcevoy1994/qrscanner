'use client';

import { useEffect, useRef, useState } from 'react';
import { BrowserQRCodeReader } from '@zxing/browser';
import type { IScannerControls } from '@zxing/browser';
import { BarcodeFormat, DecodeHintType } from '@zxing/library';

interface QRScannerProps {
  onScan: (data: string) => void;
  isScanning: boolean;
}

export default function QRScanner({ onScan, isScanning }: QRScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const codeReaderRef = useRef<BrowserQRCodeReader | null>(null);
  const [error, setError] = useState<string>('');
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string>('');
  const hasScannedRef = useRef(false);

  // Получение списка камер
  useEffect(() => {
    const getDevices = async () => {
      try {
        const videoDevices = await BrowserQRCodeReader.listVideoInputDevices();
        setDevices(videoDevices);
        if (videoDevices.length > 0) {
          // Выбираем заднюю камеру если доступна
          const backCamera = videoDevices.find(device =>
            device.label.toLowerCase().includes('back') ||
            device.label.toLowerCase().includes('rear')
          );
          setSelectedDevice(backCamera?.deviceId || videoDevices[0].deviceId);
        }
      } catch (err) {
        console.error('Ошибка получения устройств:', err);
        setError('Не удалось получить список камер');
      }
    };

    getDevices();
  }, []);

  // Управление сканированием
  useEffect(() => {
    if (!isScanning || !videoRef.current || !selectedDevice) {
      // Остановка сканирования
      if (controlsRef.current) {
        controlsRef.current.stop();
        controlsRef.current = null;
      }
      hasScannedRef.current = false;
      return;
    }

    // Запуск сканирования
    const startScanning = async () => {
      try {
        setError('');

        // Настройки для более быстрого сканирования
        const hints = new Map();
        hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.QR_CODE]);
        hints.set(DecodeHintType.TRY_HARDER, false); // Быстрее, но менее точно

        const codeReader = new BrowserQRCodeReader(hints);
        codeReaderRef.current = codeReader;

        // Настройки камеры для лучшего качества и скорости
        const constraints = {
          video: {
            deviceId: selectedDevice,
            facingMode: 'environment',
            width: { ideal: 1920 },
            height: { ideal: 1080 },
            focusMode: 'continuous',
          }
        };

        const controls = await codeReader.decodeFromVideoDevice(
          selectedDevice,
          videoRef.current!,
          (result, _error) => {
            if (result && !hasScannedRef.current) {
              hasScannedRef.current = true;

              try {
                let rawText = result.getText();

                // Попытка распарсить как JSON (может быть дважды закодирован)
                let qrData: any;
                try {
                  qrData = JSON.parse(rawText);
                  // Если результат - строка, парсим еще раз
                  if (typeof qrData === 'string') {
                    qrData = JSON.parse(qrData);
                  }
                } catch {
                  // Если парсинг не удался, используем как текст
                  onScan(rawText);
                  return;
                }

                // Поддержка как snake_case, так и camelCase
                const ticketNumber = qrData.ticket_number || qrData.ticketNumber;
                if (ticketNumber) {
                  onScan(ticketNumber);
                } else {
                  onScan(rawText);
                }
              } catch (error) {
                // Если это не JSON, используем как текст
                onScan(result.getText());
              }
            }
          }
        );

        controlsRef.current = controls;
      } catch (err: any) {
        console.error('Ошибка запуска камеры:', err);
        if (err.name === 'NotAllowedError') {
          setError('Доступ к камере запрещен. Разрешите доступ в настройках браузера.');
        } else if (err.name === 'NotFoundError') {
          setError('Камера не найдена. Проверьте подключение.');
        } else if (err.name === 'NotSupportedError') {
          setError('Камера не поддерживается в этом браузере.');
        } else {
          setError(`Ошибка: ${err.message || 'Не удалось запустить камеру'}`);
        }
      }
    };

    startScanning();

    return () => {
      if (controlsRef.current) {
        controlsRef.current.stop();
        controlsRef.current = null;
      }
    };
  }, [isScanning, selectedDevice, onScan]);

  return (
    <div style={styles.container}>
      {devices.length > 1 && (
        <select
          value={selectedDevice}
          onChange={(e) => setSelectedDevice(e.target.value)}
          style={styles.select}
          disabled={isScanning}
        >
          {devices.map((device) => (
            <option key={device.deviceId} value={device.deviceId}>
              {device.label || `Камера ${device.deviceId.slice(0, 5)}...`}
            </option>
          ))}
        </select>
      )}

      <div style={styles.videoContainer}>
        <video
          ref={videoRef}
          style={styles.video}
          playsInline
          muted
        />
        {!error && isScanning && (
          <div style={styles.overlay}>
            <div style={styles.scanBox} />
          </div>
        )}
      </div>

      {error && (
        <div style={styles.error}>
          <p style={styles.errorText}>{error}</p>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    width: '100%',
    maxWidth: '500px',
    margin: '0 auto',
  },
  select: {
    width: '100%',
    padding: '10px',
    marginBottom: '10px',
    borderRadius: '8px',
    border: '2px solid #e5e7eb',
    fontSize: '14px',
    backgroundColor: 'white',
    cursor: 'pointer',
  } as React.CSSProperties,
  videoContainer: {
    position: 'relative',
    width: '100%',
    aspectRatio: '1',
    backgroundColor: '#000',
    borderRadius: '12px',
    overflow: 'hidden',
  } as React.CSSProperties,
  video: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  } as React.CSSProperties,
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  } as React.CSSProperties,
  scanBox: {
    width: '80%',
    height: '80%',
    maxWidth: '400px',
    maxHeight: '400px',
    border: '3px solid #10b981',
    borderRadius: '12px',
    boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.3)',
    animation: 'pulse 2s ease-in-out infinite',
  } as React.CSSProperties,
  error: {
    marginTop: '15px',
    padding: '15px',
    backgroundColor: '#fee2e2',
    borderRadius: '8px',
    border: '1px solid #ef4444',
  } as React.CSSProperties,
  errorText: {
    color: '#991b1b',
    fontSize: '14px',
    margin: 0,
    textAlign: 'center',
  } as React.CSSProperties,
};
