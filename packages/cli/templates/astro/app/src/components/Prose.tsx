import { Box, Container } from "@chakra-ui/react";
import { IslandProvider } from "__UI_PKG__/island";
import type { ReactNode } from "react";

/**
 * Rendered Markdown, styled with the theme's tokens. Astro passes a post's HTML in as `children`,
 * which React leaves as it is, so the styles reach it through descendant selectors.
 */
export function Prose({ children }: { children: ReactNode }) {
  return (
    <IslandProvider>
      <Container maxW="4xl">
        <Box
          maxW="70ch"
          lineHeight="tall"
          css={{
            "& > * + *": { mt: "4" },
            "& h2": { textStyle: "2xl", fontWeight: "semibold", mt: "10" },
            "& h3": { textStyle: "xl", fontWeight: "semibold", mt: "8" },
            "& a": { color: "colorPalette.fg", textDecoration: "underline" },
            "& code": { fontFamily: "mono", fontSize: "0.9em", bg: "bg.muted", px: "1", rounded: "sm" },
            "& pre": { p: "4", rounded: "md", overflowX: "auto", fontSize: "sm" },
            "& pre code": { bg: "transparent", p: "0" },
            "& ul, & ol": { ps: "6" },
            "& ul": { listStyle: "disc" },
            "& ol": { listStyle: "decimal" },
            "& blockquote": { borderStartWidth: "4px", ps: "4", color: "fg.muted" },
          }}
        >
          {children}
        </Box>
      </Container>
    </IslandProvider>
  );
}
