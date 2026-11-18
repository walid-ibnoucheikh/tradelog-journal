import type { Metadata, Viewport } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import "./globals.css"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

export const metadata: Metadata = {
  description: "NQ / MNQ trade journal",
  // Opened from the iPhone home screen the app has its own name and no Safari bars.
  appleWebApp: { capable: true, title: "Tradelog", statusBarStyle: "default" },
  // Phone numbers in the notes are not links.
  formatDetection: { telephone: false },
  // Personal app: keep it out of search engines.
  robots: { index: false, follow: false },
}

// `cover` lets the page use the whole screen of an iPhone with a notch: the layout keeps its own room
// with the safe-area insets (see MobileNav and the main area). The toolbar takes the color of the top bar.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#0d0f39" },
    { media: "(prefers-color-scheme: dark)", color: "#070820" },
  ],
}

// Runs before the first paint so a dark page never flashes white. Choice saved by ThemeToggle, else the system setting.
const themeScript = `try{var t=localStorage.getItem("theme");if(t==="dark"||(t!=="light"&&matchMedia("(prefers-color-scheme: dark)").matches))document.documentElement.classList.add("dark")}catch(e){}`

// iOS Safari only shows the pressed state (:active) of a page that listens to touches.
const touchScript = `document.addEventListener("touchstart",function(){},{passive:true})`

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        {/* No <title> here and none in `metadata`: Next re-renders metadata tags on every navigation and the
            tab title flickered. Each page renders its own <title> (see PageHeader), which React moves into
            <head> and updates when the page changes. A second one here would win, as the first in the head. */}
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <script dangerouslySetInnerHTML={{ __html: touchScript }} />
      </head>
      <body className="flex min-h-full">{children}</body>
    </html>
  )
}
