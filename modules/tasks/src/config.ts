/**
 * Tasks Module Configuration
 * Defines routes, navigation items, and metadata for the Tasks module
 */

import {
  SquareCheck,
  ListTodo,
  Briefcase,
  MapPin,
  Calendar,
  Settings,
} from "lucide-svelte";
import type { ModuleConfig } from "$lib/config/types";

export const tasksConfig: ModuleConfig = {
  id: "tasks",
  name: "Tasks",
  href: "/ui/tasks",
  icon: SquareCheck,
  description: "Task management and project tracking",
  navigation: [
    {
      name: "Dashboard",
      icon: ListTodo,
      href: "/ui/tasks/dashboard",
    },
    {
      name: "My Tasks",
      icon: SquareCheck,
      href: "/ui/tasks/my",
    },
    {
      name: "Projects",
      icon: Briefcase,
      href: "/ui/tasks/projects",
    },
    {
      name: "Areas",
      icon: MapPin,
      href: "/ui/tasks/areas",
    },
    {
      name: "Daily Log",
      icon: Calendar,
      href: "/ui/tasks/daily-log",
    },
    {
      name: "Settings",
      icon: Settings,
      href: "/ui/tasks/settings",
    },
  ],
};

export const moduleConfig = tasksConfig;
export default tasksConfig;
