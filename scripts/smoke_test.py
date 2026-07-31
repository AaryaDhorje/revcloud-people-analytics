"""End-to-end API check against a running backend.

    python -m scripts.smoke_test [--base-url http://127.0.0.1:8000]

Exercises the paths that are easy to get subtly wrong — RBAC row scoping,
cross-department probing, role gates, filter behaviour and export scoping —
rather than just asserting that endpoints return 200.
"""

from __future__ import annotations

import argparse
import sys

import httpx

ADMIN = ("admin@revcloud.io", "Admin123!")
MANAGER = ("manager@revcloud.io", "Manager123!")
VIEWER = ("viewer@revcloud.io", "Viewer123!")

MANAGER_DEPARTMENT = "Research & Development"

passed = 0
failed: list[str] = []


def check(label: str, condition: bool, detail: str = "") -> None:
    global passed
    if condition:
        passed += 1
        print(f"  PASS  {label}")
    else:
        failed.append(label)
        print(f"  FAIL  {label}" + (f"  -> {detail}" if detail else ""))


def login(client: httpx.Client, credentials: tuple[str, str]) -> httpx.Client:
    response = client.post(
        "/api/py/auth/login",
        json={"email": credentials[0], "password": credentials[1]},
    )
    response.raise_for_status()
    return client


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-url", default="http://127.0.0.1:8000")
    args = parser.parse_args()

    base = args.base_url.rstrip("/")

    print("\n== health ==")
    with httpx.Client(base_url=base, timeout=30) as anon:
        health = anon.get("/api/py/health").json()
        check("health reports ok", health["status"] == "ok", str(health))
        check("database connected", health["database"]["connected"])
        check("model artefact loaded", health.get("model") is not None)

        print("\n== public (unauthenticated) ==")
        stats = anon.get("/api/py/public/stats")
        check("public stats reachable without a token", stats.status_code == 200)
        check(
            "public stats report the seeded population",
            stats.json().get("employees_analyzed") == 1470,
            str(stats.json()),
        )

        demo = anon.post(
            "/api/py/public/demo-request",
            json={"email": "cfo@example.com", "company": "Example Corp",
                  "message": "Interested in the retention module."},
        )
        check("demo request accepted", demo.status_code == 201)

        blocked = anon.get("/api/py/analytics/overview")
        check(
            "analytics rejects anonymous callers",
            blocked.status_code == 401,
            f"got {blocked.status_code}",
        )

    print("\n== admin: company-wide ==")
    with httpx.Client(base_url=base, timeout=60) as client:
        login(client, ADMIN)

        me = client.get("/api/py/auth/me").json()
        check("admin identity resolves", me["user"]["role"] == "admin")

        overview = client.get("/api/py/analytics/overview").json()
        kpis = {k["key"]: k["value"] for k in overview["kpis"]}
        check(
            "headcount is the full population",
            kpis["headcount"] == 1470,
            str(kpis),
        )
        check(
            "attrition rate matches the dataset",
            abs(kpis["attrition_rate"] - 16.12) < 0.05,
            str(kpis["attrition_rate"]),
        )
        check("all four brief KPI cards present", len(overview["kpis"]) == 4)
        check(
            "admin sees every department",
            len(overview["attrition_by_department"]) == 3,
            str([d["department"] for d in overview["attrition_by_department"]]),
        )
        check("attrition trend has points", len(overview["attrition_trend"]) > 0)
        check("admin has no scope note", overview["scope_note"] is None)

        deep = client.get("/api/py/analytics/deep-dive").json()
        check("scatter populated", len(deep["scatter"]) == 1470)
        check("treemap covers all job roles", len(deep["treemap"]) == 9)
        check("heatmap populated", len(deep["heatmap"]) > 0)
        check("high-risk table populated", len(deep["high_risk"]) > 0)
        check("model reported available", deep["model_available"] is True)
        check(
            "high-risk rows carry explanations",
            all(len(r["risk_drivers"]) > 0 for r in deep["high_risk"]),
        )
        check(
            "high-risk excludes people who already left",
            all(r["risk_score"] is not None for r in deep["high_risk"]),
        )
        check(
            "pay equity gap is computed",
            deep["pay_equity"]["gap_pct"] is not None,
            str(deep["pay_equity"]),
        )

        coverage = client.get("/api/py/analytics/coverage").json()
        summary = coverage["summary"]
        check(
            "coverage declares unavailable metrics honestly",
            summary["unavailable"] >= 4,
            str(summary),
        )
        unavailable = {m["key"] for m in coverage["metrics"] if not m["available"]}
        check(
            "cost-per-hire is flagged unavailable",
            "cost_per_hire" in unavailable,
            str(unavailable),
        )
        check(
            "every unavailable metric explains what it needs",
            all(
                m["note"]
                for m in coverage["metrics"]
                if not m["available"]
            ),
        )

        print("\n== filters ==")
        filtered = client.get(
            "/api/py/analytics/overview", params={"department": "Sales"}
        ).json()
        sales_headcount = {k["key"]: k["value"] for k in filtered["kpis"]}["headcount"]
        check(
            "department filter reduces headcount",
            0 < sales_headcount < 1470,
            str(sales_headcount),
        )
        check(
            "department filter narrows the breakdown to one department",
            len(filtered["attrition_by_department"]) == 1
            and filtered["attrition_by_department"][0]["department"] == "Sales",
        )

        multi = client.get(
            "/api/py/analytics/overview",
            params=[("department", "Sales"), ("department", "Human Resources")],
        ).json()
        check(
            "multi-select department filter works",
            len(multi["attrition_by_department"]) == 2,
            str([d["department"] for d in multi["attrition_by_department"]]),
        )

        options = client.get("/api/py/analytics/filters").json()
        check("filter options list departments", len(options["departments"]) == 3)
        check("filter options list job roles", len(options["job_roles"]) == 9)
        check(
            "admin filter options are not locked",
            options["locked_department"] is None,
        )

        print("\n== admin: privileged routes ==")
        users = client.get("/api/py/admin/users")
        check("admin can list users", users.status_code == 200)
        runs = client.get("/api/py/admin/ingest-runs")
        check("admin can list ingest runs", runs.status_code == 200)
        audits = client.get("/api/py/admin/audit-logs").json()
        check("audit log is recording activity", len(audits) > 0, str(len(audits)))
        check(
            "dashboard views are audited",
            any(a["action"] == "analytics.overview" for a in audits),
        )

        export = client.get("/api/py/exports/employees.csv")
        lines = export.text.strip().splitlines()
        check("csv export succeeds", export.status_code == 200)
        check(
            "csv export contains every employee",
            len(lines) == 1471,
            f"{len(lines)} lines",
        )

        revenue = client.put(
            "/api/py/admin/settings/annual-revenue",
            json={"annual_revenue": 500_000_000, "currency": "USD"},
        )
        check("annual revenue can be set", revenue.status_code == 200)

        coverage2 = client.get("/api/py/analytics/coverage").json()
        rpe = next(
            m for m in coverage2["metrics"] if m["key"] == "revenue_per_employee"
        )
        check(
            "setting revenue unlocks revenue-per-employee",
            rpe["available"] and rpe["value"] is not None,
            str(rpe),
        )

    print("\n== manager: department-scoped ==")
    with httpx.Client(base_url=base, timeout=60) as client:
        login(client, MANAGER)

        overview = client.get("/api/py/analytics/overview").json()
        headcount = {k["key"]: k["value"] for k in overview["kpis"]}["headcount"]
        check(
            "manager sees fewer employees than admin",
            0 < headcount < 1470,
            str(headcount),
        )
        check(
            "manager sees only their department",
            len(overview["attrition_by_department"]) == 1
            and overview["attrition_by_department"][0]["department"]
            == MANAGER_DEPARTMENT,
            str([d["department"] for d in overview["attrition_by_department"]]),
        )
        check("manager gets a scope note", overview["scope_note"] is not None)

        # The important one: asking for another department must not widen access.
        escalation = client.get(
            "/api/py/analytics/overview", params={"department": "Sales"}
        ).json()
        check(
            "manager cannot widen scope via query parameter",
            len(escalation["attrition_by_department"]) == 1
            and escalation["attrition_by_department"][0]["department"]
            == MANAGER_DEPARTMENT,
            str([d["department"] for d in escalation["attrition_by_department"]]),
        )

        options = client.get("/api/py/analytics/filters").json()
        check(
            "manager filter options are locked to their department",
            options["locked_department"] == MANAGER_DEPARTMENT
            and options["departments"] == [MANAGER_DEPARTMENT],
            str(options["departments"]),
        )

        directory = client.get("/api/py/employees", params={"page_size": 5}).json()
        check(
            "manager directory is scoped",
            all(r["department"] == MANAGER_DEPARTMENT for r in directory["results"]),
        )
        check(
            "manager directory total is below company total",
            0 < directory["total"] < 1470,
            str(directory["total"]),
        )

        in_scope = directory["results"][0]["employee_number"]
        check(
            "manager can open an in-scope profile",
            client.get(f"/api/py/employees/{in_scope}").status_code == 200,
        )

        export = client.get("/api/py/exports/employees.csv")
        export_lines = export.text.strip().splitlines()
        check(
            "manager csv export is scoped to their department",
            len(export_lines) - 1 == directory["total"],
            f"{len(export_lines) - 1} rows vs {directory['total']}",
        )
        check(
            "manager export contains no other department",
            "Sales" not in export.text and "Human Resources" not in export.text,
        )

        check(
            "manager is blocked from user administration",
            client.get("/api/py/admin/users").status_code == 403,
        )
        check(
            "manager is blocked from data ingestion",
            client.post(
                "/api/py/admin/ingest",
                files={"file": ("x.csv", b"Age\n1\n", "text/csv")},
            ).status_code
            == 403,
        )

    print("\n== manager: cross-department probing ==")
    with httpx.Client(base_url=base, timeout=60) as admin_client:
        login(admin_client, ADMIN)
        sales = admin_client.get(
            "/api/py/employees", params={"department": "Sales", "page_size": 1}
        ).json()["results"][0]["employee_number"]

    with httpx.Client(base_url=base, timeout=60) as client:
        login(client, MANAGER)
        probe = client.get(f"/api/py/employees/{sales}")
        check(
            "manager cannot read an out-of-scope employee",
            probe.status_code == 404,
            f"got {probe.status_code}",
        )

    print("\n== viewer: read-only ==")
    with httpx.Client(base_url=base, timeout=60) as client:
        login(client, VIEWER)
        check(
            "viewer can read the dashboard",
            client.get("/api/py/analytics/overview").status_code == 200,
        )
        check(
            "viewer is blocked from administration",
            client.get("/api/py/admin/users").status_code == 403,
        )
        check(
            "viewer is blocked from ingestion",
            client.post(
                "/api/py/admin/ingest",
                files={"file": ("x.csv", b"Age\n1\n", "text/csv")},
            ).status_code
            == 403,
        )

    print("\n== session lifecycle ==")
    with httpx.Client(base_url=base, timeout=60) as client:
        login(client, VIEWER)
        check("session refresh issues new tokens",
              client.post("/api/py/auth/refresh").status_code == 200)
        check("logout succeeds", client.post("/api/py/auth/logout").status_code == 204)
        check(
            "session is unusable after logout",
            client.get("/api/py/analytics/overview").status_code == 401,
        )

        bad = client.post(
            "/api/py/auth/login",
            json={"email": "admin@revcloud.io", "password": "wrong-password"},
        )
        check("wrong password is rejected", bad.status_code == 401)

        unknown = client.post(
            "/api/py/auth/login",
            json={"email": "nobody@example.com", "password": "whatever123"},
        )
        check(
            "unknown email returns the same error as a wrong password",
            unknown.status_code == 401
            and unknown.json()["detail"] == bad.json()["detail"],
        )

        weak = client.post(
            "/api/py/auth/register",
            json={"email": "weak@example.com", "password": "allletters",
                  "full_name": "Weak Password"},
        )
        check("weak password is rejected", weak.status_code == 422, weak.text[:120])

        forgot = client.post(
            "/api/py/auth/forgot-password", json={"email": "nobody@example.com"}
        )
        check(
            "forgot-password does not leak whether an account exists",
            forgot.status_code == 202,
        )

    print("\n" + "=" * 60)
    total = passed + len(failed)
    print(f"{passed}/{total} checks passed")
    if failed:
        print("\nFailures:")
        for name in failed:
            print(f"  - {name}")
        return 1
    print("All checks passed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
