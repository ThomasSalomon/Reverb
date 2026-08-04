import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/services/db";

const MAX_TRANSACTION_ATTEMPTS = 3;
const MAX_COMMENT_LENGTH = 500;
const OPERATION_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type SocialActionStatus = 400 | 404 | 409;

export class SocialActionError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: SocialActionStatus,
  ) {
    super(message);
    this.name = "SocialActionError";
  }
}

export type CreateCommentInput = Readonly<{
  content: string;
  operationId: string | null;
}>;

function isPrismaError(error: unknown, code: string): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === code
  );
}

function isRetryableTransactionError(error: unknown): boolean {
  if (isPrismaError(error, "P2034")) return true;
  if (typeof error !== "object" || error === null || !("message" in error)) return false;
  const message = String(error.message);
  return message.includes("SQLITE_BUSY") || message.includes("database is locked");
}

async function delay(milliseconds: number): Promise<void> {
  await new Promise((resolveDelay) => setTimeout(resolveDelay, milliseconds));
}

async function retryTransaction<T>(operation: () => Promise<T>): Promise<T> {
  for (let attempt = 0; attempt < MAX_TRANSACTION_ATTEMPTS; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      if (
        !isRetryableTransactionError(error) ||
        attempt === MAX_TRANSACTION_ATTEMPTS - 1
      ) {
        throw error;
      }
      await delay(5 * (attempt + 1));
    }
  }

  throw new Error("Unreachable social action retry state");
}

async function findFollowTarget(
  username: string,
  actorId: string,
  client: PrismaClient,
) {
  const target = await client.user.findUnique({
    where: { username },
    select: { id: true, username: true },
  });
  if (!target) {
    throw new SocialActionError("USER_NOT_FOUND", "Usuario no encontrado", 404);
  }
  if (target.id === actorId) {
    throw new SocialActionError("SELF_FOLLOW", "No puedes seguirte a ti mismo", 400);
  }
  return target;
}

async function currentFollowState(
  actorId: string,
  targetId: string,
  client: PrismaClient,
) {
  const [follow, followersCount] = await Promise.all([
    client.follow.findUnique({
      where: {
        followerId_followingId: { followerId: actorId, followingId: targetId },
      },
      select: { id: true },
    }),
    client.follow.count({ where: { followingId: targetId } }),
  ]);
  return { following: Boolean(follow), followersCount };
}

async function findReview(reviewId: string, client: PrismaClient) {
  const review = await client.review.findUnique({
    where: { id: reviewId },
    select: { id: true, userId: true, musicItemId: true },
  });
  if (!review) {
    throw new SocialActionError("REVIEW_NOT_FOUND", "Reseña no encontrada", 404);
  }
  return review;
}

async function currentLikeState(
  actorId: string,
  reviewId: string,
  client: PrismaClient,
) {
  const [like, likesCount] = await Promise.all([
    client.reviewLike.findUnique({
      where: { userId_reviewId: { userId: actorId, reviewId } },
      select: { userId: true },
    }),
    client.reviewLike.count({ where: { reviewId } }),
  ]);
  return { liked: Boolean(like), likesCount };
}

const commentInclude = {
  user: {
    select: {
      username: true,
      profileColor: true,
      profileImage: true,
    },
  },
} satisfies Prisma.CommentInclude;

type CommentWithUser = Prisma.CommentGetPayload<{ include: typeof commentInclude }>;

function sameCommentOperation(
  comment: Pick<CommentWithUser, "reviewId" | "content">,
  reviewId: string,
  content: string,
): boolean {
  return comment.reviewId === reviewId && comment.content === content;
}

async function findExistingCommentOperation(
  actorId: string,
  operationId: string,
  client: PrismaClient,
) {
  return client.comment.findUnique({
    where: { userId_operationId: { userId: actorId, operationId } },
    include: commentInclude,
  });
}

export function parseCreateCommentInput(value: unknown): CreateCommentInput {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new SocialActionError("INVALID_BODY", "El body debe ser un objeto JSON", 400);
  }
  const record = value as Record<string, unknown>;
  const unknown = Object.keys(record).filter(
    (key) => key !== "content" && key !== "operationId",
  );
  if (unknown.length > 0) {
    throw new SocialActionError(
      "UNKNOWN_FIELD",
      `Campos no permitidos: ${unknown.join(", ")}`,
      400,
    );
  }
  if (typeof record.content !== "string") {
    throw new SocialActionError("INVALID_COMMENT", "El contenido es requerido", 400);
  }
  const content = record.content.trim();
  if (content.length === 0 || content.length > MAX_COMMENT_LENGTH) {
    throw new SocialActionError(
      "INVALID_COMMENT",
      `El contenido debe tener entre 1 y ${MAX_COMMENT_LENGTH} caracteres`,
      400,
    );
  }

  if (record.operationId === undefined || record.operationId === null) {
    return { content, operationId: null };
  }
  if (
    typeof record.operationId !== "string" ||
    !OPERATION_ID_PATTERN.test(record.operationId)
  ) {
    throw new SocialActionError(
      "INVALID_OPERATION_ID",
      "operationId debe ser un UUID válido",
      400,
    );
  }
  return { content, operationId: record.operationId.toLowerCase() };
}

