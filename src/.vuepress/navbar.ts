import { navbar } from "vuepress-theme-hope";

export default navbar([
  {
    text: "主站",
    icon: "material-symbols:edit-square-sharp",
    link: "https://for-each.cn",
  },
  "/",
  {
    text: "博文",
    icon: "pen-to-square",
    prefix: "/posts/",
    children: [
      {
        text: "C++",
        icon: "logos:c-plusplus",
        link: "C++/README.md"
      },
      {
        text: "Python",
        icon: "logos:python",
        link: "Python/README.md"
      },
      {
        text: "算法",
        icon: "code",
        link: "algorithm/README.md"
      },
    ],
  },
  {
    text: "全部文章",
    icon: "book",
    link: "/article/",
  },
]);
