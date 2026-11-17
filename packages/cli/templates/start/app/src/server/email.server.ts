export interface Email {
  to: string;
  subject: string;
  text: string;
}

/**
 * Prints the email to the server's console, so sign-in codes and links can be copied from the
 * terminal. Before going live, send it through a provider (Resend, Postmark, Mailgun) here.
 */
export async function sendEmail(email: Email): Promise<void> {
  console.info(`\n[email] to: ${email.to}\n[email] subject: ${email.subject}\n${email.text}\n`);
}

/**
 * Sends without waiting, for sign-in flows: how long sending takes mustn't tell anyone whether an
 * address has an account.
 */
export function sendEmailInBackground(email: Email): void {
  sendEmail(email).catch((error: unknown) => {
    console.error("[email] couldn't send", error);
  });
}
