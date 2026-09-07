"""
Given a new finding from scan_diff.json, searches the SITE's own source
(not the automation repo) for files that actually reference the
violation's real CSS target selector - e.g. ".tag" - and outputs a list
of file PATHS, deliberately not file contents.

Paths only, by design: this becomes part of a public GitHub Issue body.
Putting the site's actual source INTO that Issue would mean duplicating
your own code into a public comment thread for no real benefit, since
Claude Code (run locally, interactively, by you) can already read these
exact files directly from your checked-out repo the moment you point it
at these paths. The Issue becomes a pointer, not a copy.

Search strategy mirrors what actually solved both real bugs tonight:
start from the violation's CSS target, then check every layout/component/
style file for a literal reference to it - the same "trace the real
render chain, don't guess" discipline, just automated as a first pass.
Never treated as authoritative on its own - Claude Code (with you
watching) does the actual diagnosis; this only narrows where to look.
"""
import json
import re
import sys
from pathlib import Path

# File types worth searching. Site is Astro + TypeScript + plain CSS.
SEARCHABLE_EXTENSIONS = {".astro", ".css", ".ts", ".tsx"}

# Directories never worth searching - build output, dependencies, etc.
EXCLUDED_DIRS = {"node_modules", "dist", ".git", ".astro"}


def find_site_files(site_root):
    """Every searchable source file in the site repo, skipping build
    artifacts and dependencies."""
    site_root = Path(site_root)
    for path in site_root.rglob("*"):
        if not path.is_file():
            continue
        if path.suffix not in SEARCHABLE_EXTENSIONS:
            continue
        if any(excluded in path.parts for excluded in EXCLUDED_DIRS):
            continue
        yield path


def selector_to_search_terms(target):
    """A target like ['.tag'] or ['#main-nav'] needs the leading . or #
    stripped to search for the bare class/id name as it'd actually
    appear in an Astro component's class="..." attribute or a CSS rule,
    not the CSS-selector syntax itself."""
    terms = []
    for sel in target or []:
        bare = re.sub(r"^[.#]", "", sel.strip())
        if bare:
            terms.append(bare)
    return terms


def find_matching_files(site_root, search_terms):
    """Returns paths where at least one search term appears literally -
    a first-pass narrowing, not a guarantee this is the right file."""
    matches = []
    for path in find_site_files(site_root):
        try:
            content = path.read_text(errors="ignore")
        except OSError:
            continue
        if any(term in content for term in search_terms):
            matches.append(str(path.relative_to(site_root)))
    return sorted(matches)


def main():
    if len(sys.argv) < 3:
        print("Usage: context_bundler.py <scan_diff.json> <site_root>")
        sys.exit(1)

    diff_path = sys.argv[1]
    site_root = sys.argv[2]

    with open(diff_path) as f:
        diff = json.load(f)

    bundle = {"findings": []}

    # Accessibility findings from the diff are (page, violation_id)
    # pairs - the diff itself doesn't carry the target selector, so this
    # re-reads the full scan for that detail. Path is passed as a third
    # arg to keep this script testable without assuming a fixed layout.
    scan_path = sys.argv[3] if len(sys.argv) > 3 else "reports/health_scan.json"
    with open(scan_path) as f:
        full_scan = json.load(f)

    for page, violation_id in diff.get("new_accessibility", []):
        violations = full_scan.get("accessibility", {}).get(page, [])
        matching = next((v for v in violations if v.get("id") == violation_id), None)
        if not matching:
            continue

        finding = {
            "page": page,
            "violation_id": violation_id,
            "likely_relevant_files": [],
        }

        for node in matching.get("nodes", []):
            terms = selector_to_search_terms(node.get("target"))
            if terms:
                finding["likely_relevant_files"].extend(
                    find_matching_files(site_root, terms)
                )

        finding["likely_relevant_files"] = sorted(set(finding["likely_relevant_files"]))
        bundle["findings"].append(finding)

    with open("context_bundle.json", "w") as f:
        json.dump(bundle, f, indent=2)

    print(json.dumps(bundle, indent=2))


if __name__ == "__main__":
    main()