/** Mirrors the pydantic schemas in `backend/schemas.py`. */

export type Role = "admin" | "manager" | "viewer";

export interface User {
  id: number;
  email: string;
  full_name: string;
  role: Role;
  department: string | null;
  is_active: boolean;
  created_at: string;
  last_login_at: string | null;
}

export interface Session {
  user: User;
  access_token_expires_in: number;
  idle_timeout_minutes: number;
}

export type MetricUnit =
  | "count"
  | "percent"
  | "currency"
  | "score"
  | "years"
  | "days"
  | "none";

export interface KpiCard {
  key: string;
  label: string;
  value: number | null;
  unit: MetricUnit;
  delta: number | null;
  caption: string | null;
  available: boolean;
  unavailable_reason: string | null;
}

export interface NamedValue {
  name: string;
  value: number;
}

export interface DepartmentAttrition {
  department: string;
  headcount: number;
  attrition_count: number;
  attrition_rate: number;
}

export interface AgeGenderAttrition {
  age_group: string;
  male_attrition: number;
  female_attrition: number;
  male_headcount: number;
  female_headcount: number;
}

export interface TrendPoint {
  period: string;
  exits: number;
  headcount: number;
  attrition_rate: number;
}

export interface OverviewResponse {
  kpis: KpiCard[];
  gender_distribution: NamedValue[];
  attrition_by_department: DepartmentAttrition[];
  attrition_by_age_gender: AgeGenderAttrition[];
  attrition_trend: TrendPoint[];
  generated_at: string;
  scope_note: string | null;
}

export interface ScatterPoint {
  years_at_company: number;
  monthly_income: number;
  attrition: boolean;
  job_role: string;
  department: string;
}

export interface TreemapNode {
  name: string;
  size: number;
  attrition_rate: number;
}

export interface HeatmapCell {
  department: string;
  tenure_band: string;
  headcount: number;
  attrition_count: number;
  attrition_rate: number;
}

export interface RiskDriver {
  feature: string;
  label: string;
  contribution: number;
  direction: "increases" | "decreases";
}

export interface HighRiskEmployee {
  employee_number: number;
  department: string;
  job_role: string;
  age: number;
  years_at_company: number;
  monthly_income: number;
  over_time: boolean;
  job_satisfaction: number;
  years_since_last_promotion: number;
  engagement_index: number;
  risk_score: number;
  risk_band: string;
  risk_drivers: RiskDriver[];
}

export interface PayEquity {
  by_gender: Record<
    string,
    { headcount: number; mean_income: number | null; median_income: number | null }
  >;
  gap_pct: number | null;
  note: string;
}

export interface DeepDiveResponse {
  scatter: ScatterPoint[];
  treemap: TreemapNode[];
  heatmap: HeatmapCell[];
  high_risk: HighRiskEmployee[];
  pay_equity: PayEquity;
  generated_at: string;
  model_available: boolean;
  scope_note: string | null;
}

export interface FilterOptions {
  departments: string[];
  job_roles: string[];
  age_groups: string[];
  tenure_bands: string[];
  date_range: { min: string | null; max: string | null };
  locked_department: string | null;
}

export interface CoverageMetric {
  key: string;
  label: string;
  category: string;
  unit: MetricUnit;
  available: boolean;
  note: string | null;
  value: number | null;
  unlockable?: boolean;
}

export interface ModelMetadata {
  version: string;
  trained_at: string;
  metrics: Record<string, number>;
  n_features: number;
}

export interface CoverageResponse {
  metrics: CoverageMetric[];
  summary: { total: number; available: number; unavailable: number };
  model: ModelMetadata | null;
  scope_note: string | null;
}

export interface EmployeeSummary {
  employee_number: number;
  department: string;
  job_role: string;
  age: number;
  gender: string;
  years_at_company: number;
  monthly_income: number;
  attrition: boolean;
  risk_score: number | null;
  risk_band: string | null;
}

export interface EmployeeProfile extends EmployeeSummary {
  marital_status: string;
  education: number;
  education_field: string;
  distance_from_home: number;
  job_level: number;
  business_travel: string;
  over_time: boolean;
  monthly_rate: number;
  daily_rate: number;
  hourly_rate: number;
  percent_salary_hike: number;
  stock_option_level: number;
  job_satisfaction: number;
  environment_satisfaction: number;
  relationship_satisfaction: number;
  job_involvement: number;
  work_life_balance: number;
  performance_rating: number;
  training_times_last_year: number;
  total_working_years: number;
  num_companies_worked: number;
  years_in_current_role: number;
  years_since_last_promotion: number;
  years_with_curr_manager: number;
  age_group: string;
  tenure_band: string;
  engagement_index: number;
  enps_category: string;
  hire_date: string;
  exit_date: string | null;
  risk_drivers: RiskDriver[] | null;
}

export interface EmployeeSearchResponse {
  results: EmployeeSummary[];
  total: number;
  page: number;
  page_size: number;
}

export interface IngestRun {
  id: number;
  filename: string;
  status: "running" | "succeeded" | "failed";
  rows_received: number;
  rows_loaded: number;
  rows_rejected: number;
  error: string | null;
  warnings: string[] | null;
  started_at: string;
  finished_at: string | null;
}

export interface AuditLogEntry {
  id: number;
  actor_email: string | null;
  action: string;
  resource: string;
  detail: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: string;
}

export interface DemoRequestRow {
  id: number;
  email: string;
  full_name: string | null;
  company: string | null;
  message: string | null;
  created_at: string;
}

export interface AdminSettings {
  annual_revenue: number | null;
  currency: string;
  active_headcount: number;
  revenue_per_employee: number | null;
}

export interface DashboardFilters {
  department: string[];
  job_role: string[];
  age_group: string[];
  tenure_band: string[];
  date_from: string | null;
  date_to: string | null;
}

export const EMPTY_FILTERS: DashboardFilters = {
  department: [],
  job_role: [],
  age_group: [],
  tenure_band: [],
  date_from: null,
  date_to: null,
};
