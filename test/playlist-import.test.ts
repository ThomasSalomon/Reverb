import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import { createClient, type Client } from "@libsql/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { PrismaClient } from "@prisma/client";
import { SignJWT } from "jose";

const TEST_SECRET = "playlist-import-test-secret-with-enough-entropy";
const USER_A_ID = "playlist-user-a";
const USER_B_ID = "playlist-user-b";

type Context = {
  client: Client;
  prisma: PrismaClient;
  post: typeof import("../src/app/api/lists/save-playlist/route").POST;
  importPlaylist: typeof import("../src/services/playlist-import").importPlaylist;
  parseInput: typeof import("../src/services/playlist-import").parsePlaylistImportInput;
  createTicket: typeof import("../src/services/playlist-import").createPlaylistImportTicket;
  maxBodyBytes: number;
  tokenA: string;
  tokenB: string;
};

type TrackBody = {
  externalId: string;
  type: string;
  title: string;
  artist: string;
  coverUrl: string | null;
};

function track(id: number | string, overrides: Partial<TrackBody> = {}): TrackBody {
  return {
    externalId: String(id),
    type: "SONG",
    title: `Track ${id}`,
    artist: `Artist ${id}`,
    coverUrl: `https://images.example.test/${id}.jpg`,
    ...overrides,
  };
}

function trustedTrack(item: TrackBody) {
  return {
    externalId: item.externalId,
    type: "SONG" as const,
    title: item.title,
    artist: item.artist,
    coverUrl: item.coverUrl,
  };
}

function body(tracks: unknown[], overrides: Record<string, unknown> = {}) {
  return {
    title: "Playlist importada",
    description: "Una playlist de prueba",
    tracks,
    ...overrides,
  };
}

function request(
  payload: unknown,
  token?: string,
  options: { rawBody?: string; contentType?: string; headers?: Record<string, string> } = {},
): Request {
  const headers = new Headers({
    "content-type": options.contentType ?? "application/json",
    ...options.headers,
  });
  if (token) headers.set("cookie", `token=${token}`);
  return new Request("http://localhost/api/lists/save-playlist", {
    method: "POST",
    headers,
    body: options.rawBody ?? JSON.stringify(payload),
  });
}

async function setup(): Promise<Context> {
  const dbUrl = "file::memory:?cache=shared";
  process.env.JWT_SECRET = TEST_SECRET;
  process.env.DATABASE_URL = dbUrl;
  process.env.TURSO_DATABASE_URL = dbUrl;
  delete process.env.TURSO_AUTH_TOKEN;

  const client = createClient({ url: dbUrl });
  const migrationsRoot = resolve(import.meta.dirname, "..", "prisma", "migrations");
  for (const name of ["00000000000000_baseline", "20260802183000_unique_current_rating", "20260804140000_revocable_sessions"]) {
    await client.executeMultiple(
      await readFile(resolve(migrationsRoot, name, "migration.sql"), "utf8"),
    );
  }
  await client.executeMultiple(`
    PRAGMA foreign_keys = ON;
    INSERT INTO "User" ("id", "username", "email", "password", "updatedAt") VALUES
      ('${USER_A_ID}', 'playlist-alice', 'playlist-alice@example.test', 'hash', CURRENT_TIMESTAMP),
      ('${USER_B_ID}', 'playlist-bob', 'playlist-bob@example.test', 'hash', CURRENT_TIMESTAMP);
    INSERT INTO "MusicItem" ("id", "title", "artist", "type", "coverUrl", "releaseYear") VALUES
      ('9001', 'Legacy song', 'Trusted artist', 'SONG', 'https://trusted.example/song.jpg', 2020),
      ('9002', 'Legacy album', 'Trusted artist', 'ALBUM', 'https://trusted.example/album.jpg', 2019),
      ('deezer:track:9003', 'Conflicting album', 'Trusted artist', 'ALBUM', 'https://trusted.example/conflict.jpg', 2018),
      ('deezer:track:9004', 'Namespaced song', 'Trusted artist', 'SONG', 'https://trusted.example/namespaced.jpg', 2021);
  `);

  const auth = await import("../src/utils/auth");
  const route = await import("../src/app/api/lists/save-playlist/route");
  const service = await import("../src/services/playlist-import");
  const { prisma } = await import("../src/services/db");

  return {
    client,
    prisma,
    post: route.POST,
    importPlaylist: service.importPlaylist,
    parseInput: service.parsePlaylistImportInput,
    createTicket: service.createPlaylistImportTicket,
    maxBodyBytes: service.MAX_PLAYLIST_IMPORT_BODY_BYTES,
    tokenA: await auth.signToken({ userId: USER_A_ID, username: "playlist-alice" }),
    tokenB: await auth.signToken({ userId: USER_B_ID, username: "playlist-bob" }),
  };
}

