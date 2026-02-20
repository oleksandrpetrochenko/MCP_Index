import { marked, type Token } from "marked";
import { createChildLogger } from "../utils/logger.js";

const log = createChildLogger("readme-parser");

export interface ReadmeData {
  description: string | null;
  installCommands: string[];
  features: string[];
  hasToolsSection: boolean;
  hasResourcesSection: boolean;
  hasPromptsSection: boolean;
}

export function parseReadme(markdown: string): ReadmeData {
  const result: ReadmeData = {
    description: null,
    installCommands: [],
    features: [],
    hasToolsSection: false,
    hasResourcesSection: false,
    hasPromptsSection: false,
  };

  try {
    const tokens = marked.lexer(markdown);

    // Extract description: first paragraph after the main heading
    let foundHeading = false;
    for (const token of tokens) {
      if (token.type === "heading" && token.depth === 1) {
        foundHeading = true;
        continue;
      }
      if (foundHeading && token.type === "paragraph") {
        result.description = token.text.slice(0, 500);
        break;
      }
      // If no H1, take first paragraph
      if (!foundHeading && token.type === "paragraph" && !result.description) {
        result.description = token.text.slice(0, 500);
      }
    }

    // Look for install commands in code blocks
    const installPatterns = /(?:npm|npx|pnpm|yarn|pip|brew|docker|cargo)\s+(?:install|add|run|exec|i\s)/i;
    for (const token of tokens) {
      if (token.type === "code" && installPatterns.test(token.text)) {
        const commands = token.text
          .split("\n")
          .filter((line: string) => installPatterns.test(line))
          .map((line: string) => line.trim());
        result.installCommands.push(...commands);
      }
    }

    // Check for capability sections
    const headingTexts = tokens
      .filter((t: Token) => t.type === "heading")
      .map((t: Token) => ((t as any).text as string).toLowerCase());

    result.hasToolsSection = headingTexts.some(
      (h) => h.includes("tool") || h.includes("function") || h.includes("command"),
    );
    result.hasResourcesSection = headingTexts.some(
      (h) => h.includes("resource") || h.includes("data source"),
    );
    result.hasPromptsSection = headingTexts.some(
      (h) => h.includes("prompt") || h.includes("template"),
    );

    // Extract features from list items under "Features" heading
    let inFeaturesSection = false;
    for (const token of tokens) {
      if (token.type === "heading") {
        inFeaturesSection = token.text.toLowerCase().includes("feature");
        continue;
      }
      if (inFeaturesSection && token.type === "list") {
        for (const item of token.items) {
          result.features.push(item.text.slice(0, 200));
        }
        inFeaturesSection = false;
      }
    }
  } catch (err) {
    log.error({ err }, "Failed to parse README");
  }

  return result;
}
