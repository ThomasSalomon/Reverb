import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), "utf8");

test("Button preserves native button behavior and shared interaction states", () => {
  const component = read("src/components/Button/Button.tsx");
  const styles = read("src/components/Button/Button.module.css");

  assert.match(component, /extends ButtonHTMLAttributes<HTMLButtonElement>/);
  assert.match(component, /type = "button"/);
  assert.match(component, /disabled=\{disabled \|\| isLoading\}/);
  assert.match(component, /aria-busy=\{isLoading \|\| undefined\}/);
  assert.match(component, /\{\.\.\.props\}/);
  assert.match(component, /isLoading && loadingLabel \? loadingLabel : children/);
  assert.match(styles, /\.primary\s*\{/);
  assert.match(styles, /\.neon\s*\{/);
  assert.match(styles, /\.secondary\s*\{/);
  assert.match(styles, /\.danger\s*\{/);
  assert.match(styles, /min-height:\s*44px/);
});

test("Field composes labels, help and errors without owning form state", () => {
  const component = read("src/components/Field/Field.tsx");

  assert.match(component, /cloneElement\(children/);
  assert.match(component, /htmlFor=\{id\}/);
  assert.match(component, /required:\s*required \|\| children\.props\.required/);
  assert.match(component, /"aria-invalid":\s*Boolean\(error\)/);
  assert.match(component, /"aria-describedby":\s*describedBy/);
  assert.match(component, /const hintId = hint \? `\$\{id\}-hint`/);
  assert.match(component, /const errorId = error \? `\$\{id\}-error`/);
});

test("responsive CSS uses the canonical set plus the documented album exception", () => {
  const sourceFiles = [
    ...walk("src/app"),
    ...walk("src/components"),
  ].filter((file) => file.endsWith(".css"));
  const breakpoints = new Set<number>();

  for (const file of sourceFiles) {
    const css = fs.readFileSync(file, "utf8");
    for (const match of Array.from(css.matchAll(/@media \((?:min|max)-width:\s*(\d+)px\)/g))) {
      breakpoints.add(Number(match[1]));
    }
  }

  assert.deepEqual(Array.from(breakpoints).sort((a, b) => a - b), [480, 640, 768, 900, 1024]);
  assert.match(read("src/app/globals.css"), /A 900px exception is retained only/);
});

test("CSS and Framer motion share a small explicit vocabulary", () => {
  const globals = read("src/app/globals.css");
  const motion = read("src/utils/motion.ts");
  const playlist = read("src/components/SpecialPlaylistModal/SpecialPlaylistModal.tsx");

  assert.match(globals, /--duration-fast:\s*160ms/);
  assert.match(globals, /--duration-normal:\s*250ms/);
  assert.match(globals, /--duration-slow:\s*300ms/);
  assert.match(globals, /--ease-expressive:/);
  assert.match(globals, /--ease-entrance:/);
  assert.match(motion, /fast:\s*0\.16/);
  assert.match(motion, /normal:\s*0\.25/);
  assert.match(motion, /slow:\s*0\.3/);
  assert.match(playlist, /MOTION_DURATION\.slow/);
  assert.match(playlist, /reducedMotionDuration/);
});

function walk(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(target) : [target];
  });
}
