import type { NavLink } from "../types";

export const NAV_LINKS: NavLink[] = [
    { href: "/", label: "About", isActive: true },
    {
        href: "/posts",
        label: "Writing",
        isActive: true,
        children: [
            { href: "/posts", label: "Blogs", isActive: true },
            { href: "/publications", label: "Publications", isActive: true },
        ],
    },
    { href: "/talks", label: "Speaking", isActive: true },
    { href: "/projects", label: "Playground", isActive: true },
    {
        href: "/ai-in-testing",
        label: "Learning",
        isActive: true,
        children: [
            { href: "/ai-in-testing", label: "AI In Testing", isActive: true },
            { href: "/til", label: "TIL", isActive: true },
        ],
    },
    { href: "/cv", label: "CV", isActive: true },
];
