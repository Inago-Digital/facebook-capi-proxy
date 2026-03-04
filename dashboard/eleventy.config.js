import "tsx/esm"
import { renderToStaticMarkup } from "react-dom/server"

export default function (eleventyConfig) {
  // Enable JSX/TSX templates
  eleventyConfig.addExtension(["11ty.jsx", "11ty.ts", "11ty.tsx"], {
    key: "11ty.js",
    compile: function () {
      return async function (data) {
        let content = await this.defaultRenderer(data)
        return renderToStaticMarkup(content)
      }
    },
  })

  // Copy static assets
  eleventyConfig.addPassthroughCopy({ "src/assets/": "assets/" })

  // Ignore component and utility files
  eleventyConfig.ignores.add("src/components/**")
  eleventyConfig.ignores.add("src/utils/**")

  return {
    dir: {
      input: "src",
      output: "_site",
    },
    pathPrefix: "/",
  }
}
