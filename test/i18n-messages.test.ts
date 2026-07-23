import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import ts from "typescript";
import en from "../messages/en.json";
import es from "../messages/es.json";
import pt from "../messages/pt.json";

function keys(value: unknown, prefix = ""): string[] {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return Object.entries(value).flatMap(([key, child]) => keys(child, prefix ? `${prefix}.${key}` : key));
  }
  return [prefix];
}

function messages(value: unknown, prefix = ""): Array<[string, string]> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return Object.entries(value).flatMap(([key, child]) =>
      messages(child, prefix ? `${prefix}.${key}` : key),
    );
  }
  return [[prefix, String(value)]];
}

function variables(message: string): string[] {
  const result: string[] = [];
  const pattern = /\{([A-Za-z][A-Za-z0-9_]*)(?=,|\})/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(message)) !== null) result.push(match[1]);
  return result.sort();
}

test("all locale message catalogs have the same keys", () => {
  const expected = keys(es).sort();
  assert.deepEqual(keys(en).sort(), expected);
  assert.deepEqual(keys(pt).sort(), expected);
});

test("translations are non-empty and preserve interpolation variables", () => {
  const catalogs = { es, en, pt };
  const source = new Map(messages(es));

  for (const [locale, catalog] of Object.entries(catalogs)) {
    for (const [key, message] of messages(catalog)) {
      assert.ok(message.trim(), `${locale}.${key} must not be empty`);
      assert.deepEqual(
        variables(message),
        variables(source.get(key) ?? ""),
        `${locale}.${key} must preserve interpolation variables`,
      );
    }
  }
});

function sourceFiles(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(target);
    return /\.(?:ts|tsx)$/.test(entry.name) ? [target] : [];
  });
}

test("statically referenced translation keys exist", () => {
  const missing: string[] = [];
  const sourceRoot = path.join(process.cwd(), "src");

  for (const file of sourceFiles(sourceRoot)) {
    const source = fs.readFileSync(file, "utf8");
    const syntax = file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
    const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, syntax);
    const translators = new Map<string, string>();

    const collectTranslators = (node: ts.Node) => {
      if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
        const initializer = ts.isAwaitExpression(node.initializer)
          ? node.initializer.expression
          : node.initializer;
        if (
          ts.isCallExpression(initializer) &&
          /(?:use|get)Translations$/.test(initializer.expression.getText(sourceFile))
        ) {
          const namespaceArgument = initializer.arguments.find(ts.isStringLiteral);
          if (namespaceArgument) translators.set(node.name.text, namespaceArgument.text);
        }
      }
      ts.forEachChild(node, collectTranslators);
    };

    const checkCalls = (node: ts.Node) => {
      if (
        ts.isCallExpression(node) &&
        ts.isIdentifier(node.expression) &&
        translators.has(node.expression.text) &&
        node.arguments[0] &&
        ts.isStringLiteral(node.arguments[0])
      ) {
        const namespace = translators.get(node.expression.text)!;
        const key = node.arguments[0].text;
        if (!(namespace in en) || !(key in en[namespace as keyof typeof en])) {
          const line = sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1;
          missing.push(`${path.relative(process.cwd(), file)}:${line} ${namespace}.${key}`);
        }
      }
      ts.forEachChild(node, checkCalls);
    };

    collectTranslators(sourceFile);
    checkCalls(sourceFile);
  }

  assert.deepEqual(missing, []);
});
