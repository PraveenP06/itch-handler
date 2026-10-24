import type { Metadata } from "next"
import { Bricolage_Grotesque, DM_Mono, DM_Sans } from "next/font/google"
import { SiteHeader } from "@/components/site-header"
import { ThemeProvider } from "@/components/theme-provider"
import { TooltipProvider } from "@/components/ui/tooltip"
import "./globals.css"

const display = Bricolage_Grotesque({ variable: "--font-display", subsets: ["latin"] })
const body = DM_Sans({ variable: "--font-body", subsets: ["latin"] })
const numeric = DM_Mono({ variable: "--font-numeric", subsets: ["latin"], weight: ["400", "500"] })

export const metadata: Metadata = {
  title: "Book Lab",
  description:
    "A C++ order book engine, replayed on a real NASDAQ ITCH trading day and running live on Bitcoin.",
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" suppressHydrationWarning className={`${display.variable} ${body.variable} ${numeric.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-background text-foreground">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <TooltipProvider>
            <div aria-hidden className="app-glow" />
            <SiteHeader />
            <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
