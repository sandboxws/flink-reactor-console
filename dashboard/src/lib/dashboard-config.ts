/**
 * @module dashboard-config
 * Typed access to the build-time dashboard configuration injected by Vite's
 * `define` option from `dashboard.config.toml`.
 */

interface SidebarConfig {
  disabled_sections: string[]
  disabled_links: string[]
}

interface DashboardTomlConfig {
  sidebar: SidebarConfig
}

declare const __DASHBOARD_CONFIG__: DashboardTomlConfig

const cfg: DashboardTomlConfig = __DASHBOARD_CONFIG__

const disabledSections = new Set(
  cfg.sidebar.disabled_sections.map((s) => s.toLowerCase()),
)
const disabledLinks = new Set(cfg.sidebar.disabled_links)

/** Returns true when a sidebar section should be rendered. */
export function isSectionEnabled(id: string): boolean {
  return !disabledSections.has(id.toLowerCase())
}

/** Returns true when a sidebar link should be rendered. */
export function isLinkEnabled(href: string): boolean {
  return !disabledLinks.has(href)
}
