import { Container, Stack, Text } from "@chakra-ui/react";
import { Card } from "__UI_PKG__/card";
import type { ReactNode } from "react";

export interface AuthCardProps {
  title: string;
  description?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
}

/** The centred card the sign-in and sign-up pages share. */
export function AuthCard({ title, description, footer, children }: AuthCardProps) {
  return (
    <Container maxW="md" py={{ base: 10, md: 16 }}>
      <Card
        title={title}
        titleProps={{ as: "h1", textStyle: "2xl" }}
        description={description}
        footer={
          footer && (
            <Text textStyle="sm" color="fg.muted" w="full" textAlign="center">
              {footer}
            </Text>
          )
        }
      >
        <Stack pt={4}>{children}</Stack>
      </Card>
    </Container>
  );
}
