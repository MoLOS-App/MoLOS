import { ProjectRepository } from "../../server/repositories/project-repository";
import { json, error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { db } from "$lib/server/db";

/**
 * GET /api/projects
 * Returns the list of all projects for the authenticated user
 */
export const GET: RequestHandler = async ({ locals }) => {
  const userId = locals.user?.id;
  if (!userId) {
    throw error(401, "Unauthorized");
  }

  try {
    const projectRepo = new ProjectRepository(db);
    const projects = await projectRepo.getByUserId(userId, 100);
    return json(projects);
  } catch (err) {
    console.error("Failed to fetch projects:", err);
    throw error(500, "Internal server error");
  }
};

/**
 * POST /api/projects
 * Creates a new project
 * Expected JSON body: { name: string, description?: string, status?: string, areaId?: string, startDate?: number, endDate?: number }
 */
export const POST: RequestHandler = async ({ locals, request }) => {
  const userId = locals.user?.id;
  if (!userId) {
    throw error(401, "Unauthorized");
  }

  try {
    const { name, description, status, areaId, startDate, endDate } =
      await request.json();

    if (!name) {
      throw error(400, "Name is required");
    }

    const projectRepo = new ProjectRepository(db);
    const project = await projectRepo.create({
      userId,
      name,
      description,
      status: status || "planning",
      areaId,
      startDate,
      endDate,
    });

    return json(project, { status: 201 });
  } catch (err) {
    console.error("Failed to create project:", err);
    if (err instanceof Error && "status" in err) {
      throw err;
    }
    throw error(500, "Internal server error");
  }
};

/**
 * PUT /api/projects
 * Updates an existing project
 */
export const PUT: RequestHandler = async ({ locals, request }) => {
  const userId = locals.user?.id;
  if (!userId) {
    throw error(401, "Unauthorized");
  }

  try {
    const { id, ...updates } = await request.json();

    if (!id) {
      throw error(400, "Project id is required");
    }

    const projectRepo = new ProjectRepository(db);
    const project = await projectRepo.update(id, userId, updates);

    if (!project) {
      throw error(404, "Project not found");
    }

    return json(project);
  } catch (err) {
    console.error("Failed to update project:", err);
    if (err instanceof Error && "status" in err) {
      throw err;
    }
    throw error(500, "Internal server error");
  }
};

/**
 * DELETE /api/projects
 * Deletes a project
 */
export const DELETE: RequestHandler = async ({ locals, request }) => {
  const userId = locals.user?.id;
  if (!userId) {
    throw error(401, "Unauthorized");
  }

  try {
    const { id } = await request.json();

    if (!id) {
      throw error(400, "Project id is required");
    }

    const projectRepo = new ProjectRepository(db);
    const deleted = await projectRepo.delete(id, userId);

    if (!deleted) {
      throw error(404, "Project not found");
    }

    return json({ success: true });
  } catch (err) {
    console.error("Failed to delete project:", err);
    if (err instanceof Error && "status" in err) {
      throw err;
    }
    throw error(500, "Internal server error");
  }
};
