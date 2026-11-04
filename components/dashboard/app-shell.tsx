"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Bell,
  Check,
  Command,
  LogOut,
  Menu,
  Moon,
  Search,
  Sun,
  UserCog,
  X,
} from "lucide-react";
import { useTheme } from "next-themes";

import { ICONS } from "@/components/dashboard/icons";
import { SidebarNav } from "@/components/dashboard/sidebar-nav";
import { ThemeToggle } from "@/components/theme-toggle";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { createClient } from "@/lib/supabase/client";
import type { NavGroup } from "@/lib/navigation";
import type { AppRole } from "@/lib/types";
import { cn, initials, relativeTime } from "@/lib/utils";

type NotificationRow = {
  id: string;
  title: string;
  body: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
};

export function AppShell({
  role,
  roleLabel,
  user,
  institutionName,
  institutionLogoUrl,
  groups,
  profileHref,
  children,
}: {
  role: AppRole;
  roleLabel: string;
  user: { fullName: string; email: string; avatarUrl?: string | null };
  institutionName?: string | null;
  institutionLogoUrl?: string | null;
  groups: NavGroup[];
  profileHref: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [collapsed, setCollapsed] = React.useState(false);
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [searchOpen, setSearchOpen] = React.useState(false);

  React.useEffect(() => {
    const stored = window.localStorage.getItem("maideen.sidebar.collapsed");
    if (stored === "1") setCollapsed(true);
  }, []);

  React.useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen((value) => !value);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  function toggleCollapsed() {
    setCollapsed((value) => {
      window.localStorage.setItem("maideen.sidebar.collapsed", value ? "0" : "1");
      return !value;
    });
  }

  return (
    <TooltipProvider delayDuration={200}>
      <div className="min-h-screen bg-muted/20">
        {/* Desktop sidebar */}
        <aside
          className={cn(
            "fixed inset-y-0 left-0 z-30 hidden border-r bg-background transition-[width] duration-200 lg:block",
            collapsed ? "w-[72px]" : "w-[264px]"
          )}
        >
          <SidebarNav groups={groups} collapsed={collapsed} onToggle={toggleCollapsed} />
        </aside>

        {/* Mobile drawer */}
        {mobileOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div
              className="absolute inset-0 bg-black/50 backdrop-blur-[1px]"
              onClick={() => setMobileOpen(false)}
              aria-hidden
            />
            <div className="absolute inset-y-0 left-0 w-[280px] border-r bg-background shadow-xl">
              <div className="absolute right-3 top-4 z-10">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setMobileOpen(false)}
                  aria-label="Close navigation"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <SidebarNav
                groups={groups}
                collapsed={false}
                onNavigate={() => setMobileOpen(false)}
              />
            </div>
          </div>
        )}

        <div
          className={cn(
            "flex min-h-screen flex-col transition-[padding] duration-200",
            collapsed ? "lg:pl-[72px]" : "lg:pl-[264px]"
          )}
        >
          <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center gap-3 border-b bg-background/85 px-4 backdrop-blur sm:px-6">
            <Button
              variant="ghost"
              size="icon-sm"
              className="lg:hidden"
              onClick={() => setMobileOpen(true)}
              aria-label="Open navigation"
            >
              <Menu className="h-5 w-5" />
            </Button>

            <div className="flex min-w-0 flex-1 items-center gap-2.5">
              {institutionLogoUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={institutionLogoUrl}
                  alt={`${institutionName ?? "Institution"} logo`}
                  className="h-9 w-9 shrink-0 rounded-lg border bg-white object-contain p-1"
                />
              )}
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">
                  {institutionName ?? "Platform administration"}
                </p>
                <p className="truncate text-[11px] text-muted-foreground">{roleLabel}</p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="hidden h-9 w-56 items-center gap-2 rounded-lg border bg-background px-3 text-sm text-muted-foreground shadow-sm transition-colors hover:border-ring/40 hover:text-foreground md:flex"
            >
              <Search className="h-4 w-4" />
              <span className="flex-1 text-left">Search…</span>
              <kbd className="rounded border bg-muted px-1.5 py-0.5 text-[10px] font-medium">
                ⌘K
              </kbd>
            </button>
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setSearchOpen(true)}
              aria-label="Search"
            >
              <Search className="h-4 w-4" />
            </Button>

            <NotificationsMenu notificationsHref={role === "student" ? "/student/notifications" : profileHref} />
            <ThemeToggle />
            <UserMenu
              name={user.fullName}
              email={user.email}
              avatarUrl={user.avatarUrl}
              roleLabel={roleLabel}
              profileHref={profileHref}
              theme={theme}
              setTheme={setTheme}
            />
          </header>

          <main className="flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
        </div>

        <CommandMenu
          open={searchOpen}
          onOpenChange={setSearchOpen}
          groups={groups}
          onNavigate={(href) => {
            setSearchOpen(false);
            router.push(href);
          }}
        />
      </div>
    </TooltipProvider>
  );
}

