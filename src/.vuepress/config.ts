import { defineUserConfig } from "vuepress";

import theme from "./theme.js";
import postsIndex from "./plugins/posts-index.js";

export default defineUserConfig({
  base: "/",

  lang: "zh-CN",
  title: "for_each",
  description: "博客",

  theme,
  plugins: [postsIndex()],

  // 和 PWA 一起启用
  // shouldPrefetch: false,
});
