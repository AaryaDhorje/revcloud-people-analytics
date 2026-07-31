"use client";

import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

import type { DeepDiveResponse, HighRiskEmployee } from "./types";

/**
 * PDF export.
 *
 * Runs in the browser rather than on the server: the numbers are already
 * loaded here, and keeping a PDF engine out of the Python bundle matters when
 * the serverless function has a hard size ceiling. CSV export stays
 * server-side, where the RBAC scope is applied to the file itself.
 */
export function exportDeepDivePdf({
  data,
  scopeLabel,
  filterSummary,
}: {
  data: DeepDiveResponse;
  scopeLabel: string;
  filterSummary: string;
}) {
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  const margin = 40;
  let cursor = margin;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("Talent & Retention Deep Dive", margin, cursor);
  cursor += 20;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(110);
  doc.text(`RevCloud People Analytics · ${scopeLabel}`, margin, cursor);
  cursor += 14;
  doc.text(
    `Generated ${new Date(data.generated_at).toLocaleString()}`,
    margin,
    cursor,
  );
  cursor += 14;
  doc.text(`Filters: ${filterSummary}`, margin, cursor);
  cursor += 24;

  // --- pay equity ---------------------------------------------------------
  doc.setTextColor(20);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Pay equity", margin, cursor);
  cursor += 6;

  const equityRows = Object.entries(data.pay_equity.by_gender).map(
    ([gender, stats]) => [
      gender,
      String(stats.headcount),
      stats.mean_income ? `$${Math.round(stats.mean_income).toLocaleString()}` : "—",
      stats.median_income
        ? `$${Math.round(stats.median_income).toLocaleString()}`
        : "—",
    ],
  );

  autoTable(doc, {
    startY: cursor + 6,
    head: [["Gender", "Headcount", "Mean income", "Median income"]],
    body: equityRows,
    margin: { left: margin, right: margin },
    styles: { fontSize: 9, cellPadding: 5 },
    headStyles: { fillColor: [42, 120, 214], textColor: 255 },
  });

  // @ts-expect-error - lastAutoTable is attached by the plugin at runtime
  cursor = (doc.lastAutoTable?.finalY ?? cursor) + 16;

  if (data.pay_equity.gap_pct !== null) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(110);
    const gap = data.pay_equity.gap_pct;
    doc.text(
      gap >= 0
        ? `Women are paid ${gap.toFixed(1)}% less than men on average.`
        : `Women are paid ${Math.abs(gap).toFixed(1)}% more than men on average.`,
      margin,
      cursor,
    );
    cursor += 20;
  }

  // --- attrition by job role ----------------------------------------------
  doc.setTextColor(20);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Attrition by job role", margin, cursor);

  autoTable(doc, {
    startY: cursor + 12,
    head: [["Job role", "Headcount", "Attrition rate"]],
    body: data.treemap.map((node) => [
      node.name,
      String(node.size),
      `${node.attrition_rate.toFixed(1)}%`,
    ]),
    margin: { left: margin, right: margin },
    styles: { fontSize: 9, cellPadding: 5 },
    headStyles: { fillColor: [42, 120, 214], textColor: 255 },
  });

  // --- high risk ----------------------------------------------------------
  if (data.high_risk.length > 0) {
    doc.addPage();
    cursor = margin;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("Highest modelled attrition risk", margin, cursor);

    autoTable(doc, {
      startY: cursor + 12,
      head: [
        ["#", "Department", "Role", "Tenure", "Risk", "Band", "Top driver"],
      ],
      body: data.high_risk
        .slice(0, 40)
        .map((employee: HighRiskEmployee) => [
          String(employee.employee_number),
          employee.department,
          employee.job_role,
          `${employee.years_at_company} yr`,
          `${employee.risk_score.toFixed(0)}%`,
          employee.risk_band,
          employee.risk_drivers[0]?.label ?? "—",
        ]),
      margin: { left: margin, right: margin },
      styles: { fontSize: 8, cellPadding: 4 },
      headStyles: { fillColor: [42, 120, 214], textColor: 255 },
      columnStyles: { 6: { cellWidth: 110 } },
    });

    // @ts-expect-error - lastAutoTable is attached by the plugin at runtime
    const afterTable = (doc.lastAutoTable?.finalY ?? cursor) + 16;
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8);
    doc.setTextColor(110);
    doc.text(
      "Risk scores are statistical estimates, not determinations about individuals.",
      margin,
      afterTable,
      { maxWidth: 515 },
    );
  }

  const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
  doc.save(`revcloud-deep-dive-${stamp}.pdf`);
}
