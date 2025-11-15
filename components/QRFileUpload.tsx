'use client';

import { useRef, useState } from 'react';
import { BrowserQRCodeReader } from '@zxing/browser';
import { BarcodeFormat, DecodeHintType } from '@zxing/library';

interface QRFileUploadProps {
  onScan: (data: string) => void;
}

export default function QRFileUpload({ onScan }: QRFileUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string>('');
  const [preview, setPreview] = useState<string>('');

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Проверка типа файла
    if (!file.type.startsWith('image/')) {
      setError('Пожалуйста, загрузите изображение');
      return;
    }

    setIsProcessing(true);
    setError('');

    try {
      // Создаем preview
      const reader = new FileReader();
      reader.onload = (event) => {
        setPreview(event.target?.result as string);
      };
      reader.readAsDataURL(file);

      // Сканируем QR код с оптимизацией
      const hints = new Map();
      hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.QR_CODE]);
      hints.set(DecodeHintType.TRY_HARDER, false);

      const codeReader = new BrowserQRCodeReader(hints);
      const imageUrl = URL.createObjectURL(file);

      try {
        const result = await codeReader.decodeFromImageUrl(imageUrl);

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
      } finally {
        URL.revokeObjectURL(imageUrl);
      }
    } catch (err: any) {
      console.error('Ошибка сканирования файла:', err);
      setError('QR код не найден. Попробуйте другое изображение.');
    } finally {
      setIsProcessing(false);
      // Очищаем input для возможности загрузить тот же файл снова
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="w-full max-w-lg mx-auto space-y-4">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />

      <div
        onClick={handleClick}
        className={`
          relative overflow-hidden
          border-2 border-dashed border-slate-700 rounded-xl
          bg-slate-800/30 hover:bg-slate-800/50
          p-8 cursor-pointer transition-all duration-300
          ${isProcessing ? 'cursor-wait opacity-75' : 'hover:border-blue-500'}
        `}
      >
        <div className="flex flex-col items-center justify-center gap-4">
          {isProcessing ? (
            <>
              <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-lg font-medium text-slate-300">Обработка изображения...</p>
            </>
          ) : (
            <>
              <div className="w-16 h-16 rounded-full bg-blue-500/20 flex items-center justify-center">
                <svg className="w-8 h-8 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>
              <div className="text-center">
                <p className="text-lg font-semibold text-slate-200 mb-1">
                  Загрузить QR код из файла
                </p>
                <p className="text-sm text-slate-400">
                  Нажмите или перетащите изображение сюда
                </p>
              </div>
            </>
          )}
        </div>
      </div>

      {preview && (
        <div className="rounded-lg overflow-hidden border-2 border-blue-500/30 bg-slate-800/30 p-2">
          <img
            src={preview}
            alt="Preview"
            className="w-full h-auto max-h-64 object-contain rounded"
          />
        </div>
      )}

      {error && (
        <div className="bg-red-950/50 border border-red-500/50 rounded-lg p-4">
          <p className="text-red-400 text-sm text-center">{error}</p>
        </div>
      )}

      <p className="text-xs text-slate-500 text-center">
        Поддерживаются форматы: JPG, PNG, GIF, WEBP
      </p>
    </div>
  );
}
