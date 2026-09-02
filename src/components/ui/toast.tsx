"use client";

import { useEffect, useState } from "react";
import { CheckCircle, X, AlertCircle, Info } from "lucide-react";

export type ToastType = "success" | "error" | "info";

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  toasts: Toast[];
  addToast: (message: string, type?: ToastType) => void;
  removeToast: (id: string) => void;
}

let toastListeners: ((toasts: Toast[]) => void)[] = [];
let toasts: Toast[] = [];

function notifyListeners() {
  toastListeners.forEach((listener) => listener([...toasts]));
}

export function addToast(message: string, type: ToastType = "success") {
  const id = Math.random().toString(36).substring(2, 9);
  toasts = [...toasts, { id, message, type }];
  notifyListeners();

  // Auto remove after 3 seconds
  setTimeout(() => {
    removeToast(id);
  }, 3000);
}

export function removeToast(id: string) {
  toasts = toasts.filter((t) => t.id !== id);
  notifyListeners();
}

export function ToastContainer() {
  const [currentToasts, setCurrentToasts] = useState<Toast[]>([]);

  useEffect(() => {
    const listener = (newToasts: Toast[]) => setCurrentToasts(newToasts);
    toastListeners.push(listener);
    return () => {
      toastListeners = toastListeners.filter((l) => l !== listener);
    };
  }, []);

  if (currentToasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {currentToasts.map((toast) => (
        <div
          key={toast.id}
          className={`flex items-center gap-2 rounded-lg px-4 py-3 shadow-lg transition-all duration-300 animate-slide-in
            ${toast.type === "success" 
              ? "bg-green-600 text-white" 
              : toast.type === "error"
                ? "bg-red-600 text-white"
                : "bg-blue-600 text-white"
            }`}
        >
          {toast.type === "success" && <CheckCircle className="h-4 w-4" />}
          {toast.type === "error" && <AlertCircle className="h-4 w-4" />}
          {toast.type === "info" && <Info className="h-4 w-4" />}
          <span className="text-sm font-medium">{toast.message}</span>
          <button
            onClick={() => removeToast(toast.id)}
            className="ml-2 hover:opacity-80"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
