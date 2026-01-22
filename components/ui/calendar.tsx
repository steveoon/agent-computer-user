"use client";

import * as React from "react";
import { DayPicker } from "react-day-picker";
import { zhCN } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

export type CalendarProps = React.ComponentProps<typeof DayPicker> & {
  /** IANA 时区标识符，如 "Asia/Shanghai" */
  timeZone?: string;
};

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  timeZone,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      locale={zhCN}
      showOutsideDays={showOutsideDays}
      timeZone={timeZone}
      className={cn("p-4", className)}
      classNames={{
        months: "flex flex-col sm:flex-row gap-6",
        month: "flex flex-col gap-4",
        month_caption:
          "flex justify-center pt-1 pb-2 relative items-center w-full",
        caption_label: "text-base font-semibold",
        nav: "flex items-center gap-1",
        button_previous: cn(
          buttonVariants({ variant: "outline" }),
          "absolute left-1 top-1 size-7 bg-transparent p-0 opacity-60 hover:opacity-100 hover:bg-accent transition-colors"
        ),
        button_next: cn(
          buttonVariants({ variant: "outline" }),
          "absolute right-1 top-1 size-7 bg-transparent p-0 opacity-60 hover:opacity-100 hover:bg-accent transition-colors"
        ),
        month_grid: "w-full border-collapse",
        weekdays: "flex border-b border-border/50 pb-2 mb-1",
        weekday:
          "text-muted-foreground rounded-md w-9 font-medium text-xs uppercase",
        week: "flex w-full mt-1",
        day: "relative p-0 text-center text-sm focus-within:relative focus-within:z-20",
        day_button: cn(
          buttonVariants({ variant: "ghost" }),
          "size-9 p-0 font-normal aria-selected:opacity-100 hover:bg-accent/80 transition-colors rounded-md"
        ),
        range_start:
          "day-range-start bg-primary/15 rounded-l-md aria-selected:bg-primary aria-selected:text-primary-foreground",
        range_end:
          "day-range-end bg-primary/15 rounded-r-md aria-selected:bg-primary aria-selected:text-primary-foreground",
        selected:
          "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground rounded-md",
        today: "bg-muted font-semibold",
        outside:
          "day-outside text-muted-foreground/50 aria-selected:bg-primary/10 aria-selected:text-muted-foreground/70",
        disabled: "text-muted-foreground/40 cursor-not-allowed",
        range_middle:
          "bg-primary/15 rounded-none aria-selected:bg-primary/15 aria-selected:text-foreground",
        hidden: "invisible",
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation }) => {
          const Icon = orientation === "left" ? ChevronLeft : ChevronRight;
          return <Icon className="size-4" aria-hidden="true" />;
        },
      }}
      {...props}
    />
  );
}
Calendar.displayName = "Calendar";

export { Calendar };
