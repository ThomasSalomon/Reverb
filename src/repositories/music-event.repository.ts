import { prisma } from "../services/db";
import type { MusicEvent } from "@prisma/client";

export class MusicEventRepository {
  async findByDate(month: number, day: number): Promise<MusicEvent | null> {
    return prisma.musicEvent.findFirst({
      where: {
        dateMonth: month,
        dateDay: day,
      },
    });
  }

  async findById(id: string): Promise<MusicEvent | null> {
    return prisma.musicEvent.findUnique({
      where: { id },
    });
  }
}
