---
title: "What building a CI/CD system taught me about understanding architecture - Part 1"
description: 'From "I Raise the PR and Merge It Myself" to a Real CI/CD Pipeline: Everything I Learned Building One From Scratch'
author: "Ujjwal Kumar Singh"
tags:
  - "Testing"
  - "Pairwise Testing"
  - "Bug Investigation"
---


# From "I Raise the PR and Merge It Myself" to a Real CI/CD Pipeline: Everything I Learned Building One From Scratch

A few weeks ago, if you'd asked me to explain my automation process in an interview, I would have said something like: *"I raise the PR, I check it for conflicts, and if there are none, I merge it. That's it."*

That answer wasn't wrong. It just wasn't the whole picture. I didn't know how much was missing until I built the missing pieces myself, on my own portfolio website's test automation project, one very real bug at a time.

This is the story of that build: what I set out to do, what actually broke along the way, and what I understand now that I didn't before. If you're a QA engineer who knows *what* a CI/CD pipeline is supposed to do but has never actually built one end to end, I'm hoping this saves you some of the confusion I went through.

## Where I started

The project itself was simple on paper: a Selenium and Pytest test suite, using the Page Object Model, testing my own portfolio site (navigation, social links, a subscribe popup, a CV download button). Nothing exotic. The real learning wasn't in the test code. It was in everything *around* it.

A colleague had described a real production setup to me once, in fragments, over a few conversations. Piecing it together, the architecture looked roughly like this:

```
GitHub (feature branch to PR to merge)
    ↓
Jenkins (running on an Azure VM)
    ├── Deployment Job  → builds Docker image
    └── Execution Job   → calls an internal API to construct the test command
             ↓
          Docker
             ↓
     Automation Framework
             ↓
        Test Execution
         ↓         ↓
       Logs     Reports
                    ↓
            Persistent Volume
                    ↓
             HTML Report
```

I wanted to build something close to this. Not a toy tutorial version, but something with the same real decisions behind it. Here's what that actually took.

## Step 1: Docker, and the first real lesson about image size

The first version of my Dockerfile installed Chromium and ChromeDriver directly inside the test image:

```dockerfile
FROM python:3.11-slim
RUN apt-get update && apt-get install -y chromium chromium-driver
COPY requirements.txt .
RUN pip install -r requirements.txt
```

It worked. It also took **over two minutes** just to install Chromium on every single build, and coupled the browser version tightly to whatever Debian happened to ship that week.

This is the first thing I'd tell anyone starting out: don't assume your first working version is your best version. This one worked, but it wasn't right. I didn't discover that until I added Selenium Grid.

## Step 2: Jenkins, and a decision that seemed small but wasn't

I built the pipeline with two parallel jobs, mirroring the real architecture:

```groovy
stage('Prepare') {
    parallel {
        stage('Deployment Job') {
            steps {
                sh 'docker build --no-cache -t ${IMAGE_NAME}:${IMAGE_TAG} .'
            }
        }
        stage('Execution Job') {
            steps {
                sh 'python3 execution_api/build_command.py'
            }
        }
    }
}
```

Then came the first real architectural decision: how does Jenkins know when to run?

The enterprise standard answer is a GitHub webhook. GitHub pushes a signal to Jenkins the moment something changes. But a webhook requires Jenkins to be publicly reachable, which meant either a cloud VM (requiring a credit card, even for a "free tier") or a tunnel like ngrok.

I chose Poll SCM instead. Jenkins checks GitHub every five minutes instead of waiting for a push. It's not the production choice, but it's the right choice for a personal project, and this mattered more than I expected. It's a decision I could actually explain and defend, rather than something I'd just copied.

## Step 3: Selenium Grid, and the bug that taught me the most

Once the framework worked locally, I added a Selenium Grid (hub, Chrome node, Firefox node) so tests could run against real, distributed browsers instead of a browser bundled inside the test image. This also let me shrink the Dockerfile dramatically. No more Chromium install at all:

```dockerfile
FROM python:3.11-slim
ENV HEADLESS=true
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
ENTRYPOINT ["python", "run_all_tests.py"]
```

But getting the Grid to reliably report "ready" before tests started hitting it took three separate, genuinely different bugs to fully resolve.

**Bug 1: `set -e` silently killing my retry loop.** Jenkins' `sh` steps run with `set -e` by default. The first command that fails kills the entire script. My retry loop's first `curl` attempt failed (the Grid container had just started), and the whole script died on attempt one instead of retrying fifteen times like I'd written it to.

```bash
# Broken: one failed curl kills everything
HUB_RESPONSE=$(curl -s http://localhost:4444/status)

# Fixed
HUB_RESPONSE=$(curl -s http://localhost:4444/status || true)
```

**Bug 2: the wrong endpoint entirely.** I'd written the health check against `/wd/hub/status`, the Selenium 3 legacy path. Selenium Grid 4 (what I was actually running) uses `/status`.

**Bug 3: a single space character.** Even after fixing both of the above, the check still failed every time, for fifteen full attempts, despite the Grid's own logs clearly showing `"ready": true`. The reason: Grid 4 returns pretty printed JSON with a space after the colon (`"ready": true`), but my `grep` pattern searched for no space at all (`"ready":true`). I didn't guess this. I tested both patterns against the actual captured response before shipping the fix:

```bash
grep -oE '"ready":[[:space:]]*true'
```

None of these three bugs were visible from documentation. All three only showed up by actually running the thing and reading the real console output carefully.

## Step 4: Making it actually resilient

Once the Grid worked, I layered on the pieces that turn "it runs" into "it's dependable."

