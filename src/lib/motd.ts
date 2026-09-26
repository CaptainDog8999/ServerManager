type ChatNode = {
  text?: string;
  extra?: unknown;
  translate?: string;
  with?: unknown;
};

export function flattenMotd(description: unknown): string {
  if (description == null) return "";
  if (typeof description === "string") return stripLegacy(description);
  if (typeof description !== "object") return String(description);
  const node = description as ChatNode;
  const parts: string[] = [];
  if (typeof node.text === "string") parts.push(node.text);
  if (typeof node.translate === "string") parts.push(node.translate);
  if (Array.isArray(node.extra)) {
    for (const child of node.extra) parts.push(flattenMotd(child));
  }
  if (Array.isArray(node.with)) {
    for (const child of node.with) parts.push(flattenMotd(child));
  }
  return stripLegacy(parts.join(""));
}

export function stripLegacy(text: string): string {
  return text
    .replace(/§[0-9a-fk-or]/gi, "")
    .replace(/\u00a7[0-9a-fk-or]/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}
