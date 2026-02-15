import { TasksSettingsRepository } from "../../server/repositories/settings-repository";
import { json, error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ locals }) => {
  const userId = locals.user?.id;
  if (!userId) throw error(401, "Unauthorized");

  const repo = new TasksSettingsRepository();
  const settings = await repo.getByUserId(userId);
  return json(settings);
};

export const PUT: RequestHandler = async ({ locals, request }) => {
  const userId = locals.user?.id;
  if (!userId) throw error(401, "Unauthorized");

  const data = await request.json();
  const repo = new TasksSettingsRepository();
  const updated = await repo.update(userId, data);

  if (!updated) throw error(404, "Not found");
  return json(updated);
};
