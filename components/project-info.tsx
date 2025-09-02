import { motion } from "motion/react";
import { VercelIcon } from "./icons";
import { ComputerIcon } from "lucide-react";
import Link from "next/link";

export const ProjectInfo = () => {
  return (
    <motion.div className="w-full px-4">
      <div className="rounded-lg border-border border p-6 flex flex-col gap-4 text-center text-base dark:text-zinc-400">
        <p className="flex flex-row justify-center gap-4 items-center text-zinc-900 dark:text-zinc-50">
          <VercelIcon size={16} />
          <span>+</span>
          <ComputerIcon />
        </p>
        <h3 className="text-center text-2xl font-bold">Computer Use Agent</h3>
        <p>
          该智能体（Agent）能够自动操控沙盒环境，并为您自动回复 Boss 直聘上的招聘消息。
          <br />
          如果需要在沙盒环境中正常显示中文，请在初始化沙盒后，先让 Agent 安装中文字体（如{" "}
          <code>fonts-noto-cjk</code> 或 <code>fonts-noto</code>）。
        </p>
      </div>
    </motion.div>
  );
};

// const StyledLink = ({
//   children,
//   href,
// }: {
//   children: React.ReactNode;
//   href: string;
// }) => {
//   return (
//     <Link
//       className="text-blue-500 dark:text-blue-400"
//       href={href}
//       target="_blank"
//     >
//       {children}
//     </Link>
//   );
// };

// const Code = ({ text }: { text: string }) => {
//   return <code className="">{text}</code>;
// };

export const DeployButton = () => {
  return (
    <Link
      target="_blank"
      href={`https://vercel.com/new/clone?project-name=AI+SDK+Computer+Use+Demo&repository-name=ai-sdk-computer-use&repository-url=https%3A%2F%2Fgithub.com%2Fvercel-labs%2Fai-sdk-computer-use&demo-title=AI+SDK+Computer+Use+Demo&demo-url=https%3A%2F%2Fai-sdk-computer-use.vercel.app%2F&demo-description=A+chatbot+application+built+with+Next.js+demonstrating+Anthropic+Claude+3.7+Sonnet%27s+computer+use+capabilities&env=ANTHROPIC_API_KEY,E2B_API_KEY`}
      className="flex flex-row gap-2 items-center bg-zinc-900 px-3 py-2 rounded-md text-zinc-50 hover:bg-zinc-950 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-50"
    >
      <VercelIcon size={14} />
      Deploy
    </Link>
  );
};
