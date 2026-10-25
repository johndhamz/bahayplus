"use client";

import { BellRing, CircleUser, LogOut, UserCog } from "lucide-react";
import Link from "next/link";
import { Button } from "@bahayplus/ui/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@bahayplus/ui/components/ui/dropdown-menu";
import { signOutAction } from "@/lib/actions/identity";

export type PortalLink = { href: string; label: string };

type UserMenuProps = {
  displayName: string;
  email: string | null;
  /** Other portals this user can access (from their memberships). */
  portals?: PortalLink[];
};

export function UserMenu({ displayName, email, portals = [] }: UserMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Account menu">
          <CircleUser aria-hidden="true" className="size-6" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="flex flex-col">
          <span className="truncate font-semibold">{displayName}</span>
          {email && <span className="truncate text-xs font-normal text-muted-foreground">{email}</span>}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/account">
            <UserCog aria-hidden="true" />
            Profile & security
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/account/notifications/settings">
            <BellRing aria-hidden="true" />
            Notification settings
          </Link>
        </DropdownMenuItem>
        {portals.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs text-muted-foreground">Switch portal</DropdownMenuLabel>
            {portals.map((p) => (
              <DropdownMenuItem key={p.href} asChild>
                <Link href={p.href}>{p.label}</Link>
              </DropdownMenuItem>
            ))}
          </>
        )}
        <DropdownMenuSeparator />
        <form action={signOutAction}>
          <DropdownMenuItem asChild>
            <button type="submit" className="w-full">
              <LogOut aria-hidden="true" />
              Sign out
            </button>
          </DropdownMenuItem>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
