"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "@workspace/ui/components/sidebar"
import {
  IconMail,
  IconUsers,
  IconTemplate,
  IconSend,
  IconSettings,
  IconLayoutDashboard,
  IconBolt,
  IconInbox,
  IconMailbox,
} from "@tabler/icons-react"

const navItems = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: IconLayoutDashboard,
  },
]

const featureItems = [
  {
    label: "Connections",
    href: "/connections",
    icon: IconMail,
  },
  {
    label: "Leads",
    href: "/leads",
    icon: IconUsers,
  },
  {
    label: "Sequences",
    href: "/sequences",
    icon: IconTemplate,
  },
  {
    label: "Campaigns",
    href: "/campaigns",
    icon: IconSend,
  },
  {
    label: "Emails",
    href: "/emails",
    icon: IconInbox,
  },
  {
    label: "Inbox",
    href: "/inbox",
    icon: IconMailbox,
  },
]

export function AppSidebar() {
  const pathname = usePathname()

  const isActive = (href: string) => {
    if (href === "/dashboard") return pathname === "/dashboard"
    return pathname.startsWith(href)
  }

  return (
    <Sidebar>
      {/* Logo / brand */}
      <SidebarHeader className="border-b px-4 py-4">
        <Link href="/dashboard" className="flex items-center gap-2.5">
          <div className="bg-primary flex size-7 items-center justify-center rounded-md">
            <IconBolt className="size-4 text-white" />
          </div>
          <span className="text-sm font-semibold tracking-tight">Lightreach</span>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        {/* Main nav */}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(item.href)}
                  >
                    <Link href={item.href}>
                      <item.icon className="size-4" />
                      {item.label}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator />

        {/* Features */}
        <SidebarGroup>
          <SidebarGroupLabel>Outreach</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {featureItems.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(item.href)}
                  >
                    <Link href={item.href}>
                      <item.icon className="size-4" />
                      {item.label}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* Footer */}
      <SidebarFooter className="border-t">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild isActive={isActive("/settings")}>
              <Link href="/settings">
                <IconSettings className="size-4" />
                Settings
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
