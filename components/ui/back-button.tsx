"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ButtonProps = React.ComponentProps<typeof Button>;

interface BackButtonProps extends ButtonProps {
  href?: string;
}

export const BackButton = React.forwardRef<HTMLButtonElement, BackButtonProps>(
  ({ className, variant = "ghost", size = "icon", href, onClick, children, ...props }, ref) => {
    const router = useRouter();

    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      if (onClick) {
        onClick(e);
        return;
      }

      if (href) {
        router.push(href);
      } else {
        router.back();
      }
    };

    return (
      <Button
        ref={ref}
        variant={variant}
        size={size}
        className={cn(
          "rounded-full bg-white/40 hover:bg-white/60 backdrop-blur-sm shadow-sm transition-all duration-200",
          className
        )}
        onClick={handleClick}
        {...props}
      >
        <ArrowLeft className={cn(size === "sm" ? "h-4 w-4" : "h-5 w-5", children && "mr-2")} />
        {children}
      </Button>
    );
  }
);
BackButton.displayName = "BackButton";