**Health checks before spending time on tests:**
```bash
SITE_STATUS=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "${BASE_URL}" || echo "000")
if [ "$SITE_STATUS" -ge 400 ]; then
    echo "Site health check FAILED"
    exit 1
fi
```

**Auto-retry for flaky tests.** One line in `pytest.ini`:
```ini
addopts = --reruns 2 --reruns-delay 3
```

**Image versioning**, so every build is traceable to an exact artifact instead of overwriting `:latest` every time:
```groovy
docker build -t ${IMAGE_NAME}:${IMAGE_TAG} -t ${IMAGE_NAME}:latest .
```

**Secrets kept out of code**, using a `.env` and `.env.example` pattern. Real values are never committed. Only a documented placeholder file tells anyone cloning the repo exactly what the project expects.

## Step 5: Portability, pushing to a real registry

For a long time, my Docker images only ever existed on my own laptop's Docker daemon. If that machine died, every tested image died with it. I pushed to GitHub Container Registry instead (free, no card, and it reuses the GitHub account the repo already lives on):

```groovy
withCredentials([usernamePassword(credentialsId: 'ghcr-credentials', ...)]) {
    sh '''
        docker tag ${IMAGE_NAME}:${IMAGE_TAG} ghcr.io/${GHCR_USER}/${IMAGE_NAME}:${IMAGE_TAG}
        docker push ghcr.io/${GHCR_USER}/${IMAGE_NAME}:${IMAGE_TAG}
    '''
}
```

Even this had a real bug worth mentioning. The first tag pushed successfully, but the second push (`:latest`), seconds later in the same session, failed with `unauthorized`. The fix was to re-authenticate fresh before each individual push rather than trusting one login to cover both.

## Step 6: Security scanning for free

I added Trivy (open source, no signup) to scan the image for known vulnerabilities right after building it:

```bash
docker run --rm -v /var/run/docker.sock:/var/run/docker.sock \
    aquasec/trivy:latest image --severity CRITICAL,HIGH --exit-code 0 ${IMAGE_NAME}:${IMAGE_TAG}
```

I deliberately set `--exit-code 0` for the first rollout. Report findings, don't block the build yet. There's no baseline for what "normal" looks like until you've actually run the scan once. For reference, my very first scan found nineteen vulnerabilities (three critical, sixteen high), mostly in OS level packages rather than my own code. Completely normal for a Debian based image.

## Step 7: The piece that actually connected back to what I'd been told about real teams

Here's where it clicked. Everything up to this point ran tests after code merged into `master`. Useful, but it meant I only found out something was broken after it was already live in the main branch.

Setting up a Multibranch Pipeline changed that: Jenkins now discovers every open pull request automatically and tests it before merge, posting a pass or fail result directly onto the PR itself.

```groovy
if (env.CHANGE_ID) {
    // This is a PR build. Multibranch sets CHANGE_ID only in this case.
    slackSend(channel: '#ci-alerts', color: 'good', message: "PR #${env.CHANGE_ID} passed")
} else if (params.NOTIFY_EMAIL?.trim()) {
    // Regular branch build (master). Email, unchanged.
    mail(to: params.NOTIFY_EMAIL, ...)
}
```

This is when I realized what "checking for conflicts before merging" actually implies in a real team. It's not just a manual git conflict glance. It's looking at a PR that already has a green or red checkmark on it, from a pipeline that ran automatically the moment the PR was opened. My original one line description of "the automation process" wasn't wrong. It was just describing the visible surface of something with a lot more underneath it.

I even hit the exact failure mode this setup is designed to prevent. I merged a PR before its check finished, and its pipeline result never actually gated anything. A good reminder that a process is only as strong as the discipline behind following it, which is exactly why real teams pair this with a GitHub branch protection rule that makes the merge button physically unclickable until the check passes.

## Step 8: Splitting notifications by audience

The last real addition: Slack for PR level feedback (fast, dev facing, "did my change break anything?"), and email for main branch health (less frequent, stakeholder facing, "is the thing we ship actually working?"). Same Jenkinsfile, branching on `env.CHANGE_ID` to decide which one fires.

## What I'd actually call this pipeline now

I used to think of myself as somewhere around level one or two on CI/CD maturity. Having built this, I'd place it more honestly at a solid level three, with real level four elements: containerized, distributed test execution; structured historical reporting; auto-retry for flakiness; image versioning and a real registry; PR based gating before merge; and vulnerability scanning, even if that scanning is currently in report only mode rather than full enforcement.

What's genuinely still missing (a dedicated secrets vault instead of Jenkins' own credential store, infrastructure as code instead of hand configured settings, real observability beyond pass or fail emails) isn't a sophistication gap. It's an organizational scale gap: things that matter when fifty engineers depend on this pipeline, not when one person is learning by building it.

## The honest lessons, distilled

If I had to compress this whole process into the handful of things I would tell someone starting from zero:

- A single space character in a JSON response can cost you hours. Read the actual raw output before trusting your assumptions about a format.
- `set -e` in shell scripts is a silent killer of retry loops. Always give commands you expect might fail an explicit `|| true` if a loop needs to survive them.
- `UID` is a reserved bash variable. You cannot export your own value into it, no matter how reasonable that seems.
- Containers and ports are shared resources. The moment you have two things that could run concurrently, you need to explicitly plan for what happens if they do.
- PR based gating is the actual point of "checking it before merging" in a real team. Not a manual glance for conflicts, but an automated result you're reading, not producing.
- A pipeline is never really done. Every fix I made exposed the next thing worth fixing. That's not a flaw in the process. That's what the process is for.

If you're working through something similar, I would genuinely love to hear where your version diverges from mine.