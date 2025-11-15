'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';

interface ManualInputProps {
  onSubmit: (ticketNumber: string) => void;
  isProcessing: boolean;
}

export default function ManualInput({ onSubmit, isProcessing }: ManualInputProps) {
  const [ticketNumber, setTicketNumber] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (ticketNumber.trim()) {
      onSubmit(ticketNumber.trim());
      setTicketNumber('');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-lg mx-auto space-y-6">
      <div className="space-y-3">
        <label
          htmlFor="ticket-number"
          className="block text-sm font-semibold text-slate-300"
        >
          Номер билета
        </label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
            </svg>
          </div>
          <input
            id="ticket-number"
            type="text"
            value={ticketNumber}
            onChange={(e) => setTicketNumber(e.target.value)}
            placeholder="VOEV-203-I-16-1760711329863-5"
            className="
              w-full pl-12 pr-4 py-4
              text-base font-mono
              bg-slate-800/50 border-2 border-slate-700
              rounded-xl
              text-slate-200 placeholder-slate-500
              focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20
              transition-all duration-200
              disabled:opacity-50 disabled:cursor-not-allowed
            "
            disabled={isProcessing}
            autoComplete="off"
          />
        </div>
      </div>

      <Button
        type="submit"
        disabled={!ticketNumber.trim() || isProcessing}
        className="w-full h-14 text-lg font-semibold bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
      >
        {isProcessing ? (
          <>
            <div className="w-5 h-5 border-3 border-white border-t-transparent rounded-full animate-spin mr-2" />
            Проверка...
          </>
        ) : (
          <>
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Проверить билет
          </>
        )}
      </Button>

      <p className="text-xs text-slate-500 text-center">
        Введите номер билета вручную, если не работает сканер
      </p>
    </form>
  );
}
