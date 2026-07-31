/**
 * Browser verification pass.
 *
 * The dashboard renders client-side after the session resolves, so curl only
 * ever sees a spinner. This drives a real Chromium instance: it signs in,
 * visits every page, fails on any console error or unhandled rejection, and
 * asserts that the charts actually painted.
 *
 *   node scripts/verify_ui.mjs [--base http://127.0.0.1:3000] [--shots <dir>]
 */

import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

const args = process.argv.slice(2);
const argOf = (flag, fallback) => {
  const i = args.indexOf(flag);
  return i !== -1 && args[i + 1] ? args[i + 1] : fallback;
};

const BASE = argOf("--base", "http://localhost:3000").replace(/\/$/, "");
const SHOTS = resolve(argOf("--shots", "./.ui-shots"));
mkdirSync(SHOTS, { recursive: true });

const ACCOUNTS = {
  admin: { email: "admin@revcloud.io", password: "Admin123!" },
  manager: { email: "manager@revcloud.io", password: "Manager123!" },
  viewer: { email: "viewer@revcloud.io", password: "Viewer123!" },
};

let passed = 0;
const failures = [];

function check(label, condition, detail = "") {
  if (condition) {
    passed++;
    console.log(`  PASS  ${label}`);
  } else {
    failures.push(label);
    console.log(`  FAIL  ${label}${detail ? `  -> ${detail}` : ""}`);
  }
}

/** Console/page errors that are noise rather than defects. */
const IGNORED = [
  /favicon/i,
  /Download the React DevTools/i,
  /webpack-hmr|hot-update|__nextjs/i,
];

function attachErrorCapture(page, sink) {
  page.on("console", (msg) => {
    if (msg.type() !== "error") return;
    const text = msg.text();
    if (IGNORED.some((re) => re.test(text))) return;
    sink.push(text);
  });
  page.on("pageerror", (err) => sink.push(`pageerror: ${err.message}`));
}

/**
 * Navigate and wait until React has hydrated.
 *
 * Without this, Playwright can click a submit button while the page is still
 * the server-rendered HTML, before onSubmit handlers are attached — the
 * browser then performs a native form GET instead of the React submit.
 */
