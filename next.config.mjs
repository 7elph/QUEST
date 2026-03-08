import { withSentryConfig } from "@sentry/nextjs";

const allowedDevOrigins = (process.env.ALLOWED_DEV_ORIGINS ?? "https://*.ngrok-free.app,https://*.ngrok.app")
  .split(",")
  .map((origin) => origin.trim())
  .filter((origin) => origin.length > 0);

/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins,
};

const sentryWebpackPluginOptions = {
  silent: true,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  dryRun: !process.env.SENTRY_AUTH_TOKEN,
  webpack: {
    treeshake: {
      removeDebugLogging: true,
    },
  },
};

export default withSentryConfig(nextConfig, sentryWebpackPluginOptions);
