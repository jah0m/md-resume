import { readFile, writeFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const manifest = JSON.parse(await readFile(new URL("package.json", root), "utf8"));
const notices = [
  "BUNDLED RESUME FONTS — COPYRIGHT AND LICENSE NOTICES",
  "These fonts are self-hosted, supplied unchanged by the pinned Fontsource packages below.",
  "All are licensed under SIL Open Font License 1.1 (OFL-1.1).",
  "Commercial use and PDF embedding are allowed. Documents do not inherit the font license.",
  "Keep these copyright notices and licenses when redistributing the font files.",
  "Do not sell the fonts by themselves; modified fonts must respect reserved font names.",
  "License and FAQ: https://openfontlicense.org/ofl-faq/",
];

for (const name of Object.keys(manifest.dependencies).filter((name) => name.startsWith("@fontsource/"))) {
  const directory = new URL(`node_modules/${name}/`, root);
  const metadata = JSON.parse(await readFile(new URL("metadata.json", directory), "utf8"));
  const pkg = JSON.parse(await readFile(new URL("package.json", directory), "utf8"));
  const license = (await readFile(new URL("LICENSE", directory), "utf8")).trimEnd();
  if (metadata.license.type !== "OFL-1.1" || !license.includes("SIL OPEN FONT LICENSE Version 1.1")) {
    throw new Error(`Review the font license before bundling ${name}`);
  }
  notices.push(
    "\n================================================================\n",
    `${metadata.family} — ${name}@${pkg.version}`,
    `Distribution: https://www.npmjs.com/package/${name}/v/${pkg.version}`,
    `Upstream: ${metadata.source}/tree/main/ofl/${metadata.id.replaceAll("-", "")}`,
    "\n" + license,
  );
}

await writeFile(new URL("public/font-licenses.txt", root), notices.join("\n") + "\n", "utf8");
