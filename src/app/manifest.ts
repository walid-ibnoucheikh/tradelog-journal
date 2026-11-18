import type { MetadataRoute } from "next"

/** What "Add to Home Screen" on an iPhone or Android phone uses: the app opens full screen, like an app. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Tradelog",
    short_name: "Tradelog",
    description: "NQ / MNQ trade journal",
    start_url: "/",
    display: "standalone",
    background_color: "#f4f5fa",
    theme_color: "#0d0f39",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  }
}