async function reset(context: Context): Promise<void> {
  for (const trigger of [
    "fail_playlist_music_item",
    "fail_playlist_list",
    "fail_playlist_relation",
  ]) {
    await context.client.execute(`DROP TRIGGER IF EXISTS "${trigger}"`);
  }
  await context.prisma.listItem.deleteMany();
  await context.prisma.list.deleteMany();
  await context.prisma.musicItem.deleteMany({
    where: {
      id: { notIn: ["9001", "9002", "deezer:track:9003", "deezer:track:9004"] },
    },
  });
}

async function post(
  context: Context,
  tracks: TrackBody[],
  token = context.tokenA,
  overrides: Record<string, unknown> = {},
) {
  const ticket = await context.createTicket(tracks.map(trustedTrack));
  return context.post(
    request(
      body(
        tracks.map((item) => ({ externalId: item.externalId, type: item.type })),
        { ticket, ...overrides },
      ),
      token,
    ),
  );
}

async function assertNoImportedState(context: Context): Promise<void> {
  assert.equal(await context.prisma.list.count(), 0);
  assert.equal(await context.prisma.listItem.count(), 0);
  assert.equal(
    await context.prisma.musicItem.count({ where: { id: { startsWith: "deezer:track:7" } } }),
    0,
  );
}

