import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "MaideenAttendee — QR attendance",
    short_name: "MaideenAttendee",
    description:
      "Multi-tenant QR attendance management for universities, polytechnics and colleges. Scan student QR codes, track attendance live and export reports.",
    id: "/",
    start_url: "/auth/redirect",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#f8fafc",
    theme_color: "#4f46e5",
    lang: "en-NG",
    dir: "ltr",
    categories: ["education", "productivity", "business"],
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512-maskable.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png",
        purpose: "any",
      },
    ],
    shortcuts: [
      {
        name: "Start attendance",
        short_name: "Scan",
        description: "Open the lecturer QR scanner",
        url: "/lecturer/attendance/new",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }],
      },
      {
        name: "My QR code",
        short_name: "My QR",
        description: "Show your student attendance QR code",
        url: "/student/qr",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }],
      },
      {
        name: "Institution dashboard",
        short_name: "Dashboard",
        description: "Open the institution admin dashboard",
        url: "/admin",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }],
      },
    ],
  };
}