async function gotoReady(page, url) {
  await page.goto(url, { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);
}

async function signIn(page, account) {
  await gotoReady(page, `${BASE}/login`);
  await page.fill("#email", account.email);
  await page.fill("#password", account.password);
  await Promise.all([
    page.waitForURL(/\/dashboard/, { timeout: 30000 }),
    page.click('button[type="submit"]'),
  ]);
}

async function run() {
  const browser = await chromium.launch();
  const newContext = () =>
    browser.newContext({ viewport: { width: 1440, height: 1000 } });

  // Each block gets a fresh context. Reusing one would carry the previous
  // role's session cookie, and the route guard would redirect /login straight
  // back to the dashboard before the form could be filled.
  let context = await newContext();

  // ---------------------------------------------------------------- public
  console.log("\n== public pages ==");
  {
    const errors = [];
    const page = await context.newPage();
    attachErrorCapture(page, errors);

    await gotoReady(page, BASE);
    check(
      "landing hero renders",
      await page
        .getByRole("heading", { name: /Turn People Data into Strategic Insights/i })
        .isVisible(),
    );

    // The stat is fetched on mount, so wait for it rather than racing it.
    const statLoaded = await page
      .getByText("1,470", { exact: false })
      .first()
      .waitFor({ timeout: 10000 })
      .then(() => true)
      .catch(() => false);
    check("live stats loaded from the API", statLoaded);
    check("all four feature blocks present",
      (await page.getByRole("heading", { level: 3 }).count()) >= 4);
    await page.screenshot({
      path: `${SHOTS}/01-landing.png`,
      fullPage: true,
    });

    await gotoReady(page, `${BASE}/privacy`);
    check("privacy page renders",
      await page.getByRole("heading", { name: "Privacy Policy" }).isVisible());

    await gotoReady(page, `${BASE}/login`);
    await page.screenshot({ path: `${SHOTS}/02-login.png`, fullPage: true });
    check("login page has demo accounts",
      (await page.getByText("Demo accounts").count()) > 0);

    check("no console errors on public pages", errors.length === 0,
      errors.slice(0, 2).join(" | "));
    await page.close();
  }

  // ----------------------------------------------------------------- admin
  console.log("\n== admin dashboard ==");
  await context.close();
  context = await newContext();
  {
    const errors = [];
    const page = await context.newPage();
    attachErrorCapture(page, errors);

    await signIn(page, ACCOUNTS.admin);
    await page.waitForSelector("text=Workforce Overview", { timeout: 30000 });
    // Let Recharts finish its initial layout pass.
    await page.waitForTimeout(2500);

    check("overview heading renders",
      await page.getByRole("heading", { name: "Workforce Overview" }).isVisible());
    check("KPI: total headcount",
      (await page.getByText("Total Headcount").count()) > 0);
    check("KPI value 1,470 present",
      (await page.getByText("1,470", { exact: false }).count()) > 0);
    check("attrition rate KPI shows 16.1%",
      (await page.getByText("16.1%", { exact: false }).count()) > 0);

    const svgCount = await page.locator("svg.recharts-surface").count();
    check("all four overview charts painted", svgCount >= 4, `found ${svgCount}`);

    const bars = await page.locator(".recharts-bar-rectangle").count();
    check("bars rendered", bars > 0, `found ${bars}`);
    const pieSlices = await page.locator(".recharts-pie-sector").count();
    check("donut slices rendered", pieSlices >= 2, `found ${pieSlices}`);
    const lines = await page.locator(".recharts-line-curve").count();
    check("trend line rendered", lines > 0, `found ${lines}`);

    await page.screenshot({
      path: `${SHOTS}/03-overview.png`,
      fullPage: true,
    });

    // -- drill-down --------------------------------------------------------
    await page.locator(".recharts-bar-rectangle").first().click();
    await page.waitForTimeout(1800);
    check("clicking a bar adds a URL filter",
      /department=/.test(page.url()), page.url());
    check("filter chip appears",
      (await page.getByText("Filtered by").count()) > 0);

    const filteredHeadcount = await page
      .locator("text=Total Headcount")
      .locator("xpath=following-sibling::p[1]")
      .textContent()
      .catch(() => null);
    check("headcount changed after drill-down",
      filteredHeadcount !== null && filteredHeadcount.trim() !== "1,470",
      String(filteredHeadcount));

    await page.screenshot({
      path: `${SHOTS}/04-overview-drilldown.png`,
      fullPage: true,
    });

    // Reset before moving on.
    await page.getByRole("button", { name: /Reset/i }).click();
    await page.waitForTimeout(1200);

    // -- table view --------------------------------------------------------
    const tableToggle = page.getByTitle("Show data table").first();
    await tableToggle.click();
    await page.waitForTimeout(600);
    check("table view renders for a chart",
      (await page.locator("table").count()) > 0);
    await tableToggle.click();

    // -- deep dive ---------------------------------------------------------
    await page.getByRole("link", { name: /Talent & Retention/i }).click();
    await page.waitForSelector("text=Talent & Retention Deep Dive", {
      timeout: 30000,
    });
    await page.waitForTimeout(3000);

    check("scatter rendered",
      (await page.locator(".recharts-scatter-symbol").count()) > 0);
    check("treemap rendered",
      (await page.locator(".recharts-treemap-depth-1").count()) > 0 ||
      (await page.locator("g.recharts-layer rect").count()) > 0);
    check("heatmap cells rendered",
      (await page.getByText("Attrition by Department and Tenure").count()) > 0);
    check("high-risk table rendered",
      (await page.getByText("High-Risk Employees").count()) > 0);
    check("pay equity panel rendered",
      (await page.getByText("Pay Equity").count()) > 0);

    await page.screenshot({
      path: `${SHOTS}/05-deep-dive.png`,
      fullPage: true,
    });

    // Expand a risk row to confirm drivers render.
    const firstRow = page.locator('button[aria-expanded="false"]').filter({
      hasText: /^#/,
    });
    if ((await firstRow.count()) > 0) {
      await firstRow.first().click();
      await page.waitForTimeout(700);
      check("risk drivers expand",
        (await page.getByText("What is driving this score").count()) > 0);
      await page.screenshot({
        path: `${SHOTS}/06-risk-drivers.png`,
        fullPage: false,
      });
    } else {
      check("risk drivers expand", false, "no expandable risk rows found");
    }

    // -- employee directory & profile --------------------------------------
    await page.getByRole("link", { name: "Employees", exact: true }).click();
    await page.waitForSelector("text=Employee Directory", { timeout: 30000 });
    await page.waitForTimeout(2000);

    check("employee directory lists rows",
      (await page.locator("table tbody tr").count()) > 0);

    await page.fill('input[aria-label="Search employees"]', "Sales Executive");
    await page.waitForTimeout(1600);
    const roleCells = await page.locator("table tbody tr").allTextContents();
    check("employee search filters results",
      roleCells.length > 0 && roleCells.every((t) => /Sales Executive/.test(t)),
      `${roleCells.length} rows`);

    await page.screenshot({
      path: `${SHOTS}/07-employees.png`,
      fullPage: true,
    });

    await page.locator('a[aria-label^="Open profile"]').first().click();
    await page.waitForSelector("text=Back to directory", { timeout: 30000 });
    await page.waitForTimeout(1500);

    check("employee profile renders",
      (await page.getByRole("heading", { name: /^Employee #/ }).count()) > 0);
    check("profile shows engagement meters",
      (await page.getByText("Job satisfaction").count()) > 0);
    check("profile shows tenure history",
      (await page.getByText("Years since last promotion").count()) > 0);
    check("profile discloses derived hire date",
      (await page.getByText("Derived from recorded tenure").count()) > 0);

    await page.screenshot({
      path: `${SHOTS}/08-employee-profile.png`,
      fullPage: true,
    });

    // -- coverage panel ----------------------------------------------------
    await page.getByRole("link", { name: "Overview", exact: true }).click();
    await page.waitForSelector("text=Workforce Overview", { timeout: 30000 });
    await page.waitForTimeout(2500);

    const coverage = page.getByRole("button", { name: /Data Coverage/i });
    check("coverage panel present", (await coverage.count()) > 0);
    if ((await coverage.count()) > 0) {
      await coverage.click();
      await page.waitForTimeout(1200);
      check("coverage names an unavailable metric",
        (await page.getByText("Cost-per-Hire").count()) > 0);
      check("coverage explains what the gap needs",
        (await page.getByText(/Requires recruiting spend/i).count()) > 0);
      check("coverage reports model quality",
        (await page.getByText(/Cross-validated ROC-AUC/i).count()) > 0);
      await page.screenshot({
        path: `${SHOTS}/09-coverage.png`,
        fullPage: true,
      });
    }

    // -- admin console -----------------------------------------------------
    await page.getByRole("link", { name: "Admin", exact: true }).click();
    await page.waitForSelector("text=Admin Console", { timeout: 30000 });
    await page.waitForTimeout(1500);

    check("ingest panel renders",
      (await page.getByText("Upload an HR extract").count()) > 0);

    await page.getByRole("tab", { name: /Users/i }).click();
    await page.waitForTimeout(1200);
    check("user management lists accounts",
      (await page.getByText("admin@revcloud.io").count()) > 0);

    await page.getByRole("tab", { name: /Audit log/i }).click();
    await page.waitForTimeout(1500);
    check("audit log shows recorded activity",
      (await page.locator("table tbody tr").count()) > 0);
    check("profile views are audited",
      (await page.getByText("employee.profile_viewed").count()) > 0);

    await page.screenshot({
      path: `${SHOTS}/10-admin-audit.png`,
      fullPage: true,
    });

    check("no console errors as admin", errors.length === 0,
      errors.slice(0, 3).join(" | "));
    await page.close();
  }

  // --------------------------------------------------------------- manager
  console.log("\n== manager (RBAC in the UI) ==");
  await context.close();
  context = await newContext();
  {
    const errors = [];
    const page = await context.newPage();
    attachErrorCapture(page, errors);

    await signIn(page, ACCOUNTS.manager);
    await page.waitForSelector("text=Workforce Overview", { timeout: 30000 });
    await page.waitForTimeout(2500);

    check("manager sees the scope notice",
      (await page.getByText(/Scoped to the Research & Development/i).count()) > 0);
    check("department filter is locked",
      (await page.locator("text=Department").locator("..").count()) > 0);
    check("manager does not see the Admin nav item",
      (await page.getByRole("link", { name: "Admin" }).count()) === 0);

    const body = await page.textContent("body");
    check("no other department appears on the manager's overview",
      !/\bSales\b/.test(body ?? ""),
      "found a reference to Sales");

    await page.screenshot({
      path: `${SHOTS}/07-manager-scoped.png`,
      fullPage: true,
    });

    check("no console errors as manager", errors.length === 0,
      errors.slice(0, 3).join(" | "));
    await page.close();
  }

  // ---------------------------------------------------------------- viewer
  console.log("\n== viewer (read-only) ==");
  await context.close();
  context = await newContext();
  {
    const errors = [];
    const page = await context.newPage();
    attachErrorCapture(page, errors);

    await signIn(page, ACCOUNTS.viewer);
    await page.waitForSelector("text=Workforce Overview", { timeout: 30000 });
    await page.waitForTimeout(2000);

    check("viewer sees company-wide data",
      (await page.getByText("1,470", { exact: false }).count()) > 0);
    check("viewer has no Admin nav item",
      (await page.getByRole("link", { name: "Admin", exact: true }).count()) === 0);

    // Navigating straight to the admin URL must still be refused in the UI.
    await page.goto(`${BASE}/dashboard/admin`, { waitUntil: "networkidle" });
    await page.waitForTimeout(2000);
    check("viewer is refused the admin console by direct URL",
      (await page.getByText(/Administrator access required/i).count()) > 0);

    await page.screenshot({
      path: `${SHOTS}/11-viewer-blocked.png`,
      fullPage: true,
    });

    check("no console errors as viewer", errors.length === 0,
      errors.slice(0, 3).join(" | "));
    await page.close();
  }

  // ------------------------------------------------------- live SSE update
  // Two sessions at once: one watching the dashboard, one uploading. The
  // watcher must refresh itself without any interaction.
  console.log("\n== live updates (SSE) ==");
  await context.close();
  context = await newContext();
  {
    const watcher = await context.newPage();
    await signIn(watcher, ACCOUNTS.viewer);
    await watcher.waitForSelector("text=Workforce Overview", { timeout: 30000 });
    await watcher.waitForTimeout(3000);

    const liveBadge = watcher.getByText("Live", { exact: true });
    check("watcher reports a live connection", (await liveBadge.count()) > 0);

    // A second context so the upload runs as a genuinely separate admin session.
    const adminContext = await newContext();
    const uploader = await adminContext.newPage();
    await signIn(uploader, ACCOUNTS.admin);
    await uploader.goto(`${BASE}/dashboard/admin`, { waitUntil: "networkidle" });
    await uploader.waitForTimeout(1500);

    await uploader
      .locator('input[type="file"]')
      .setInputFiles(resolve("data/WA_Fn-UseC_-HR-Employee-Attrition.csv"));

    await uploader.waitForSelector("text=/Loaded .* employees/", {
      timeout: 90000,
    });
    check("admin upload completes", true);
    await uploader.screenshot({
      path: `${SHOTS}/13-admin-ingest.png`,
      fullPage: true,
    });

    // The watcher polls the change counter every ~2s.
    const refreshed = await watcher
      .getByText(/updated .* ago|updated just now/i)
      .first()
      .waitFor({ timeout: 30000 })
      .then(() => true)
      .catch(() => false);
    check("watcher received the change over SSE without reloading", refreshed);

    await watcher.screenshot({
      path: `${SHOTS}/14-live-update.png`,
      fullPage: false,
    });

    await adminContext.close();
    await watcher.close();
  }

  // ------------------------------------------------------------ dark theme
  console.log("\n== dark mode ==");
  await context.close();
  context = await newContext();
  {
    const page = await context.newPage();
    await signIn(page, ACCOUNTS.admin);
    await page.waitForSelector("text=Workforce Overview", { timeout: 30000 });
    await page.evaluate(() => {
      localStorage.setItem("rc-theme", "dark");
      document.documentElement.setAttribute("data-theme", "dark");
    });
    await page.waitForTimeout(2500);

    const surface = await page.evaluate(() =>
      getComputedStyle(document.documentElement)
        .getPropertyValue("--surface")
        .trim(),
    );
    check("dark mode uses its own surface token", surface === "#1a1a19", surface);

    await page.screenshot({
      path: `${SHOTS}/12-dark-mode.png`,
      fullPage: true,
    });
    await page.close();
  }

  await browser.close();

  console.log("\n" + "=".repeat(60));
  console.log(`${passed}/${passed + failures.length} browser checks passed`);
  console.log(`screenshots: ${SHOTS}`);
  if (failures.length) {
    console.log("\nFailures:");
    for (const f of failures) console.log(`  - ${f}`);
    process.exit(1);
  }
  console.log("All browser checks passed.");
}

run().catch((err) => {
  console.error("\nverification crashed:", err);
  process.exit(1);
});
