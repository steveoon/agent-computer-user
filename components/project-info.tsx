import { motion } from "motion/react";
import Image from "next/image";

export const ProjectInfo = () => {
  return (
    <motion.div className="w-full px-4">
      <div className="rounded-lg bg-white/40 backdrop-blur-md p-6 flex flex-col gap-4 text-center text-base dark:text-zinc-400 shadow-sm">
        <div className="flex flex-row justify-center items-center">
          <div className="relative h-12 w-60">
            <Image
              src="/light_1x-removebg.png"
              alt="花卷智能助手 Huajune"
              fill
              className="object-contain dark:hidden"
              priority
            />
            <Image
              src="/dark_1x-removebg.png"
              alt="花卷智能助手 Huajune"
              fill
              className="object-contain hidden dark:block"
              priority
            />
          </div>
        </div>
        <p>
          花卷智能体（Huajune Agent）能够自动操控沙盒环境，并为您自动回复 BOSS 直聘上的招聘消息。
          <br />
          如果需要在沙盒环境中正常显示中文，请在初始化沙盒后，先让智能体安装中文字体（如{" "}
          <code>fonts-noto-cjk</code> 或 <code>fonts-noto</code>）。
        </p>
      </div>
    </motion.div>
  );
};
