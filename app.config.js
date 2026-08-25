/**
 * Dynamic Expo config, layered on top of app.json.
 *
 * Exists for one reason: the Sentry config plugin. Listing it unconditionally
 * in app.json made every `expo start` print
 *
 *   [@sentry/react-native/expo] Missing config for organization, project.
 *
 * because the plugin needs a Sentry org and project slug to wire up native
 * symbol and source-map upload, and this project has never been onboarded to
 * Sentry — there is no DSN, no sentry.properties, and no org/project anywhere
 * in the repo.
 *
 * So the plugin is added only when it can actually be configured. With the
 * env vars unset the plugin is absent and the warning has nothing to warn
 * about; set them and the build gets a fully configured plugin instead of one
 * silently falling back to env lookups.
 *
 * Runtime error reporting is unaffected either way: app/_layout.tsx calls
 * Sentry.init() when EXPO_PUBLIC_SENTRY_DSN is set, which is independent of
 * this plugin. The plugin governs build-time upload of native symbols and
 * source maps, which is only meaningful once an org and project exist.
 *
 * To enable, set these before building (locally in .env, or as EAS secrets):
 *   SENTRY_ORG=your-org-slug
 *   SENTRY_PROJECT=your-project-slug
 *   SENTRY_AUTH_TOKEN=...      # upload credential — a secret, never commit
 */
module.exports = ({ config }) => {
  const organization = process.env.SENTRY_ORG;
  const project = process.env.SENTRY_PROJECT;

  if (!organization || !project) {
    return config;
  }

  return {
    ...config,
    plugins: [
      ...(config.plugins ?? []),
      // authToken is deliberately not passed here: it is a credential, and the
      // plugin already reads SENTRY_AUTH_TOKEN from the environment. Putting it
      // in config risks it landing in a committed file or a build log.
      ['@sentry/react-native/expo', { organization, project }],
    ],
  };
};
