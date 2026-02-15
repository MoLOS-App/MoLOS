import { error } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";

const fetchJson = async <T>(
  fetch: PageServerLoad["fetch"],
  url: string,
  label: string,
): Promise<T> => {
  const res = await fetch(url);
  if (!res.ok) {
    throw error(res.status, `Failed to fetch ${label}`);
  }
  return await res.json();
};

export const load: PageServerLoad = async ({ fetch }) => {
  const settings = await fetchJson(fetch, "/api/MoLOS-Tasks/settings", "tasks settings");

  return { settings };
};
