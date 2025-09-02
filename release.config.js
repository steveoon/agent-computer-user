/**
 * @type {import('semantic-release').GlobalConfig}
 */
module.exports = {
  branches: [
    "main",
    {
      name: "develop",
      prerelease: true,
    },
    {
      name: "beta",
      prerelease: true,
    },
  ],
  plugins: [
    "@semantic-release/commit-analyzer",
    "@semantic-release/release-notes-generator",
    [
      "@semantic-release/changelog",
      {
        changelogFile: "CHANGELOG.md",
        changelogTitle:
          "# Changelog\n\nAll notable changes to AI SDK Computer Use will be documented in this file.",
      },
    ],
    [
      "@semantic-release/github",
      {
        assets: [
          {
            path: "CHANGELOG.md",
            label: "Change Log",
          },
        ],
        successComment: false,
        failTitle: false,
        failComment: false,
        releasedLabels: ["released"],
      },
    ],
    [
      "@semantic-release/npm",
      {
        npmPublish: false, // This is a Next.js app, not an NPM package
      },
    ],
    [
      "@semantic-release/git",
      {
        assets: ["package.json", "pnpm-lock.yaml", "CHANGELOG.md"],
        message: "chore(release): ${nextRelease.version} [skip ci]\n\n${nextRelease.notes}",
      },
    ],
    // 自定义插件：自动同步 main 到 develop
    "./scripts/semantic-release-sync-branches.js",
  ],
};
