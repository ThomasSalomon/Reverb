import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), "utf8");

test("login refreshes the server-derived session instead of relying on a browser reload", () => {
  const login = read("src/app/[locale]/login/page.tsx");
  const register = read("src/app/[locale]/register/page.tsx");
  const navbar = read("src/components/Navbar/Navbar.tsx");

  assert.match(login, /router\.replace\("\/"\)/);
  assert.match(login, /router\.refresh\(\)/);
  assert.match(register, /router\.replace\("\/"\)/);
  assert.match(register, /router\.refresh\(\)/);
  assert.match(navbar, /fetch\("\/api\/auth\/me", \{ cache: "no-store" \}\)/);
  assert.match(navbar, /const displayedUser = user\?\.id === initialUser\?\.id \? user : initialUser/);
  assert.match(navbar, /router\.refresh\(\)/);
  assert.doesNotMatch(navbar, /window\.location\.reload/);
});

test("persistent navigation receives its authentication state from the server cookie", () => {
  const layout = read("src/app/[locale]/layout.tsx");
  const bottomNav = read("src/components/BottomNav/BottomNav.tsx");

  assert.match(layout, /const authUser = await getAuthUser\(\)/);
  assert.match(layout, /<Navbar initialUser=\{sessionUser\} \/>/);
  assert.match(layout, /<BottomNav initialUser=\{sessionUser\} \/>/);
  assert.match(bottomNav, /fetch\("\/api\/auth\/me", \{ cache: "no-store" \}\)/);
  assert.match(bottomNav, /const displayedUser = user\?\.id === initialUser\?\.id \? user : initialUser/);
});

test("the login response keeps the session token in a strict HttpOnly cookie", () => {
  const loginRoute = read("src/app/api/auth/login/route.ts");

  assert.match(loginRoute, /response\.cookies\.set\("token", token, \{/);
  assert.match(loginRoute, /httpOnly:\s*true/);
  assert.match(loginRoute, /sameSite:\s*"strict"/);
  assert.match(loginRoute, /path:\s*"\/"/);
  assert.doesNotMatch(loginRoute, /token:\s*token/);
});

