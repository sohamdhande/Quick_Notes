import { MakerZIP } from "@electron-forge/maker-zip";

export default {
  packagerConfig: {
    name: "Quick Notes",
    executableName: "Quick Notes",
    asar: true,
    prune: true,
    ignore: [
      /^\/\.git/,
      /^\/src/,
      /^\/test/,
      /^\/\.agents/,
      /^\/README\.md/,
      /^\/eslint\.config\.js/,
      /^\/vite\.config\.js/,
    ],
  },
  rebuildConfig: {},
  makers: [
    new MakerZIP({}, ["darwin"]),
  ],
};