export const SocialActionService = {
  async follow(
    actor: { userId: string; username: string },
    targetUsername: string,
    client: PrismaClient = prisma,
  ) {
    const target = await findFollowTarget(targetUsername, actor.userId, client);
    try {
      return await retryTransaction(() =>
        client.$transaction(async (tx) => {
          await tx.follow.create({
            data: { followerId: actor.userId, followingId: target.id },
          });
          await tx.notification.create({
            data: {
              userId: target.id,
              sourceUserId: actor.userId,
              type: "NEW_FOLLOWER",
              message: `${actor.username} ha comenzado a seguirte.`,
              link: `/users/${actor.username}`,
            },
          });
          const followersCount = await tx.follow.count({
            where: { followingId: target.id },
          });
          return { following: true, changed: true, followersCount } as const;
        }),
      );
    } catch (error) {
      if (!isPrismaError(error, "P2002")) throw error;
      const state = await currentFollowState(actor.userId, target.id, client);
      if (!state.following) throw error;
      return { ...state, changed: false } as const;
    }
  },

  async unfollow(
    actorId: string,
    targetUsername: string,
    client: PrismaClient = prisma,
  ) {
    const target = await findFollowTarget(targetUsername, actorId, client);
    return retryTransaction(() =>
      client.$transaction(async (tx) => {
        const deleted = await tx.follow.deleteMany({
          where: { followerId: actorId, followingId: target.id },
        });
        const followersCount = await tx.follow.count({
          where: { followingId: target.id },
        });
        return {
          following: false,
          changed: deleted.count === 1,
          followersCount,
        } as const;
      }),
    );
  },

  async like(
    actor: { userId: string; username: string },
    reviewId: string,
    client: PrismaClient = prisma,
  ) {
    const review = await findReview(reviewId, client);
    try {
      return await retryTransaction(() =>
        client.$transaction(async (tx) => {
          await tx.reviewLike.create({
            data: { userId: actor.userId, reviewId },
          });
          if (review.userId !== actor.userId) {
            await tx.notification.create({
              data: {
                userId: review.userId,
                sourceUserId: actor.userId,
                type: "NEW_LIKE",
                message: `${actor.username} le ha dado like a tu reseña.`,
                link: `/albums/${review.musicItemId}`,
              },
            });
          }
          const likesCount = await tx.reviewLike.count({ where: { reviewId } });
          return { liked: true, changed: true, likesCount } as const;
        }),
      );
    } catch (error) {
      if (!isPrismaError(error, "P2002")) throw error;
      const state = await currentLikeState(actor.userId, reviewId, client);
      if (!state.liked) throw error;
      return { ...state, changed: false } as const;
    }
  },

  async unlike(
    actorId: string,
    reviewId: string,
    client: PrismaClient = prisma,
  ) {
    await findReview(reviewId, client);
    return retryTransaction(() =>
      client.$transaction(async (tx) => {
        const deleted = await tx.reviewLike.deleteMany({
          where: { userId: actorId, reviewId },
        });
        const likesCount = await tx.reviewLike.count({ where: { reviewId } });
        return { liked: false, changed: deleted.count === 1, likesCount } as const;
      }),
    );
  },

  async comment(
    actor: { userId: string; username: string },
    reviewId: string,
    input: CreateCommentInput,
    client: PrismaClient = prisma,
  ): Promise<{ comment: CommentWithUser; changed: boolean; commentsCount: number }> {
    try {
      return await retryTransaction(() =>
        client.$transaction(async (tx) => {
          const review = await tx.review.findUnique({
            where: { id: reviewId },
            select: { userId: true, musicItemId: true },
          });
          if (!review) {
            throw new SocialActionError(
              "REVIEW_NOT_FOUND",
              "Reseña no encontrada",
              404,
            );
          }

          if (input.operationId) {
            const existing = await tx.comment.findUnique({
              where: {
                userId_operationId: {
                  userId: actor.userId,
                  operationId: input.operationId,
                },
              },
              include: commentInclude,
            });
            if (existing) {
              if (!sameCommentOperation(existing, reviewId, input.content)) {
                throw new SocialActionError(
                  "IDEMPOTENCY_CONFLICT",
                  "operationId ya fue utilizado con otro comentario",
                  409,
                );
              }
              const commentsCount = await tx.comment.count({ where: { reviewId } });
              return { comment: existing, changed: false, commentsCount };
            }
          }

          const comment = await tx.comment.create({
            data: {
              content: input.content,
              operationId: input.operationId,
              userId: actor.userId,
              reviewId,
            },
            include: commentInclude,
          });
          if (review.userId !== actor.userId) {
            await tx.notification.create({
              data: {
                userId: review.userId,
                sourceUserId: actor.userId,
                type: "NEW_COMMENT",
                message: `${actor.username} ha comentado en tu reseña.`,
                link: `/albums/${review.musicItemId}`,
              },
            });
          }
          const commentsCount = await tx.comment.count({ where: { reviewId } });
          return { comment, changed: true, commentsCount };
        }),
      );
    } catch (error) {
      if (!input.operationId || !isPrismaError(error, "P2002")) throw error;
      const existing = await findExistingCommentOperation(
        actor.userId,
        input.operationId,
        client,
      );
      if (!existing) throw error;
      if (!sameCommentOperation(existing, reviewId, input.content)) {
        throw new SocialActionError(
          "IDEMPOTENCY_CONFLICT",
          "operationId ya fue utilizado con otro comentario",
          409,
        );
      }
      const commentsCount = await client.comment.count({ where: { reviewId } });
      return { comment: existing, changed: false, commentsCount };
    }
  },
};

