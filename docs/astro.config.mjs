// @ts-check
import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";

export default defineConfig({
  site: "https://hihebark.github.io",
  base: "/appwire",
  integrations: [
    starlight({
      title: "Appwire",
      logo: { src: "./public/logo.svg", alt: "Appwire" },
      description:
        "Live app REPL for Node.js — run code inside your running app",
      social: [
        {
          icon: "github",
          label: "GitHub",
          href: "https://github.com/hihebark/appwire",
        },
      ],
      sidebar: [
        {
          label: "Documentation",
          items: [
            { label: "Introduction", slug: "docs" },
            { label: "IPC mode", slug: "docs/guides/ipc" },
            { label: "MCP server", slug: "docs/guides/mcp" },
          ],
        },
        {
          label: "Reference",
          items: [{ autogenerate: { directory: "docs/reference" } }],
        },
      ],
      customCss: ["./src/styles/custom.css"],
    }),
  ],
});
