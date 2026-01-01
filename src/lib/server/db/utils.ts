import { customType } from 'drizzle-orm/sqlite-core';

/**
 * Custom SQLite text enum with runtime and database-level validation
 * Based on: https://www.answeroverflow.com/m/1111315266761138176
 */
export const textEnum = <V extends Record<string, string>, RV = V[keyof V]>(
	columnName: string,
	enumObj: V,
	message?: string
) => {
	const values = Object.values(enumObj);
	const colFn = customType<{
		data: string;
		driverData: string;
	}>({
		dataType() {
			// Adding CHECK constraint for DB-level enforcement
			return `text CHECK(${columnName} IN (${values.map((v) => `'${v}'`).join(', ')}))`;
		},
		toDriver(value: string): string {
			if (!values.includes(value)) {
				throw new Error(
					message ??
						`Invalid value for column ${columnName}. Expected: ${values.join(', ')} | Found: ${value}`
				);
			}
			return value;
		}
	});
	return colFn(columnName).$type<RV>();
};
