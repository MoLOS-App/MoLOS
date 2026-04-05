import type { NavItem } from '$lib/config/types';

export type SubmenuSection = {
	id: string;
	label: string;
	items: NavItem[];
};

function isSettingsItem(item: NavItem) {
	return Boolean(item.name.match(/settings/i) || item.href?.includes('/settings'));
}

export function groupSubmenuItems(items: NavItem[]): SubmenuSection[] {
	if (!items.length) return [];

	const settingsItems = items.filter(isSettingsItem);
	const mainItems = items.filter((item) => !settingsItems.includes(item));
	const sections: SubmenuSection[] = [];

	if (mainItems.length) {
		sections.push({ id: 'sections', label: 'Sections', items: mainItems });
	}

	if (settingsItems.length) {
		sections.push({ id: 'settings', label: 'Settings', items: settingsItems });
	}

	return sections;
}

export function getActiveSubmenuItem(items: NavItem[], path: string) {
	return items.find((item) => item.href === path);
}
