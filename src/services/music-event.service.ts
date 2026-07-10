import { MusicEventRepository } from "../repositories/music-event.repository";
import { NotFoundError } from "../utils/errors";
import type { MusicEvent } from "@prisma/client";

export class MusicEventService {
  private repository: MusicEventRepository;

  constructor() {
    this.repository = new MusicEventRepository();
  }

  async getTodayEvent(): Promise<MusicEvent | null> {
    const today = new Date();
    // Use server timezone date
    const month = today.getMonth() + 1;
    const day = today.getDate();

    return this.repository.findByDate(month, day);
  }

  async getTodayEventOrThrow(): Promise<MusicEvent> {
    const event = await this.getTodayEvent();
    if (!event) {
      throw new NotFoundError("No music event found for today.");
    }
    return event;
  }
}
