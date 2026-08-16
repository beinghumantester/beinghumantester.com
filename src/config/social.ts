import type { SocialLink } from "../types";

export const SOCIALS: SocialLink[] = [
    {
        name: "Github",
        href: "https://github.com/beinghumantester",
        linkTitle: `Follow Ujjwal on Github`,
        isActive: true,
    },
    {
        name: "Mail",
        href: "mailto:thebeinghumantester@gmail.com",
        linkTitle: `Send an email to Ujjwal`,
        isActive: true,
    },
    {
        name: "LinkedIn",
        href: "https://www.linkedin.com/in/beinghumantester/",
        linkTitle: `Ujjwal on LinkedIn`,
        isActive: true,
    },
    {
        name: "YouTube",
        href: "https://www.youtube.com/@beinghumantester/",
        linkTitle: `Ujjwal on YouTube`,
        isActive: true,
    },
    {
        name: "Ministry of Testing",
        href: "https://www.ministryoftesting.com/p/ujjwal.singh",
        linkTitle: `Ujjwal on Ministry of Testing`,
        isActive: true,
    },
];

export const SOCIAL_ICONS: Record<string, string> = {
    Github: "Github",
    Mail: "Mail",
    Linkedin: "LinkedIn",
    "Google Scholar": "GoogleScholar",
    ORCID: "ORCID",
    RSS: "RSS",
    YouTube: "YouTube",
    "Ministry of Testing": "ExternalLink",
};