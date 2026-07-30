import { defineConfig } from "vitepress"

// Docs site for Orbit, published to https://artsy.github.io/orbit/
export default defineConfig({
  title: "Orbit",
  description: "Engineer on-call rotation scheduler",
  base: "/orbit/",
  // Local dev URLs referenced in the guide aren't reachable at build time.
  ignoreDeadLinks: [/^https?:\/\/localhost/],
  themeConfig: {
    logo: { light: "/logo-light.png", dark: "/logo-dark.png" },
    nav: [
      { text: "Guide", link: "/getting-started" },
      { text: "API", link: "/api-contract" },
    ],
    sidebar: [
      {
        text: "Guide",
        items: [
          { text: "Overview", link: "/" },
          { text: "Getting started", link: "/getting-started" },
          { text: "Who's on call", link: "/whos-on-call" },
          {
            text: "Managing engineers & rotations",
            link: "/managing-engineers",
          },
          { text: "Overrides & swaps", link: "/overrides-and-swaps" },
          { text: "Event log", link: "/event-log" },
          { text: "Architecture", link: "/architecture" },
          { text: "Deployment", link: "/deployment" },
          { text: "Troubleshooting", link: "/troubleshooting" },
        ],
      },
      {
        text: "Reference",
        items: [{ text: "API contract", link: "/api-contract" }],
      },
    ],
    socialLinks: [{ icon: "github", link: "https://github.com/artsy/orbit" }],
    editLink: {
      pattern: "https://github.com/artsy/orbit/edit/main/docs/:path",
    },
  },
})
