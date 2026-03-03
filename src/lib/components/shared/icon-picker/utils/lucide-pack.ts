/**
 * Curated Lucide icon pack
 * Contains commonly used icons for UI development
 */

import type { IconPack, IconEntry } from './icon-packs.js';
import * as LucideIcons from 'lucide-svelte';

// Curated list of commonly used Lucide icons
const LUCIDE_ICONS: {
	name: string;
	component: any;
	keywords: string[];
}[] = [
	// Actions
	{
		name: 'SquareCheck',
		component: LucideIcons.SquareCheck,
		keywords: ['check', 'tick', 'done', 'complete', 'task']
	},
	{ name: 'Check', component: LucideIcons.Check, keywords: ['check', 'tick', 'done', 'complete'] },
	{
		name: 'CheckCircle',
		component: LucideIcons.CheckCircle,
		keywords: ['check', 'tick', 'done', 'complete', 'success']
	},
	{
		name: 'CircleCheck',
		component: LucideIcons.CircleCheck,
		keywords: ['check', 'tick', 'done', 'success']
	},
	{
		name: 'CircleCheckBig',
		component: LucideIcons.CircleCheckBig,
		keywords: ['check', 'tick', 'done', 'success']
	},

	// Close / X
	{
		name: 'X',
		component: LucideIcons.X,
		keywords: ['close', 'cancel', 'times', 'remove', 'delete']
	},
	{
		name: 'XCircle',
		component: LucideIcons.XCircle,
		keywords: ['close', 'cancel', 'error', 'fail']
	},
	{
		name: 'CircleX',
		component: LucideIcons.CircleX,
		keywords: ['close', 'cancel', 'error', 'fail']
	},

	// Add
	{ name: 'Plus', component: LucideIcons.Plus, keywords: ['add', 'new', 'create', 'insert'] },
	{
		name: 'PlusCircle',
		component: LucideIcons.PlusCircle,
		keywords: ['add', 'new', 'create', 'insert']
	},
	{ name: 'CirclePlus', component: LucideIcons.CirclePlus, keywords: ['add', 'new', 'create'] },

	// Remove
	{ name: 'Minus', component: LucideIcons.Minus, keywords: ['remove', 'subtract', 'delete'] },
	{ name: 'MinusCircle', component: LucideIcons.MinusCircle, keywords: ['remove', 'subtract'] },
	{ name: 'CircleMinus', component: LucideIcons.CircleMinus, keywords: ['remove', 'subtract'] },

	// Edit
	{
		name: 'Edit',
		component: LucideIcons.Edit,
		keywords: ['edit', 'modify', 'change', 'update', 'pencil']
	},
	{ name: 'Pencil', component: LucideIcons.Pencil, keywords: ['edit', 'write', 'draw', 'modify'] },

	// Delete
	{ name: 'Trash', component: LucideIcons.Trash, keywords: ['delete', 'remove', 'trash', 'bin'] },
	{ name: 'Trash2', component: LucideIcons.Trash2, keywords: ['delete', 'remove', 'trash', 'bin'] },

	// Search
	{
		name: 'Search',
		component: LucideIcons.Search,
		keywords: ['search', 'find', 'lookup', 'filter']
	},
	{
		name: 'SearchCheck',
		component: LucideIcons.SearchCheck,
		keywords: ['search', 'find', 'check']
	},

	// Menu
	{ name: 'Menu', component: LucideIcons.Menu, keywords: ['menu', 'hamburger', 'list', 'options'] },
	{
		name: 'MoreHorizontal',
		component: LucideIcons.MoreHorizontal,
		keywords: ['menu', 'options', 'more', 'dots']
	},
	{
		name: 'MoreVertical',
		component: LucideIcons.MoreVertical,
		keywords: ['menu', 'options', 'more', 'dots']
	},

	// Settings
	{
		name: 'Settings',
		component: LucideIcons.Settings,
		keywords: ['settings', 'config', 'preferences', 'options']
	},
	{
		name: 'Settings2',
		component: LucideIcons.Settings2,
		keywords: ['settings', 'config', 'preferences']
	},

	// User
	{ name: 'User', component: LucideIcons.User, keywords: ['user', 'person', 'profile', 'account'] },
	{
		name: 'UserCircle',
		component: LucideIcons.UserCircle,
		keywords: ['user', 'person', 'profile', 'avatar']
	},
	{ name: 'Users', component: LucideIcons.Users, keywords: ['users', 'people', 'group', 'team'] },

	// Notifications
	{
		name: 'Bell',
		component: LucideIcons.Bell,
		keywords: ['bell', 'notification', 'alert', 'ring']
	},
	{
		name: 'BellRing',
		component: LucideIcons.BellRing,
		keywords: ['bell', 'notification', 'alert']
	},
	{ name: 'BellDot', component: LucideIcons.BellDot, keywords: ['bell', 'notification', 'unread'] },

	// Favorites
	{
		name: 'Star',
		component: LucideIcons.Star,
		keywords: ['star', 'favorite', 'like', 'bookmark', 'rate']
	},
	{
		name: 'StarHalf',
		component: LucideIcons.StarHalf,
		keywords: ['star', 'favorite', 'like', 'rate']
	},
	{ name: 'StarOff', component: LucideIcons.StarOff, keywords: ['star', 'favorite', 'unfavorite'] },

	// Heart
	{ name: 'Heart', component: LucideIcons.Heart, keywords: ['heart', 'love', 'like', 'favorite'] },
	{
		name: 'HeartOff',
		component: LucideIcons.HeartOff,
		keywords: ['heart', 'love', 'unlike', 'dislike']
	},

	// Bookmark
	{ name: 'Bookmark', component: LucideIcons.Bookmark, keywords: ['bookmark', 'save', 'mark'] },
	{
		name: 'BookmarkCheck',
		component: LucideIcons.BookmarkCheck,
		keywords: ['bookmark', 'save', 'check']
	},

	// Share
	{ name: 'Share', component: LucideIcons.Share, keywords: ['share', 'send', 'distribute'] },
	{ name: 'Share2', component: LucideIcons.Share2, keywords: ['share', 'send'] },

	// Download / Upload
	{ name: 'Download', component: LucideIcons.Download, keywords: ['download', 'save', 'get'] },
	{ name: 'Upload', component: LucideIcons.Upload, keywords: ['upload', 'send', 'post'] },
	{
		name: 'CloudDownload',
		component: LucideIcons.CloudDownload,
		keywords: ['download', 'cloud', 'save']
	},
	{
		name: 'CloudUpload',
		component: LucideIcons.CloudUpload,
		keywords: ['upload', 'cloud', 'send']
	},

	// File
	{ name: 'File', component: LucideIcons.File, keywords: ['file', 'document', 'page'] },
	{
		name: 'FileText',
		component: LucideIcons.FileText,
		keywords: ['file', 'document', 'text', 'page']
	},
	{ name: 'FileImage', component: LucideIcons.FileImage, keywords: ['file', 'image', 'picture'] },
	{ name: 'FileVideo', component: LucideIcons.FileVideo, keywords: ['file', 'video', 'movie'] },
	{ name: 'FileMusic', component: LucideIcons.FileMusic, keywords: ['file', 'music', 'audio'] },
	{
		name: 'FileCode',
		component: LucideIcons.FileCode,
		keywords: ['file', 'code', 'source', 'dev']
	},
	{ name: 'FileArchive', component: LucideIcons.FileArchive, keywords: ['file', 'archive', 'zip'] },

	// Folder
	{ name: 'Folder', component: LucideIcons.Folder, keywords: ['folder', 'directory', 'catalog'] },
	{
		name: 'FolderOpen',
		component: LucideIcons.FolderOpen,
		keywords: ['folder', 'directory', 'open']
	},
	{
		name: 'FolderTree',
		component: LucideIcons.FolderTree,
		keywords: ['folder', 'tree', 'structure']
	},

	// Navigation
	{ name: 'Home', component: LucideIcons.Home, keywords: ['home', 'dashboard', 'main'] },
	{
		name: 'LayoutDashboard',
		component: LucideIcons.LayoutDashboard,
		keywords: ['dashboard', 'layout']
	},

	// Calendar
	{ name: 'Calendar', component: LucideIcons.Calendar, keywords: ['calendar', 'date', 'schedule'] },
	{
		name: 'CalendarDays',
		component: LucideIcons.CalendarDays,
		keywords: ['calendar', 'date', 'schedule']
	},
	{
		name: 'CalendarClock',
		component: LucideIcons.CalendarClock,
		keywords: ['calendar', 'date', 'time']
	},

	// Clock
	{ name: 'Clock', component: LucideIcons.Clock, keywords: ['clock', 'time', 'watch'] },
	{ name: 'Timer', component: LucideIcons.Timer, keywords: ['timer', 'countdown', 'time'] },

	// Location
	{
		name: 'MapPin',
		component: LucideIcons.MapPin,
		keywords: ['map', 'pin', 'location', 'place', 'marker']
	},
	{
		name: 'Globe',
		component: LucideIcons.Globe,
		keywords: ['globe', 'world', 'earth', 'location']
	},

	// Help / Info
	{
		name: 'Info',
		component: LucideIcons.Info,
		keywords: ['info', 'information', 'help', 'details']
	},
	{ name: 'CircleHelp', component: LucideIcons.CircleHelp, keywords: ['help', 'question', 'info'] },
	{ name: 'HelpCircle', component: LucideIcons.HelpCircle, keywords: ['help', 'question', 'info'] },

	// Alerts
	{
		name: 'AlertTriangle',
		component: LucideIcons.AlertTriangle,
		keywords: ['alert', 'warning', 'caution', 'error']
	},
	{
		name: 'AlertCircle',
		component: LucideIcons.AlertCircle,
		keywords: ['alert', 'warning', 'error']
	},
	{
		name: 'AlertOctagon',
		component: LucideIcons.AlertOctagon,
		keywords: ['alert', 'warning', 'error']
	},

	// Chevron (navigation)
	{
		name: 'ChevronDown',
		component: LucideIcons.ChevronDown,
		keywords: ['chevron', 'down', 'arrow']
	},
	{ name: 'ChevronUp', component: LucideIcons.ChevronUp, keywords: ['chevron', 'up', 'arrow'] },
	{
		name: 'ChevronLeft',
		component: LucideIcons.ChevronLeft,
		keywords: ['chevron', 'left', 'arrow', 'back']
	},
	{
		name: 'ChevronRight',
		component: LucideIcons.ChevronRight,
		keywords: ['chevron', 'right', 'arrow', 'next']
	},

	// Arrow (navigation)
	{ name: 'ArrowUp', component: LucideIcons.ArrowUp, keywords: ['arrow', 'up'] },
	{ name: 'ArrowDown', component: LucideIcons.ArrowDown, keywords: ['arrow', 'down'] },
	{ name: 'ArrowLeft', component: LucideIcons.ArrowLeft, keywords: ['arrow', 'left', 'back'] },
	{ name: 'ArrowRight', component: LucideIcons.ArrowRight, keywords: ['arrow', 'right', 'next'] },
	{
		name: 'ArrowUpRight',
		component: LucideIcons.ArrowUpRight,
		keywords: ['arrow', 'external', 'link']
	},
	{
		name: 'ArrowUpRightFromSquare',
		component: LucideIcons.ArrowUpRightFromSquare,
		keywords: ['arrow', 'external', 'link']
	},

	// Refresh
	{
		name: 'RefreshCw',
		component: LucideIcons.RefreshCw,
		keywords: ['refresh', 'reload', 'sync', 'update', 'rotate']
	},
	{
		name: 'RefreshCwOff',
		component: LucideIcons.RefreshCwOff,
		keywords: ['refresh', 'sync', 'off']
	},
	{ name: 'RotateCw', component: LucideIcons.RotateCw, keywords: ['rotate', 'turn', 'spin'] },

	// Copy / Paste
	{ name: 'Copy', component: LucideIcons.Copy, keywords: ['copy', 'duplicate', 'clone'] },
	{
		name: 'Clipboard',
		component: LucideIcons.Clipboard,
		keywords: ['clipboard', 'copy', 'paste', 'copy']
	},
	{ name: 'ClipboardCopy', component: LucideIcons.ClipboardCopy, keywords: ['clipboard', 'copy'] },
	{
		name: 'ClipboardCheck',
		component: LucideIcons.ClipboardCheck,
		keywords: ['clipboard', 'check', 'done']
	},

	// Links
	{ name: 'Link', component: LucideIcons.Link, keywords: ['link', 'url', 'connect', 'chain'] },
	{ name: 'Link2', component: LucideIcons.Link2, keywords: ['link', 'url', 'connect', 'chain'] },
	{ name: 'Link2Off', component: LucideIcons.Link2Off, keywords: ['link', 'url', 'disconnect'] },
	{
		name: 'Unlink',
		component: LucideIcons.Unlink,
		keywords: ['link', 'url', 'disconnect', 'unlink']
	},
	{
		name: 'ExternalLink',
		component: LucideIcons.ExternalLink,
		keywords: ['external', 'link', 'new tab']
	},

	// Filter / Sort
	{ name: 'Filter', component: LucideIcons.Filter, keywords: ['filter', 'sift', 'screen'] },
	{ name: 'FilterX', component: LucideIcons.FilterX, keywords: ['filter', 'clear', 'reset'] },
	{
		name: 'SortAsc',
		component: LucideIcons.SortAsc,
		keywords: ['sort', 'ascending', 'asc', 'a-z']
	},
	{
		name: 'SortDesc',
		component: LucideIcons.SortDesc,
		keywords: ['sort', 'descending', 'desc', 'z-a']
	},

	// Layout
	{ name: 'LayoutGrid', component: LucideIcons.LayoutGrid, keywords: ['grid', 'layout', 'tiles'] },
	{ name: 'LayoutList', component: LucideIcons.LayoutList, keywords: ['list', 'layout'] },
	{
		name: 'LayoutTemplate',
		component: LucideIcons.LayoutTemplate,
		keywords: ['layout', 'template']
	},
	{ name: 'Grid', component: LucideIcons.Grid, keywords: ['grid', 'layout', 'tiles'] },
	{ name: 'List', component: LucideIcons.List, keywords: ['list', 'menu', 'layout'] },

	// Security
	{
		name: 'Lock',
		component: LucideIcons.Lock,
		keywords: ['lock', 'secure', 'privacy', 'password']
	},
	{ name: 'LockOpen', component: LucideIcons.LockOpen, keywords: ['lock', 'open', 'unlock'] },
	{ name: 'Shield', component: LucideIcons.Shield, keywords: ['shield', 'security', 'protect'] },
	{
		name: 'ShieldCheck',
		component: LucideIcons.ShieldCheck,
		keywords: ['shield', 'security', 'check']
	},
	{ name: 'ShieldX', component: LucideIcons.ShieldX, keywords: ['shield', 'security', 'error'] },

	// Visibility
	{ name: 'Eye', component: LucideIcons.Eye, keywords: ['eye', 'view', 'visible', 'show'] },
	{
		name: 'EyeOff',
		component: LucideIcons.EyeOff,
		keywords: ['eye', 'hide', 'invisible', 'password']
	},

	// Media
	{ name: 'Image', component: LucideIcons.Image, keywords: ['image', 'picture', 'photo', 'img'] },
	{ name: 'ImagePlus', component: LucideIcons.ImagePlus, keywords: ['image', 'add', 'upload'] },
	{ name: 'Images', component: LucideIcons.Images, keywords: ['image', 'gallery', 'photos'] },
	{ name: 'Video', component: LucideIcons.Video, keywords: ['video', 'movie', 'film'] },
	{ name: 'VideoOff', component: LucideIcons.VideoOff, keywords: ['video', 'off', 'mute'] },
	{ name: 'Music', component: LucideIcons.Music, keywords: ['music', 'audio', 'sound', 'song'] },
	{
		name: 'Volume2',
		component: LucideIcons.Volume2,
		keywords: ['volume', 'sound', 'audio', 'speaker']
	},
	{ name: 'VolumeX', component: LucideIcons.VolumeX, keywords: ['volume', 'mute', 'sound'] },

	// Message
	{
		name: 'MessageSquare',
		component: LucideIcons.MessageSquare,
		keywords: ['message', 'chat', 'comment', 'bubble']
	},
	{
		name: 'MessageCircle',
		component: LucideIcons.MessageCircle,
		keywords: ['message', 'chat', 'comment']
	},
	{
		name: 'MessageSquarePlus',
		component: LucideIcons.MessageSquarePlus,
		keywords: ['message', 'add', 'new chat']
	},

	// Communication
	{
		name: 'Send',
		component: LucideIcons.Send,
		keywords: ['send', 'submit', 'deliver', 'paper plane']
	},
	{ name: 'Reply', component: LucideIcons.Reply, keywords: ['reply', 'respond', 'answer'] },
	{ name: 'ReplyAll', component: LucideIcons.ReplyAll, keywords: ['reply', 'respond', 'answer'] },
	{ name: 'Forward', component: LucideIcons.Forward, keywords: ['forward', 'share'] },

	// Tools
	{ name: 'Wrench', component: LucideIcons.Wrench, keywords: ['wrench', 'tool', 'fix', 'repair'] },
	{ name: 'Hammer', component: LucideIcons.Hammer, keywords: ['hammer', 'tool'] },

	// Common UI
	{
		name: 'Maximize',
		component: LucideIcons.Maximize,
		keywords: ['maximize', 'expand', 'fullscreen']
	},
	{
		name: 'Minimize',
		component: LucideIcons.Minimize,
		keywords: ['minimize', 'reduce', 'fullscreen']
	},
	{ name: 'Maximize2', component: LucideIcons.Maximize2, keywords: ['maximize', 'expand'] },
	{ name: 'Minimize2', component: LucideIcons.Minimize2, keywords: ['minimize', 'reduce'] },

	{ name: 'ZoomIn', component: LucideIcons.ZoomIn, keywords: ['zoom', 'in', 'magnify'] },
	{ name: 'ZoomOut', component: LucideIcons.ZoomOut, keywords: ['zoom', 'out'] },

	{ name: 'Monitor', component: LucideIcons.Monitor, keywords: ['monitor', 'screen', 'display'] },
	{ name: 'Laptop', component: LucideIcons.Laptop, keywords: ['laptop', 'computer'] },
	{ name: 'Smartphone', component: LucideIcons.Smartphone, keywords: ['phone', 'mobile', 'cell'] },
	{ name: 'Tablet', component: LucideIcons.Tablet, keywords: ['tablet', 'ipad'] },

	{ name: 'Wifi', component: LucideIcons.Wifi, keywords: ['wifi', 'wireless', 'network'] },
	{ name: 'WifiOff', component: LucideIcons.WifiOff, keywords: ['wifi', 'off', 'no connection'] },

	{ name: 'Battery', component: LucideIcons.Battery, keywords: ['battery', 'power', 'charge'] },
	{
		name: 'BatteryCharging',
		component: LucideIcons.BatteryCharging,
		keywords: ['battery', 'charge', 'power']
	},

	{ name: 'Sun', component: LucideIcons.Sun, keywords: ['sun', 'light', 'bright', 'day'] },
	{ name: 'Moon', component: LucideIcons.Moon, keywords: ['moon', 'dark', 'night', 'theme'] },
	{
		name: 'SunMoon',
		component: LucideIcons.SunMoon,
		keywords: ['theme', 'dark mode', 'light mode']
	},

	{
		name: 'Lightbulb',
		component: LucideIcons.Lightbulb,
		keywords: ['idea', 'lightbulb', 'bright', 'idea']
	},
	{
		name: 'Sparkles',
		component: LucideIcons.Sparkles,
		keywords: ['sparkle', 'magic', 'star', 'shine']
	}
];

/**
 * Create the Lucide icon pack
 */
export const lucideIconPack: IconPack = {
	id: 'lucide',
	name: 'Lucide Icons',
	getIcons(): IconEntry[] {
		return LUCIDE_ICONS.map((icon) => ({
			id: icon.name,
			component: icon.component,
			keywords: icon.keywords
		}));
	}
};

/**
 * Auto-register the Lucide pack on import
 */
if (typeof window !== 'undefined' || typeof globalThis !== 'undefined') {
	// Import registerIconPack dynamically to avoid circular dependency
	import('./icon-packs.js').then(({ registerIconPack }) => {
		registerIconPack(lucideIconPack);
	});
}
