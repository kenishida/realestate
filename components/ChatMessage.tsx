"use client";

interface ChatMessageProps {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp?: Date;
}

/** 長文を読みやすくするため、句点の後に改行を挿入（既に改行が多い場合は触らない） */
function formatContentWithLineBreaks(text: string): string {
  const hasEnoughLineBreaks = (text.match(/\n/g)?.length ?? 0) >= 2;
  if (hasEnoughLineBreaks) return text;
  // 全角句点「。」の直後が改行でない場合に改行を挿入
  return text.replace(/。(?=[^\n])/g, "。\n");
}

export default function ChatMessage({ role, content, timestamp }: ChatMessageProps) {
  const isUser = role === "user";
  const isSystem = role === "system";

  if (isSystem) {
    return (
      <div className="flex justify-center py-2">
        <span className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-600">
          {content}
        </span>
      </div>
    );
  }

  const displayContent = formatContentWithLineBreaks(content);

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} mb-4`}>
      <div
        className={`max-w-[80%] rounded-lg px-4 py-3 ${
          isUser
            ? "bg-blue-600 text-white"
            : "bg-gray-100 text-gray-900"
        }`}
      >
        <div className="whitespace-pre-wrap break-words text-sm">{displayContent}</div>
        {timestamp && (
          <div
            className={`mt-1 text-xs ${
              isUser ? "text-blue-100" : "text-gray-500"
            }`}
          >
            {timestamp.toLocaleTimeString("ja-JP", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </div>
        )}
      </div>
    </div>
  );
}
