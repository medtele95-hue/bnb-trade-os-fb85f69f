import * as React from "react";
import { cn } from "@/lib/utils";

export function Panel({
  title,
  right,
  className,
  bodyClassName,
  children,
}: {
  title?: React.ReactNode;
  right?: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className={cn("panel flex flex-col", className)}>
      {title && (
        <div className="panel-title">
          <span>{title}</span>
          {right && <span className="opacity-80 normal-case tracking-normal">{right}</span>}
        </div>
      )}
      <div className={cn("p-2 text-[11px] leading-tight flex-1", bodyClassName)}>{children}</div>
    </div>
  );
}

export function KV({ k, v, accent }: { k: string; v: React.ReactNode; accent?: "profit" | "loss" }) {
  return (
    <div className="flex items-baseline justify-between gap-2 border-b border-dashed border-black/30 py-0.5">
      <span className="uppercase tracking-wider text-[10px] opacity-70">{k}</span>
      <span
        className={cn(
          "pixel text-[12px]",
          accent === "profit" && "text-profit",
          accent === "loss" && "text-loss",
        )}
      >
        {v}
      </span>
    </div>
  );
}
