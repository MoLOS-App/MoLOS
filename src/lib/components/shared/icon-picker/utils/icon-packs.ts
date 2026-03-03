/**
 * Icon pack plugin system for icon picker
 * Allows extensible icon pack registration
 */

import type { Component } from 'svelte';

/**
 * Represents a single icon entry in an icon pack
 */
export interface IconEntry {
	id: string; // Unique identifier (e.g., 'SquareCheck')
	component: Component<any, any, any>; // Svelte icon component
	keywords: string[]; // Search keywords for filtering
}

/**
 * Icon pack interface
 * All icon packs must implement this interface
 */
export interface IconPack {
	id: string; // Pack identifier (e.g., 'lucide')
	name: string; // Display name (e.g., 'Lucide Icons')
	getIcons(): IconEntry[]; // Returns array of icon entries
}

/**
 * Registry for all icon packs
 */
const iconPacks = new Map<string, IconPack>();

// Import and register Lucide icon pack synchronously
import { lucideIconPack } from './lucide-pack.js';
registerIconPack(lucideIconPack);

/**
 * Register a new icon pack
 */
export function registerIconPack(pack: IconPack): void {
	iconPacks.set(pack.id, pack);
}

/**
 * Get an icon pack by ID
 */
export function getIconPack(id: string): IconPack | undefined {
	return iconPacks.get(id);
}

/**
 * Get all registered icon packs
 */
export function getAllIconPacks(): IconPack[] {
	return Array.from(iconPacks.values());
}

/**
 * Get all icons from all packs
 */
export function getAllIcons(): IconEntry[] {
	return Array.from(iconPacks.values()).flatMap((pack) => pack.getIcons());
}

/**
 * Search icons by keywords across all packs
 */
export function searchIcons(query: string): IconEntry[] {
	const lowerQuery = query.toLowerCase();
	const icons = getAllIcons();

	console.log('[icon-packs] searchIcons called with query:', query, 'found icons:', icons.length);

	return icons.filter((icon) => {
		// Search by icon ID
		if (icon.id.toLowerCase().includes(lowerQuery)) {
			return true;
		}

		// Search by keywords
		return icon.keywords.some((keyword) => keyword.toLowerCase().includes(lowerQuery));
	});
}

/**
 * Determine if a string is an emoji or icon identifier
 */
export function getIconType(value: string): 'emoji' | 'icon' | 'unknown' {
	// Check if it's an emoji (most emojis are in the unicode range)
	// Simple check: if it's a single character and has high code point
	if (value.length > 0) {
		const codePoint = value.codePointAt(0) ?? 0;
		if (codePoint > 0x1f300 || (codePoint >= 0x2600 && codePoint <= 0x27bf)) {
			return 'emoji';
		}
	}

	// Check if it's an icon identifier (e.g., 'lucide-SquareCheck')
	if (value.includes('-')) {
		return 'icon';
	}

	return 'unknown';
}

/**
 * Parse icon identifier to extract pack ID and icon name
 * e.g., 'lucide-SquareCheck' -> { packId: 'lucide', iconName: 'SquareCheck' }
 */
export function parseIconIdentifier(value: string): { packId: string; iconName: string } | null {
	if (getIconType(value) !== 'icon') {
		return null;
	}

	const parts = value.split('-');
	if (parts.length < 2) {
		return null;
	}

	const packId = parts[0];
	const iconName = parts.slice(1).join('-');

	return { packId, iconName };
}
