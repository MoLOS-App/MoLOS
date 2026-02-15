import { AreaRepository } from "../../server/repositories/area-repository";
import { json, error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

/**
 * GET /api/areas
 * Returns the list of all areas for the authenticated user
 */
export const GET: RequestHandler = async ({ locals }) => {
  const userId = locals.user?.id;
  if (!userId) {
    throw error(401, "Unauthorized");
  }

  try {
    const areaRepo = new AreaRepository();
    const areas = await areaRepo.getByUserId(userId);
    return json(areas);
  } catch (err) {
    console.error("Failed to fetch areas:", err);
    throw error(500, "Internal server error");
  }
};

/**
 * POST /api/areas
 * Creates a new area
 * Expected JSON body: { name: string, themeColor?: string, description?: string }
 */
export const POST: RequestHandler = async ({ locals, request }) => {
  const userId = locals.user?.id;
  if (!userId) {
    throw error(401, "Unauthorized");
  }

  try {
    const { name, themeColor, description } = await request.json();

    if (!name) {
      throw error(400, "Name is required");
    }

    const areaRepo = new AreaRepository();
    const area = await areaRepo.create({
      userId,
      name,
      themeColor,
      description,
    });

    return json(area, { status: 201 });
  } catch (err) {
    console.error("Failed to create area:", err);
    if (err instanceof Error && "status" in err) {
      throw err;
    }
    throw error(500, "Internal server error");
  }
};

/**
 * PUT /api/areas
 * Updates an existing area
 */
export const PUT: RequestHandler = async ({ locals, request }) => {
  const userId = locals.user?.id;
  if (!userId) {
    throw error(401, "Unauthorized");
  }

  try {
    const { id, ...updates } = await request.json();

    if (!id) {
      throw error(400, "Area id is required");
    }

    const areaRepo = new AreaRepository();
    const area = await areaRepo.update(id, userId, updates);

    if (!area) {
      throw error(404, "Area not found");
    }

    return json(area);
  } catch (err) {
    console.error("Failed to update area:", err);
    if (err instanceof Error && "status" in err) {
      throw err;
    }
    throw error(500, "Internal server error");
  }
};

/**
 * DELETE /api/areas
 * Deletes an area
 */
export const DELETE: RequestHandler = async ({ locals, request }) => {
  const userId = locals.user?.id;
  if (!userId) {
    throw error(401, "Unauthorized");
  }

  try {
    const { id } = await request.json();

    if (!id) {
      throw error(400, "Area id is required");
    }

    const areaRepo = new AreaRepository();
    const deleted = await areaRepo.delete(id, userId);

    if (!deleted) {
      throw error(404, "Area not found");
    }

    return json({ success: true });
  } catch (err) {
    console.error("Failed to delete area:", err);
    if (err instanceof Error && "status" in err) {
      throw err;
    }
    throw error(500, "Internal server error");
  }
};