function NotificationsMenu({ notificationsHref }: { notificationsHref: string }) {
  const [items, setItems] = React.useState<NotificationRow[]>([]);
  const [loading, setLoading] = React.useState(false);
  const unread = items.filter((item) => !item.read_at).length;

  async function load() {
    setLoading(true);
    try {
      const supabase = createClient();
      const { data } = await supabase
        .from("notifications")
        .select("id, title, body, link, read_at, created_at")
        .order("created_at", { ascending: false })
        .limit(8);
      setItems((data as NotificationRow[] | null) ?? []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  async function markAllRead() {
    const supabase = createClient();
    await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .is("read_at", null);
    setItems((current) =>
      current.map((item) => ({ ...item, read_at: item.read_at ?? new Date().toISOString() }))
    );
  }

  return (
    <DropdownMenu onOpenChange={(open) => open && load()}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
          <Bell className="h-4 w-4" />
          {unread > 0 && (
            <span className="absolute right-1.5 top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-destructive px-1 text-[9px] font-bold text-destructive-foreground">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b px-3 py-2.5">
          <DropdownMenuLabel className="p-0 text-sm text-foreground">
            Notifications
          </DropdownMenuLabel>
          {unread > 0 && (
            <button
              onClick={markAllRead}
              className="inline-flex items-center gap-1 text-[11px] font-medium text-brand-600 hover:underline dark:text-brand-400"
            >
              <Check className="h-3 w-3" /> Mark all read
            </button>
          )}
        </div>
        <div className="max-h-80 overflow-y-auto">
          {loading && (
            <p className="px-4 py-8 text-center text-xs text-muted-foreground">Loading…</p>
          )}
          {!loading && items.length === 0 && (
            <div className="px-4 py-10 text-center">
              <Bell className="mx-auto h-6 w-6 text-muted-foreground/50" />
              <p className="mt-2 text-xs text-muted-foreground">
                You&apos;re all caught up.
              </p>
            </div>
          )}
          {items.map((item) => (
            <DropdownMenuItem key={item.id} asChild className="items-start gap-3 rounded-none border-b px-3 py-2.5 last:border-b-0">
              <Link href={item.link ?? "#"}>
                <span
                  className={cn(
                    "mt-1 h-1.5 w-1.5 shrink-0 rounded-full",
                    item.read_at ? "bg-border" : "bg-brand-500"
                  )}
                />
                <span className="min-w-0">
                  <span className="block truncate text-xs font-semibold">{item.title}</span>
                  {item.body && (
                    <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
                      {item.body}
                    </span>
                  )}
                  <span className="mt-1 block text-[10px] text-muted-foreground">
                    {relativeTime(item.created_at)}
                  </span>
                </span>
              </Link>
            </DropdownMenuItem>
          ))}
        </div>
        <div className="border-t p-1.5">
          <DropdownMenuItem asChild className="justify-center text-xs">
            <Link href={notificationsHref} className="w-full justify-center">
              View notifications
            </Link>
          </DropdownMenuItem>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function UserMenu({
  name,
  email,
  avatarUrl,
  roleLabel,
  profileHref,
  theme,
  setTheme,
}: {
  name: string;
  email: string;
  avatarUrl?: string | null;
  roleLabel: string;
  profileHref: string;
  theme?: string;
  setTheme: (value: string) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="rounded-full outline-none ring-offset-2 focus-visible:ring-2 focus-visible:ring-ring">
          <Avatar className="h-8 w-8 border">
            {avatarUrl ? <AvatarImage src={avatarUrl} alt={name} /> : null}
            <AvatarFallback>{initials(name)}</AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <div className="px-2 py-2">
          <p className="truncate text-sm font-semibold">{name}</p>
          <p className="truncate text-xs text-muted-foreground">{email}</p>
          <Badge variant="secondary" className="mt-2">{roleLabel}</Badge>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href={profileHref}>
            <UserCog /> Profile settings
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Theme</DropdownMenuLabel>
        <DropdownMenuItem onClick={() => setTheme("light")}>
          <Sun /> Light {theme === "light" && <Check className="ml-auto" />}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("dark")}>
          <Moon /> Dark {theme === "dark" && <Check className="ml-auto" />}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <form action="/auth/signout" method="post">
          <button
            type="submit"
            className="relative flex w-full cursor-pointer select-none items-center gap-2 rounded-md px-2 py-1.5 text-sm text-destructive outline-none transition-colors hover:bg-destructive/10"
          >
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function CommandMenu({
  open,
  onOpenChange,
  groups,
  onNavigate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groups: NavGroup[];
  onNavigate: (href: string) => void;
}) {
  const [query, setQuery] = React.useState("");
  const items = React.useMemo(
    () =>
      groups.flatMap((group) =>
        group.items.map((item) => ({ ...item, group: group.title ?? "Navigation" }))
      ),
    [groups]
  );
  const filtered = items.filter((item) =>
    `${item.label} ${item.group}`.toLowerCase().includes(query.toLowerCase())
  );

  React.useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg gap-0 overflow-hidden p-0">
        <DialogHeader className="sr-only">
          <DialogTitle>Search navigation</DialogTitle>
          <DialogDescription>Jump to any page in your workspace.</DialogDescription>
        </DialogHeader>
        <div className="flex items-center gap-2 border-b px-4">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search pages and actions…"
            className="h-12 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          <kbd className="rounded border bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
            ESC
          </kbd>
        </div>
        <div className="max-h-80 overflow-y-auto p-2">
          {filtered.length === 0 && (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">
              No matching pages.
            </p>
          )}
          {filtered.map((item) => {
            const Icon = ICONS[item.icon] ?? Command;
            return (
              <button
                key={item.href}
                onClick={() => onNavigate(item.href)}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm hover:bg-accent"
              >
                <Icon className="h-4 w-4 text-muted-foreground" />
                <span className="flex-1">{item.label}</span>
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  {item.group}
                </span>
              </button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
