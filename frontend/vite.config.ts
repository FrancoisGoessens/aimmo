import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

// base: '/AImmo/' -> à adapter au nom exact de ton repo GitHub
// (GitHub Pages sert le site depuis https://<user>.github.io/<repo>/)
export default defineConfig({
  plugins: [vue()],
  base: "/AImmo/",
});
