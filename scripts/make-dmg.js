import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

function findAppBundle(outDir) {
  if (!fs.existsSync(outDir)) {
    throw new Error(`Output directory does not exist: ${outDir}`);
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

  throw new Error("No packaged 'Quick Notes.app' found in out directory. Run 'npm run package' first.");
}

async function createDmg() {
  if (process.platform !== "darwin") {
    console.log("DMG creation is only supported on macOS.");
    return;
  }

  const projectRoot = process.cwd();
  const outDir = path.join(projectRoot, "out");
  const makeDir = path.join(outDir, "make");

  const appBundlePath = findAppBundle(outDir);
  console.log(`Found packaged app at: ${appBundlePath}`);

  fs.mkdirSync(makeDir, { recursive: true });
  const dmgPath = path.join(makeDir, "Quick-Notes.dmg");

  console.log(`Creating macOS disk image (.dmg) at: ${dmgPath}`);
  execSync(
    `hdiutil create -volname "Quick Notes" -srcfolder "${appBundlePath}" -ov -format UDZO "${dmgPath}"`,
    { stdio: "inherit" }
  );

  const stats = fs.statSync(dmgPath);
  console.log(`✓ DMG created successfully! Size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
}

createDmg().catch((err) => {
  console.error("DMG creation failed:", err.message);
  process.exit(1);
});
