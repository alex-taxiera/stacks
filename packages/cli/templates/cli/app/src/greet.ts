export interface GreetOptions {
  /** Greet in capitals. */
  shout?: boolean;
}

/** A greeting for `name`, or for the world when there's no name. */
export function greet(name = "world", options: GreetOptions = {}): string {
  const greeting = `Hello, ${name.trim() || "world"}!`;
  return options.shout ? greeting.toUpperCase() : greeting;
}
