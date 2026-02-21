/**
 * Custom SQLite text enum with runtime and database-level validation
 * Based on: https://www.answeroverflow.com/m/1111315266761138176
 *
 * Features:
 * - Case-insensitive matching: "running" matches "Running"
 * - Helpful error messages with suggestions for typos
 */
export declare const textEnum: <V extends Record<string, string>, RV = V[keyof V]>(columnName: string, enumObj: V, message?: string) => import("drizzle-orm").$Type<import("drizzle-orm/sqlite-core").SQLiteCustomColumnBuilder<{
    name: string;
    dataType: "custom";
    columnType: "SQLiteCustomColumn";
    data: string;
    driverParam: string;
    enumValues: undefined;
}>, RV>;
//# sourceMappingURL=text-enum.d.ts.map