import assert from "node:assert/strict";
import test from "node:test";
import {
  getProfileTab,
  getProfileTabHref,
} from "../src/utils/profile-tabs";

test("resolves only known public profile tabs", () => {
  assert.equal(getProfileTab("lists", false), "lists");
  assert.equal(getProfileTab("not-a-tab", false), "reviews");
  assert.equal(getProfileTab("listen-later", false), "reviews");
});

test("allows the private listen-later tab only for the profile owner", () => {
  assert.equal(getProfileTab("listen-later", true), "listen-later");
});

test("updates only tab while preserving unrelated query parameters", () => {
  const current = new URLSearchParams("source=profile&view=compact");

  assert.equal(
    getProfileTabHref("/en/users/ada", current, "diary"),
    "/en/users/ada?source=profile&view=compact&tab=diary"
  );
  assert.equal(
    getProfileTabHref("/en/users/ada", new URLSearchParams("tab=lists&source=profile"), "reviews"),
    "/en/users/ada?source=profile"
  );
});
