import { logger } from "@/lib/logger";

type SendEmailInput = {
  to: string;
  subject: string;
  text: string;
};

export async function sendEmail(input: SendEmailInput) {
  const apiKey = process.env.SENDGRID_API_KEY;
  const from = process.env.SENDGRID_FROM;

  if (!apiKey || !from) {
    logger.info({ to: input.to, subject: input.subject }, "EMAIL_STUB_SENT");
    return { delivered: false, provider: "stub" };
  }

  const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: input.to }] }],
      from: { email: from },
      subject: input.subject,
      content: [{ type: "text/plain", value: input.text }],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    logger.error({ status: response.status, errorText }, "EMAIL_PROVIDER_ERROR");
    throw new Error("EMAIL_PROVIDER_ERROR");
  }

  return { delivered: true, provider: "sendgrid" };
}
