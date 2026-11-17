import { Box, Container } from "@chakra-ui/react";
import { IslandProvider } from "@stacks/ui/island";
import type { ReactNode } from "react";

/**
 * Rendered Markdown, styled with the theme's tokens. Astro passes a post's HTML in as `children`,
 * which React leaves as it is, so the styles reach it through descendant selectors.
 */
export function Prose({
  children,
  contained = true,
}: {
  children: ReactNode;
  /** In a page-width container of its own; false inside a layout that has one. */
  contained?: boolean;
}) {
  const body = (
    <Box
      maxW="70ch"
      lineHeight="tall"
      css={{
        "& > * + *": { mt: "4" },
        "& h2": { textStyle: "2xl", fontWeight: "semibold", mt: "10" },
        "& h3": { textStyle: "xl", fontWeight: "semibold", mt: "8" },
        "& a": { color: "colorPalette.fg", textDecoration: "underline" },
        "& code": {
          fontFamily: "mono",
          fontSize: "0.9em",
          bg: "bg.muted",
          px: "1",
          rounded: "sm",
        },
        "& pre": { p: "4", rounded: "md", overflowX: "auto", fontSize: "sm" },
        "& pre code": { bg: "transparent", p: "0" },
        "& ul, & ol": { ps: "6" },
        "& ul": { listStyle: "disc" },
        "& ol": { listStyle: "decimal" },
        "& blockquote": { borderStartWidth: "4px", ps: "4", color: "fg.muted" },
        // A wide table scrolls itself rather than the page.
        "& table": {
          display: "block",
          maxW: "full",
          overflowX: "auto",
          borderCollapse: "collapse",
          fontSize: "sm",
        },
        "& th, & td": { borderBottomWidth: "1px", px: "3", py: "2", textAlign: "start" },
        "& th": { fontWeight: "semibold", whiteSpace: "nowrap" },
        "& td code": { whiteSpace: "nowrap" },
      }}
    >
      {children}
    </Box>
  );
  return (
    <IslandProvider>{contained ? <Container maxW="5xl">{body}</Container> : body}</IslandProvider>
  );
}
