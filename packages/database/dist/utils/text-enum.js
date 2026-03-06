import { customType } from 'drizzle-orm/sqlite-core';
/**
 * Custom SQLite text enum with runtime and database-level validation
 * Based on: https://www.answeroverflow.com/m/1111315266761138176
 *
 * Features:
 * - Case-insensitive matching: "running" matches "Running"
 * - Helpful error messages with suggestions for typos
 */
export const textEnum = (columnName, enumObj, message) => {
    const values = Object.values(enumObj);
    // Create a case-insensitive lookup map
    const caseInsensitiveMap = new Map();
    for (const val of values) {
        caseInsensitiveMap.set(val.toLowerCase(), val);
    }
    const colFn = customType({
        dataType() {
            // Adding CHECK constraint for DB-level enforcement
            return `text CHECK(${columnName} IN (${values.map((v) => `'${v}'`).join(', ')}))`;
        },
        toDriver(value) {
            // Exact match first
            if (values.includes(value)) {
                return value;
            }
            // Case-insensitive match (e.g., "running" -> "Running")
            const lowerValue = value.toLowerCase();
            if (caseInsensitiveMap.has(lowerValue)) {
                return caseInsensitiveMap.get(lowerValue);
            }
            // Find similar values for helpful error message
            const suggestions = findSimilarValues(value, values);
            throw new Error(message ??
                `Invalid value for column ${columnName}. Expected: ${values.join(', ')} | Found: ${value}${suggestions.length > 0 ? ` | Did you mean: ${suggestions.join(', ')}?` : ''}`);
        }
    });
    return colFn(columnName).$type();
};
/**
 * Find similar enum values using simple string similarity
 * Returns values that start with the same letter or have similar length
 */
function findSimilarValues(input, validValues) {
    const inputLower = input.toLowerCase();
    const suggestions = [];
    for (const val of validValues) {
        const valLower = val.toLowerCase();
        let score = 0;
        // Exact case-insensitive match (shouldn't happen but just in case)
        if (valLower === inputLower) {
            return [val];
        }
        // Starts with same letter
        if (valLower[0] === inputLower[0]) {
            score += 2;
        }
        // Contains the input or vice versa
        if (valLower.includes(inputLower) || inputLower.includes(valLower)) {
            score += 3;
        }
        // Similar length
        const lengthDiff = Math.abs(val.length - input.length);
        if (lengthDiff <= 1) {
            score += 2;
        }
        else if (lengthDiff <= 3) {
            score += 1;
        }
        // Levenshtein-like character matching
        const commonChars = countCommonChars(inputLower, valLower);
        score += commonChars * 0.5;
        if (score >= 2) {
            suggestions.push({ value: val, score });
        }
    }
    // Sort by score descending and return top suggestions
    return suggestions
        .sort((a, b) => b.score - a.score)
        .slice(0, 3)
        .map((s) => s.value);
}
/**
 * Count common characters in sequence between two strings
 */
function countCommonChars(a, b) {
    const bChars = b.split('');
    let count = 0;
    let lastIndex = -1;
    for (const char of a) {
        const index = bChars.indexOf(char, lastIndex + 1);
        if (index > lastIndex) {
            count++;
            lastIndex = index;
        }
    }
    return count;
}
