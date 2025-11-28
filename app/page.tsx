import ChatPageWrapper from "./chat-page-wrapper";

export default function Page() {
  return (
    <main className="relative w-full h-dvh overflow-hidden bg-background/50">
      {/* 背景光斑效果 */}
      <div className="bg-blob bg-blob-1" />
      <div className="bg-blob bg-blob-2" />
      <div className="bg-blob bg-blob-3" />

      {/* 主内容区域 - 使用 z-10 确保在背景之上 */}
      <div className="relative z-10 w-full h-full">
        <ChatPageWrapper />
      </div>
    </main>
  );
}
