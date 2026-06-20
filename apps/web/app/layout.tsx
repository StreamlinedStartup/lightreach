import { Inter, Geist_Mono } from "next/font/google"
import { Toaster } from "@workspace/ui/components/sonner"
import { cookies } from "next/headers"

import "@workspace/ui/globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { cn } from "@workspace/ui/lib/utils"

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" })

const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
})

export const metadata = {
  title: {
    default: "Lightreach",
    template: "%s · Lightreach",
  },
  description:
    "Free, self-hosted cold-email outreach platform. Send from your own SMTP mailboxes.",
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const cookieStore = await cookies()
  const theme = cookieStore.get("theme")?.value === "light" ? "light" : "dark"

  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn("antialiased", theme, fontMono.variable, inter.variable)}
    >
      <body className="font-sans">
        <ThemeProvider>
          {children}
          <Toaster richColors position="bottom-right" />
        </ThemeProvider>
      </body>
    </html>
  )
}
