import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

function findAppBundle(outDir) {
  if (!fs.existsSync(outDir)) {
    return null;
  }

  const entries = fs.readdirSync(outDir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory() && entry.name.includes("darwin")) {
      const candidate = path.join(outDir, entry.name, "Quick Notes.app");
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    }
  }

  return null;
}

async function createDmg() {
  if (process.platform !== "darwin") {
    console.log("DMG creation is only supported on macOS.");
    return;
  }

  const projectRoot = process.cwd();
  const outDir = path.join(projectRoot, "out");
  const makeDir = path.join(outDir, "make");
  const distDir = path.join(projectRoot, "dist");
  const stagingDir = path.join(outDir, "dmg-staging");

  let appBundlePath = findAppBundle(outDir);
  if (!appBundlePath) {
    console.log("No packaged app found. Packaging application first...");
    execSync("npm run package", { stdio: "inherit", cwd: projectRoot });
    appBundlePath = findAppBundle(outDir);
    if (!appBundlePath) {
      throw new Error("Failed to locate 'Quick Notes.app' after packaging.");
    }
  }

  console.log(`Found packaged app at: ${appBundlePath}`);

  // Setup staging directory with app and Applications drag-and-drop symlink
  if (fs.existsSync(stagingDir)) {
    fs.rmSync(stagingDir, { recursive: true, force: true });
  }
  fs.mkdirSync(stagingDir, { recursive: true });

  console.log("Preparing drag-and-drop installer staging folder...");
  const stagedAppPath = path.join(stagingDir, "Quick Notes.app");
  execSync(`ditto "${appBundlePath}" "${stagedAppPath}"`, { stdio: "inherit" });

  const appLinkPath = path.join(stagingDir, "Applications");
  fs.symlinkSync("/Applications", appLinkPath);

  fs.mkdirSync(makeDir, { recursive: true });
  const dmgPath = path.join(makeDir, "Quick-Notes.dmg");

  console.log(`Creating macOS disk image (.dmg) at: ${dmgPath}`);
  execSync(
    `hdiutil create -volname "Quick Notes" -srcfolder "${stagingDir}" -ov -format UDZO "${dmgPath}"`,
    { stdio: "inherit" }
  );

  // Clean up staging directory
  fs.rmSync(stagingDir, { recursive: true, force: true });

  // Copy to dist/ directory as well for convenience
  fs.mkdirSync(distDir, { recursive: true });
  const distDmgPath = path.join(distDir, "Quick-Notes.dmg");
  fs.copyFileSync(dmgPath, distDmgPath);

  const stats = fs.statSync(dmgPath);
  console.log(`\n✓ DMG created successfully!`);
  console.log(`  Location 1: ${dmgPath}`);
  console.log(`  Location 2: ${distDmgPath}`);
  console.log(`  File size : ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
  console.log(`  Contents  : Quick Notes.app + drag-and-drop /Applications shortcut\n`);
}

createDmg().catch((err) => {
  console.error("DMG creation failed:", err.message);
  process.exit(1);
});
