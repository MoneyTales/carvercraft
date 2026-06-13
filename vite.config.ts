import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// dedupe is critical: @carverjs/* are linked via file:, and their imports of
// react/three must resolve to THIS app's copies or hooks/contexts break.
export default defineConfig({
  // Relative base so the build works at any path — GitHub Pages serves
  // project sites from /<repo>/, and "./" keeps asset URLs correct there
  // without hardcoding the repo name.
  base: "./",
  plugins: [react()],
  resolve: {
    dedupe: [
      "react",
      "react-dom",
      "three",
      "three-stdlib",
      "@react-three/fiber",
      "@react-three/drei",
      "zustand",
    ],
  },
  server: { host: true },
});
