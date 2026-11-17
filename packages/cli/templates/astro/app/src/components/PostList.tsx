import { Container, Heading, Link, Stack, Text } from "@chakra-ui/react";
import { EmptyState } from "__UI_PKG__/empty-state";
import { IslandProvider } from "__UI_PKG__/island";

export interface PostSummary {
  href: string;
  title: string;
  description: string;
  /** Already formatted: the build, not the browser, decides how a date reads. */
  date: string;
}

/** Posts as a list of titles, dates and descriptions, each linking to the post. */
export function PostList({ posts }: { posts: readonly PostSummary[] }) {
  return (
    <IslandProvider>
      <Container maxW="4xl">
        {posts.length === 0 ? (
          <EmptyState title="No posts yet" description="Add one to src/content/posts." />
        ) : (
          <Stack as="ul" gap={8} listStyle="none">
            {posts.map((post) => (
              <Stack as="li" key={post.href} gap={1}>
                <Text fontSize="sm" color="fg.muted">
                  {post.date}
                </Text>
                <Heading as="h2" size="xl">
                  <Link href={post.href} color="fg">
                    {post.title}
                  </Link>
                </Heading>
                <Text color="fg.muted">{post.description}</Text>
              </Stack>
            ))}
          </Stack>
        )}
      </Container>
    </IslandProvider>
  );
}
