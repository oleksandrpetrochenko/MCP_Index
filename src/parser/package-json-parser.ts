import { createChildLogger } from "../utils/logger.js";

const log = createChildLogger("package-json-parser");

export interface PackageJsonData {
  name: string;
  version: string;
  description: string | null;
  author: string | null;
  license: string | null;
  homepage: string | null;
  repository: string | null;
  keywords: string[];
  hasMcpDependency: boolean;
  installCommand: string | null;
  bin: Record<string, string> | null;
}

export function parsePackageJson(raw: string | Record<string, unknown>): PackageJsonData | null {
  try {
    const pkg = typeof raw === "string" ? JSON.parse(raw) : raw;

    const name = pkg.name || "unknown";

    // Normalize repository field
    let repository: string | null = null;
    if (typeof pkg.repository === "string") {
      repository = pkg.repository;
    } else if (pkg.repository?.url) {
      repository = pkg.repository.url
        .replace(/^git\+/, "")
        .replace(/\.git$/, "");
    }

    // Normalize author field
    let author: string | null = null;
    if (typeof pkg.author === "string") {
      author = pkg.author;
    } else if (pkg.author?.name) {
      author = pkg.author.name;
    }

    // Check for MCP dependency
    const allDeps = {
      ...pkg.dependencies,
      ...pkg.devDependencies,
      ...pkg.peerDependencies,
    };
    const hasMcpDependency = Object.keys(allDeps || {}).some(
      (dep) =>
        dep.includes("@modelcontextprotocol") ||
        dep.includes("mcp-sdk") ||
        dep.includes("mcp-server"),
    );

    // Determine install command
    let installCommand: string | null = null;
    if (pkg.bin) {
      const binName = typeof pkg.bin === "string" ? name : Object.keys(pkg.bin)[0];
      installCommand = `npx ${binName || name}`;
    }

    return {
      name,
      version: pkg.version || "0.0.0",
      description: pkg.description || null,
      author,
      license: pkg.license || null,
      homepage: pkg.homepage || null,
      repository,
      keywords: Array.isArray(pkg.keywords) ? pkg.keywords : [],
      hasMcpDependency,
      installCommand,
      bin: pkg.bin || null,
    };
  } catch (err) {
    log.error({ err }, "Failed to parse package.json");
    return null;
  }
}