test("guardar playlists valida, deduplica y persiste atomicamente", async (t) => {
  const context = await setup();
  try {
    await t.test("acepta 1, varias y 100 pistas con propietario, orden y respuesta final", async () => {
      for (const size of [1, 4, 100]) {
        await reset(context);
        const response = await post(
          context,
          Array.from({ length: size }, (_, index) => track(1000 + index)),
        );
        assert.equal(response.status, 201);
        const payload = (await response.json()) as { list: { userId: string; items: Array<{ order: number; musicItemId: string }> } };
        assert.equal(payload.list.userId, USER_A_ID);
        assert.equal(payload.list.items.length, size);
        assert.deepEqual(payload.list.items.map((item) => item.order), Array.from({ length: size }, (_, index) => index));
        assert.equal(await context.prisma.list.count(), 1);
        assert.equal(await context.prisma.listItem.count(), size);
        assert.equal(await context.prisma.musicItem.count({ where: { id: { startsWith: "deezer:track:1" } } }), size);
      }
    });

    await t.test("rechaza 101 pistas y bodies enormes antes de cualquier escritura", async () => {
      await reset(context);
      const limitTicket = await context.createTicket([trustedTrack(track(2000))]);
      const tooMany = await context.post(
        request(
          body(
            Array.from({ length: 101 }, (_, index) => ({
              externalId: String(2000 + index),
              type: "SONG",
            })),
            { ticket: limitTicket },
          ),
          context.tokenA,
        ),
      );
      assert.equal(tooMany.status, 413);
      assert.equal((await tooMany.json()).code, "TRACK_LIMIT_EXCEEDED");
      await assertNoImportedState(context);

      const hugeText = "x".repeat(context.maxBodyBytes + 1);
      const huge = await context.post(
        request({}, context.tokenA, {
          rawBody: hugeText,
          headers: { "content-length": String(hugeText.length) },
        }),
      );
      assert.equal(huge.status, 413);
      assert.equal((await huge.json()).code, "BODY_TOO_LARGE");
      await assertNoImportedState(context);
    });

    await t.test("rechaza tipos, campos, anidamiento y JSON invalidos sin escribir", async () => {
      const validTicket = await context.createTicket([trustedTrack(track(3001))]);
      const invalidBodies: unknown[] = [
        null,
        [],
        body([], { ticket: validTicket }),
        body("not-an-array" as unknown as unknown[], { ticket: validTicket }),
        body([{ externalId: "3001", type: "SONG" }], { ticket: validTicket, userId: USER_B_ID }),
        body([{ externalId: "3001", type: "SONG", userId: USER_B_ID }], { ticket: validTicket }),
        body([{ externalId: 3001, type: "SONG" }], { ticket: validTicket }),
        body([{ externalId: "0", type: "SONG" }], { ticket: validTicket }),
        body([{ externalId: "3001", type: "ALBUM" }], { ticket: validTicket }),
        body([{ externalId: "3001", type: "SONG", title: { nested: "title" } }], { ticket: validTicket }),
        body([{ externalId: "3001", type: "SONG", artist: ["nested"] }], { ticket: validTicket }),
        body([{ externalId: "3001", type: "SONG", coverUrl: "http://insecure.example/cover.jpg" }], { ticket: validTicket }),
        body([{ externalId: "3001", type: "SONG", coverUrl: { album: { cover_xl: "deep" } } }], { ticket: validTicket }),
        body([{ externalId: "3001", type: "SONG", album: { cover_xl: "deep" } }], { ticket: validTicket }),
      ];

      for (const invalidBody of invalidBodies) {
        await reset(context);
        const response = await context.post(request(invalidBody, context.tokenA));
        assert.equal(response.status, 400);
        await assertNoImportedState(context);
      }

      const invalidJson = await context.post(
        request({}, context.tokenA, { rawBody: "{not-json" }),
      );
      assert.equal(invalidJson.status, 400);
      assert.equal((await invalidJson.json()).code, "INVALID_JSON");
      assert.equal(
        (await context.post(request(body([{ externalId: "3001", type: "SONG" }], { ticket: validTicket }), context.tokenA, { contentType: "text/plain" }))).status,
        400,
      );
      await assertNoImportedState(context);
    });

    await t.test("rechaza tickets alterados y pistas ajenas a la instantanea firmada", async () => {
      await reset(context);
      const ticket = await context.createTicket([trustedTrack(track(3101))]);
      const segments = ticket.split(".");
      segments[1] = `${segments[1][0] === "a" ? "b" : "a"}${segments[1].slice(1)}`;
      const tampered = await context.post(
        request(
          body([{ externalId: "3101", type: "SONG" }], { ticket: segments.join(".") }),
          context.tokenA,
        ),
      );
      assert.equal(tampered.status, 400);
      assert.equal((await tampered.json()).code, "INVALID_IMPORT_TICKET");

      const expiredTicket = await new SignJWT({ tracks: [trustedTrack(track(3101))] })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuer("musicbox")
        .setAudience("playlist-import")
        .setIssuedAt(Math.floor(Date.now() / 1000) - 120)
        .setExpirationTime(Math.floor(Date.now() / 1000) - 60)
        .sign(new TextEncoder().encode(TEST_SECRET));
      const expired = await context.post(
        request(
          body([{ externalId: "3101", type: "SONG" }], { ticket: expiredTicket }),
          context.tokenA,
        ),
      );
      assert.equal(expired.status, 400);
      assert.equal((await expired.json()).code, "INVALID_IMPORT_TICKET");

      const unauthorized = await context.post(
        request(
          body([{ externalId: "3102", type: "SONG" }], { ticket }),
          context.tokenA,
        ),
      );
      assert.equal(unauthorized.status, 400);
      assert.equal((await unauthorized.json()).code, "TRACK_NOT_AUTHORIZED");
      await assertNoImportedState(context);
    });

    await t.test("deduplica por identidad, conserva la primera metadata y no deduplica por titulo", async () => {
      await reset(context);
      const response = await post(context, [
        track(4001, { title: "First title" }),
        track(4001, { title: "Tampered second title" }),
        track(4002, { title: "Same visible title" }),
        track(4003, { title: "Same visible title" }),
      ]);
      assert.equal(response.status, 201);
      assert.equal(await context.prisma.listItem.count(), 3);
      assert.equal(
        (await context.prisma.musicItem.findUniqueOrThrow({ where: { id: "deezer:track:4001" } })).title,
        "First title",
      );

      await reset(context);
      const conflictingType = await post(context, [track(4004), track(4004, { type: "ALBUM" })]);
      assert.equal(conflictingType.status, 400);
      await assertNoImportedState(context);
    });

    await t.test("reutiliza MusicItems sin alterar metadata y separa colisiones ALBUM/SONG", async () => {
      await reset(context);
      const response = await post(context, [
        track(9001, { title: "Untrusted replacement" }),
        track(9002, { title: "Song with album id" }),
        track(9004, { title: "Untrusted namespaced replacement" }),
      ]);
      assert.equal(response.status, 201);
      const items = await context.prisma.musicItem.findMany({
        where: { id: { in: ["9001", "9002", "deezer:track:9002", "deezer:track:9004"] } },
        orderBy: { id: "asc" },
      });
      assert.equal(items.find((item) => item.id === "9001")?.title, "Legacy song");
      assert.equal(items.find((item) => item.id === "9002")?.type, "ALBUM");
      assert.equal(items.find((item) => item.id === "deezer:track:9002")?.type, "SONG");
      assert.equal(items.find((item) => item.id === "deezer:track:9004")?.title, "Namespaced song");

      await reset(context);
      const conflict = await post(context, [track(9003)]);
      assert.equal(conflict.status, 409);
      assert.equal((await conflict.json()).code, "MUSIC_ITEM_IDENTITY_CONFLICT");
      await assertNoImportedState(context);
    });

    await t.test("deriva siempre el propietario de la cookie firmada", async () => {
      await reset(context);
      assert.equal((await context.post(request(body([track(5001)])))).status, 401);
      assert.equal((await context.post(request(body([track(5001)]), "invalid-token"))).status, 401);
      assert.equal(await context.prisma.list.count(), 0);

      const forgedTicket = await context.createTicket([trustedTrack(track(5001))]);
      const forgedHeader = request(body([{ externalId: "5001", type: "SONG" }], { ticket: forgedTicket }), context.tokenA, {
        headers: { "x-user-id": USER_B_ID, "x-user": "playlist-bob" },
      });
      assert.equal((await context.post(forgedHeader)).status, 201);
      const list = await context.prisma.list.findFirstOrThrow();
      assert.equal(list.userId, USER_A_ID);
    });

    await t.test("revierte MusicItems, lista y relaciones ante fallos en cada etapa", async () => {
      const cases = [
        {
          trigger: `CREATE TRIGGER "fail_playlist_music_item" BEFORE INSERT ON "MusicItem"
            WHEN NEW."id" = 'deezer:track:7002'
            BEGIN SELECT RAISE(ABORT, 'injected music item failure'); END;`,
          tracks: [track(7001), track(7002)],
        },
        {
          trigger: `CREATE TRIGGER "fail_playlist_list" BEFORE INSERT ON "List"
            BEGIN SELECT RAISE(ABORT, 'injected list failure'); END;`,
          tracks: [track(7011), track(7012)],
        },
        {
          trigger: `CREATE TRIGGER "fail_playlist_relation" BEFORE INSERT ON "ListItem"
            WHEN NEW."order" = 1
            BEGIN SELECT RAISE(ABORT, 'injected middle relation failure'); END;`,
          tracks: [track(7021), track(7022), track(7023)],
        },
        {
          trigger: `CREATE TRIGGER "fail_playlist_relation" BEFORE INSERT ON "ListItem"
            WHEN NEW."order" = 2
            BEGIN SELECT RAISE(ABORT, 'injected final relation failure'); END;`,
          tracks: [track(7031), track(7032), track(7033)],
        },
      ];

      for (const failure of cases) {
        await reset(context);
        await context.client.executeMultiple(failure.trigger);
        const ticket = await context.createTicket(failure.tracks.map(trustedTrack));
        const parsed = await context.parseInput(
          body(
            failure.tracks.map((item) => ({ externalId: item.externalId, type: "SONG" })),
            { ticket },
          ),
        );
        await assert.rejects(() => context.importPlaylist(USER_A_ID, parsed, context.prisma));
        await assertNoImportedState(context);
      }
    });

    await t.test("importaciones concurrentes terminan completas y con ownership correcto", async () => {
      await reset(context);
      const sharedTracks = [track(8001), track(8002), track(8003)];
      const sameUser = await Promise.all([
        post(context, sharedTracks),
        post(context, sharedTracks),
      ]);
      assert.deepEqual(sameUser.map((response) => response.status), [201, 201]);
      assert.equal(await context.prisma.list.count({ where: { userId: USER_A_ID } }), 2);
      assert.equal(await context.prisma.listItem.count(), 6);
      assert.equal(await context.prisma.musicItem.count({ where: { id: { startsWith: "deezer:track:8" } } }), 3);
      const grouped = await context.prisma.list.findMany({ include: { items: true } });
      assert.ok(grouped.every((list) => list.items.length === 3));

      await reset(context);
      const differentUsers = await Promise.all([
        post(context, sharedTracks, context.tokenA),
        post(context, sharedTracks, context.tokenB),
      ]);
      assert.deepEqual(differentUsers.map((response) => response.status), [201, 201]);
      const owners = (await context.prisma.list.findMany()).map((list) => list.userId).sort();
      assert.deepEqual(owners, [USER_A_ID, USER_B_ID].sort());
      assert.equal(await context.prisma.listItem.count(), 6);
      assert.equal(await context.prisma.musicItem.count({ where: { id: { startsWith: "deezer:track:8" } } }), 3);
    });

    await t.test("el limite de listas esta dentro de la transaccion", async () => {
      await reset(context);
      await context.prisma.list.createMany({
        data: Array.from({ length: 50 }, (_, index) => ({
          title: `Existing ${index}`,
          isPublic: true,
          userId: USER_A_ID,
        })),
      });
      const response = await post(context, [track(8501)]);
      assert.equal(response.status, 403);
      assert.equal((await response.json()).code, "LIST_LIMIT_EXCEEDED");
      assert.equal(await context.prisma.list.count({ where: { userId: USER_A_ID } }), 50);
      assert.equal(await context.prisma.musicItem.count({ where: { id: "deezer:track:8501" } }), 0);
    });

    await t.test("dos imports concurrentes desde 49 listas no superan el maximo", async () => {
      await reset(context);
      await context.prisma.list.createMany({
        data: Array.from({ length: 49 }, (_, index) => ({
          title: `Existing concurrent ${index}`,
          isPublic: true,
          userId: USER_A_ID,
        })),
      });
      const responses = await Promise.all([
        post(context, [track(8551)]),
        post(context, [track(8552)]),
      ]);
      assert.deepEqual(responses.map((response) => response.status).sort(), [201, 403]);
      assert.equal(await context.prisma.list.count({ where: { userId: USER_A_ID } }), 50);
      assert.equal(await context.prisma.listItem.count(), 1);
      assert.equal(
        await context.prisma.musicItem.count({
          where: { id: { in: ["deezer:track:8551", "deezer:track:8552"] } },
        }),
        1,
      );
    });

    await t.test("la cantidad de consultas permanece acotada para 1 y 100 pistas", async () => {
      await reset(context);
      const adapter = new PrismaLibSql({ url: "file::memory:?cache=shared" });
      const monitored = new PrismaClient({
        adapter,
        log: [{ emit: "event", level: "query" }],
      });
      let queryCount = 0;
      monitored.$on("query", () => {
        queryCount += 1;
      });

      try {
        const counts: number[] = [];
        for (const [start, size] of [[8600, 1], [8700, 100]] as const) {
          await reset(context);
          queryCount = 0;
          const sourceTracks = Array.from({ length: size }, (_, index) => track(start + index));
          const ticket = await context.createTicket(sourceTracks.map(trustedTrack));
          const parsed = await context.parseInput(
            body(
              sourceTracks.map((item) => ({ externalId: item.externalId, type: "SONG" })),
              { ticket },
            ),
          );
          const startedAt = performance.now();
          await context.importPlaylist(USER_A_ID, parsed, monitored);
          const elapsedMs = performance.now() - startedAt;
          assert.ok(elapsedMs < 5_000, `import de ${size} pistas tardo ${elapsedMs}ms`);
          counts.push(queryCount);
        }
        assert.ok(counts[0] > 0, "el cliente debe emitir eventos de consulta");
        assert.ok(counts[0] <= 8, `1 pista ejecuto ${counts[0]} consultas`);
        assert.ok(counts[1] <= 8, `100 pistas ejecutaron ${counts[1]} consultas`);
        assert.ok(Math.abs(counts[1] - counts[0]) <= 1, `conteos no acotados: ${counts.join(", ")}`);
        if (process.env.REPORT_PLAYLIST_QUERY_COUNTS === "1") {
          console.log(`playlist-query-counts: ${counts.join(",")}`);
        }
      } finally {
        await monitored.$disconnect();
      }
    });
  } finally {
    await context.prisma.$disconnect();
    context.client.close();
  }
});
