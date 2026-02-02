"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth-context";

type Mode = "login" | "signup";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** ログイン成功時に親で何かする場合（モーダルは onAuthStateChange で閉じる想定） */
  onSuccess?: () => void;
  /** モーダル上部に表示する説明（例: 投資判断を見るにはログインが必要です） */
  message?: string;
}

export default function AuthModal({ isOpen, onClose, onSuccess, message }: AuthModalProps) {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const resetForm = () => {
    setEmail("");
    setPassword("");
    setError(null);
    setSuccessMessage(null);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);
    setIsSubmitting(true);

    try {
      if (mode === "login") {
        const { error: err } = await signIn(email, password);
        if (err) {
          setError(err.message || "ログインに失敗しました");
          return;
        }
        onSuccess?.();
        handleClose();
      } else {
        const { error: err } = await signUp(email, password);
        if (err) {
          setError(err.message || "新規登録に失敗しました");
          return;
        }
        setSuccessMessage("確認メールを送信しました。メール内のリンクから認証を完了してください。");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={handleClose}>
      <div
        className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">
            {mode === "login" ? "ログイン" : "新規登録"}
          </h2>
          <button
            type="button"
            onClick={handleClose}
            className="rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
            aria-label="閉じる"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {message && (
          <p className="mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800 border border-amber-200">
            {message}
          </p>
        )}

        {successMessage && (
          <p className="mb-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800 border border-emerald-200">
            {successMessage}
          </p>
        )}

        <div className="mb-4 flex rounded-lg border border-gray-200 bg-gray-50 p-1">
          <button
            type="button"
            onClick={() => { setMode("login"); resetForm(); }}
            className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors ${
              mode === "login" ? "bg-white text-gray-900 shadow" : "text-gray-600 hover:text-gray-900"
            }`}
          >
            ログイン
          </button>
          <button
            type="button"
            onClick={() => { setMode("signup"); resetForm(); }}
            className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors ${
              mode === "signup" ? "bg-white text-gray-900 shadow" : "text-gray-600 hover:text-gray-900"
            }`}
          >
            新規登録
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="auth-email" className="mb-1 block text-sm font-medium text-gray-700">
              メールアドレス
            </label>
            <input
              id="auth-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:border-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500"
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label htmlFor="auth-password" className="mb-1 block text-sm font-medium text-gray-700">
              パスワード
            </label>
            <input
              id="auth-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:border-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500"
              placeholder="6文字以上"
            />
          </div>
          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
            >
              {isSubmitting ? "送信中..." : mode === "login" ? "ログイン" : "登録する"}
            </button>
            <button
              type="button"
              onClick={handleClose}
              className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              キャンセル
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
