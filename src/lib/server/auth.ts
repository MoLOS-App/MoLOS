import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { sveltekitCookies } from 'better-auth/svelte-kit';
import { getRequestEvent } from '$app/server';
import { db } from '$lib/server/db'; // your drizzle instance
import * as schema from '$lib/server/db/schema';
import { env } from '$env/dynamic/private';
import { admin, apiKey } from 'better-auth/plugins';
import { sql } from 'drizzle-orm';

export const auth = betterAuth({
	secret: env.BETTER_AUTH_SECRET,
	database: drizzleAdapter(db, {
		provider: 'sqlite', // or "mysql", "sqlite"
		schema
	}),
	user: {
		deleteUser: {
			enabled: true
		}
	},
	emailAndPassword: {
		enabled: true
	},
	plugins: [
		sveltekitCookies(getRequestEvent),
		admin(),
		apiKey({
			enableSessionForAPIKeys: true
		})
	],
	databaseHooks: {
		user: {
			create: {
				after: async (user) => {
					// Check if this is the first user
					const userCountResult = await db.all(sql`SELECT count(*) as count FROM user`);
					const userCount = (userCountResult[0] as unknown as { count: number }).count;

					if (userCount === 1) {
						// Promote first user to admin
						await db
							.update(schema.user)
							.set({ role: 'admin' })
							.where(sql`id = ${user.id}`);
					}
				}
			}
		}
	}
});
