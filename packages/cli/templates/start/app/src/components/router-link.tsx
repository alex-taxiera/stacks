import { Link } from "@chakra-ui/react";
import { createLink } from "@tanstack/react-router";

/** Chakra's `Link`, navigating with the router: typed `to`, preloading and active state. */
export const RouterLink = createLink(Link);
