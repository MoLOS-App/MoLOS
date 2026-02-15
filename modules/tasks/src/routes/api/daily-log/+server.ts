import { DailyLogRepository } from "../../server/repositories/daily-log-repository";
import { json, error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

/**
 * GET /api/MoLOS-Tasks/daily-log
 * Returns the list of all daily logs for the authenticated user
 */
export const GET: RequestHandler = async ({ locals }) => {
  const userId = locals.user?.id;
  if (!userId) {
    throw error(401, "Unauthorized");
  }

  try {
    const dailyLogRepo = new DailyLogRepository();
    const logs = await dailyLogRepo.getByUserId(userId);
    return json(logs);
  } catch (err) {
    console.error("Failed to fetch daily logs:", err);
    throw error(500, "Internal server error");
  }
};

/**
 * POST /api/MoLOS-Tasks/daily-log
 * Creates a new daily log
 * Expected JSON body: { logDate: number, mood?: string, sleepHours?: number, morningRoutine?: boolean, eveningRoutine?: boolean, notes?: string }
 */
export const POST: RequestHandler = async ({ locals, request }) => {
  const userId = locals.user?.id;
  if (!userId) {
    throw error(401, "Unauthorized");
  }

  try {
    const { logDate, mood, sleepHours, morningRoutine, eveningRoutine, notes } =
      await request.json();

    if (!logDate) {
      throw error(400, "Log date is required");
    }

    const dailyLogRepo = new DailyLogRepository();
    const log = await dailyLogRepo.create({
      userId,
      logDate,
      mood,
      sleepHours,
      morningRoutine: morningRoutine || false,
      eveningRoutine: eveningRoutine || false,
      notes,
    });

    return json(log, { status: 201 });
  } catch (err) {
    console.error("Failed to create daily log:", err);
    if (err instanceof Error && "status" in err) {
      throw err;
    }
    throw error(500, "Internal server error");
  }
};

/**
 * PUT /api/MoLOS-Tasks/daily-log
 * Updates an existing daily log
 */
export const PUT: RequestHandler = async ({ locals, request }) => {
  const userId = locals.user?.id;
  if (!userId) {
    throw error(401, "Unauthorized");
  }

  try {
    const { logDate, ...updates } = await request.json();

    if (!logDate) {
      throw error(400, "Log date is required");
    }

    const dailyLogRepo = new DailyLogRepository();
    const log = await dailyLogRepo.update(userId, logDate, updates);

    if (!log) {
      throw error(404, "Daily log not found");
    }

    return json(log);
  } catch (err) {
    console.error("Failed to update daily log:", err);
    if (err instanceof Error && "status" in err) {
      throw err;
    }
    throw error(500, "Internal server error");
  }
};

/**
 * DELETE /api/MoLOS-Tasks/daily-log
 * Deletes a daily log
 */
export const DELETE: RequestHandler = async ({ locals, request }) => {
  const userId = locals.user?.id;
  if (!userId) {
    throw error(401, "Unauthorized");
  }

  try {
    const { logDate } = await request.json();

    if (!logDate) {
      throw error(400, "Log date is required");
    }

    const dailyLogRepo = new DailyLogRepository();
    const success = await dailyLogRepo.delete(userId, logDate);

    if (!success) {
      throw error(404, "Daily log not found");
    }

    return json({ success: true });
  } catch (err) {
    console.error("Failed to delete daily log:", err);
    if (err instanceof Error && "status" in err) {
      throw err;
    }
    throw error(500, "Internal server error");
  }
};
