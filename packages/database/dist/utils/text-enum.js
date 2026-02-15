import { customType } from 'drizzle-orm/sqlite-core';
/**
 * Custom SQLite text enum with runtime and database-level validation
 * Based on: https://www.answeroverflow.com/m/1111315266761138176
 */
export const textEnum = (columnName, enumObj, message) => {
    const values = Object.values(enumObj);
    const colFn = customType({
        dataType() {
            // Adding CHECK constraint for DB-level enforcement
            return `text CHECK(${columnName} IN (${values.map((v) => `'${v}'`).join(', ')}))`;
        },
        toDriver(value) {
            if (!values.includes(value)) {
                throw new Error(message ??
                    `Invalid value for column ${columnName}. Expected: ${values.join(', ')} | Found: ${value}`);
            }
            return value;
        }
    });
    return colFn(columnName).$type();
};
