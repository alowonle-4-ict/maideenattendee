"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  LayoutDashboard,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";

import { Logo } from "@/components/brand/logo";
import { ICONS } from "@/components/dashboard/icons";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { NavGroup } from "@/lib/navigation";
import { cn } from "@/lib/utils";

function isActive(pathname: string, href: string, exact?: boolean) {
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SidebarNav({
  groups,
  collapsed,
  onNavigate,
  onToggle,
}: {
  groups: NavGroup[];
  collapsed: boolean;
  onNavigate?: () => void;
  onToggle?: () => void;
}) {
  const pathname = usePathname();

  return (
    <div className="flex h-full flex-col">
      <div
        className={cn(
          "flex h-16 shrink-0 items-center border-b px-4",
          collapsed ? "justify-center px-2" : "justify-between"
        )}
      >
        <Logo compact={collapsed} />
        {!collapsed && (
          <Button
            variant="ghost"
            size="icon-sm"
            className="hidden lg:inline-flex"
            onClick={onToggle}
            aria-label="Collapse sidebar"
          >
            <PanelLeftClose className="h-4 w-4" />
          </Button>
        )}
      </div>

      <nav className="scrollbar-thin flex-1 space-y-5 overflow-y-auto px-2 py-4">
        {groups.map((group, groupIndex) => (
          <div key={group.title ?? groupIndex}>
            {group.title && !collapsed && (
              <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                {group.title}
              </p>
            )}
            {group.title && collapsed && <div className="mx-auto mb-2 h-px w-6 bg-border" />}
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = ICONS[item.icon] ?? LayoutDashboard;
                const active = isActive(pathname, item.href, item.exact);
                const link = (
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    className={cn(
                      "group flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                      collapsed && "justify-center px-2",
                      active
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {!collapsed && <span className="truncate">{item.label}</span>}
                  </Link>
                );

                if (!collapsed) return <li key={item.href}>{link}</li>;

                return (
                  <li key={item.href}>
                    <Tooltip>
                      <TooltipTrigger asChild>{link}</TooltipTrigger>
                      <TooltipContent side="right">{item.label}</TooltipContent>
                    </Tooltip>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t p-3">
        {collapsed ? (
          <Button
            variant="ghost"
            size="icon"
            className="mx-auto flex"
            onClick={onToggle}
            aria-label="Expand sidebar"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        ) : (
          <div className="flex items-center justify-between rounded-lg bg-muted/60 px-3 py-2 text-[11px] text-muted-foreground">
            <span>MaideenAttendee v1.0</span>
            <button
              onClick={onToggle}
              className="rounded p-1 hover:bg-background hover:text-foreground"
              aria-label="Collapse sidebar"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
