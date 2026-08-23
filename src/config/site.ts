import type { SiteConfig, ThemeConfig, SettingsConfig, UmamiAnalyticsConfig, AnalyticsConfig } from "../types";

export const SITE: SiteConfig = {
    website: "https://beinghumantester.com",
    author: "Ujjwal Kumar Singh",
    desc: "Portfolio of Ujjwal Kumar Singh - Software Development Engineer in Test (SDET), Ministry of Testing Ambassador, exploring quality beyond tools.",
    title: "Being Human Tester",
    ogImage: "images/ujjwal.jpeg",
    postPerPage: 5,
    lang: "en",
};

export const THEME_CONFIG: ThemeConfig = {
    lightAndDark: true,
    themeLight: "light_default",
    themeDark: "dark_notepad",
};

export const SETTINGS: SettingsConfig = {
    showTagsInNavbar: true,
    showRSSInFooter: true,
    addDevToolsInProduction: false,
};

const umami: UmamiAnalyticsConfig = {
    websiteId: "", // e.g., 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'
    src: "https://cloud.umami.is/script.js", // Default Umami cloud script URL
}

export const ANALYTICS: AnalyticsConfig = {
    // Google Analytics 4 Measurement ID (e.g., 'G-XXXXXXXXXX')
    ga4Id: "G-DMTYH00DMC",
    // Umami Analytics configuration
    umami: umami
};
