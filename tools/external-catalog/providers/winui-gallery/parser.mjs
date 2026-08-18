const controlExampleMarker = "<controls:ControlExample";
const allowedDefinitionSections = new Set(["header", "xaml", "c#"]);

function fail(context, message) {
  throw new Error(`${context}: ${message}`);
}

export function decodeUtf8(bytes, context) {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    fail(context, "artifact is not valid UTF-8");
  }
}

export function stripXmlComments(source, context = "XAML") {
  let cursor = 0;
  let result = "";
  while (cursor < source.length) {
    const start = source.indexOf("<!--", cursor);
    if (start < 0) {
      result += source.slice(cursor);
      break;
    }
    result += source.slice(cursor, start);
    const end = source.indexOf("-->", start + 4);
    if (end < 0) {
      fail(context, "unterminated XML comment");
    }
    cursor = end + 3;
  }
  return result;
}

function scanStartTag(source, start, context) {
  let quote = null;
  for (let index = start; index < source.length; index += 1) {
    const character = source[index];
    if (quote !== null) {
      if (character === quote) {
        quote = null;
      }
      continue;
    }
    if (character === '"' || character === "'") {
      quote = character;
    } else if (character === ">") {
      return source.slice(start, index + 1);
    }
  }
  fail(context, "unterminated ControlExample start tag");
}

export function normalizeDefinitionReference(value, context = "SampleDefinition") {
  const normalized = value.replaceAll("\\", "/");
  if (
    !/^[A-Za-z0-9][A-Za-z0-9._/-]*\.txt$/.test(normalized) ||
    normalized.startsWith("/") ||
    normalized.includes("//") ||
    normalized.split("/").some((segment) => segment === "." || segment === "..") ||
    /%[0-9a-f]{2}/i.test(normalized)
  ) {
    fail(context, `unsafe sample definition path ${JSON.stringify(value)}`);
  }
  return normalized;
}

export function parseControlExamples(source, context = "XAML") {
  const activeSource = stripXmlComments(source, context);
  const examples = [];
  let cursor = 0;

  while (cursor < activeSource.length) {
    const start = activeSource.indexOf(controlExampleMarker, cursor);
    if (start < 0) {
      break;
    }
    const boundary = activeSource[start + controlExampleMarker.length];
    if (boundary !== ">" && boundary !== "/" && !/\s/.test(boundary ?? "")) {
      cursor = start + controlExampleMarker.length;
      continue;
    }

    const startTag = scanStartTag(activeSource, start, context);
    const matches = [
      ...startTag.matchAll(/\bSampleDefinition\s*=\s*(["'])(.*?)\1/g),
    ];
    if (matches.length > 1) {
      fail(context, "ControlExample has duplicate SampleDefinition attributes");
    }
    const sampleDefinition = matches[0]
      ? normalizeDefinitionReference(matches[0][2], context)
      : null;
    examples.push({
      position: examples.length + 1,
      sampleDefinition,
    });
    cursor = start + startTag.length;
  }

  return examples;
}

export function parseSampleDefinition(source, context = "sample definition") {
  const sections = new Map();
  let currentSection = null;
  let currentLines = [];
  const preamble = [];

  function saveSection() {
    if (currentSection === null) {
      return;
    }
    const name = currentSection.toLowerCase();
    if (!allowedDefinitionSections.has(name)) {
      fail(context, `unknown section ${currentSection}`);
    }
    if (sections.has(name)) {
      fail(context, `duplicate section ${currentSection}`);
    }
    sections.set(name, currentLines.join("\n").trim());
  }

  for (const rawLine of source.split("\n")) {
    const line = rawLine.replace(/\r$/, "");
    const marker = line.match(/^---\s+(.+?)\s*$/);
    if (marker) {
      saveSection();
      currentSection = marker[1];
      currentLines = [];
    } else if (currentSection === null) {
      preamble.push(line);
    } else {
      currentLines.push(line);
    }
  }
  saveSection();

  if (preamble.join("").trim() !== "") {
    fail(context, "content before the first section is not supported");
  }
  if (!sections.has("header") || sections.get("header") === "") {
    fail(context, "a non-empty header section is required");
  }
  for (const [name, value] of sections) {
    if (value === "") {
      fail(context, `${name} section must not be empty`);
    }
  }

  const combination = ["header", "xaml", "c#"]
    .filter((name) => sections.has(name))
    .join("+");
  return {
    header: sections.get("header"),
    xaml: sections.get("xaml") ?? null,
    csharp: sections.get("c#") ?? null,
    combination,
  };
}
