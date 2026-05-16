export type IssuePriority = 'low' | 'medium' | 'high' | 'critical';
export type IssueStatus = 'open' | 'closed';
export type IssueCategory = 'hardware' | 'software' | 'mechanical' | 'electrical' | 'other';
export type AppRole = 'tester' | 'developer';

export type RobotType = 'LARA 3' | 'LARA 5' | 'LARA 8' | 'LARA 10' | 'MAIRA M' | 'MAIRA S' | 'MAIRA L';

export const ROBOT_TYPES: RobotType[] = [
  'LARA 3',
  'LARA 5',
  'LARA 8',
  'LARA 10',
  'MAIRA M',
  'MAIRA S',
  'MAIRA L',
];

export interface SoftwareVersion {
  id: string;
  version: string;
  description?: string | null;
  created_at?: string;
  version_type?: VersionType;
}

export type VersionType = 'software' | 'gui' | 'ai';

export interface Issue {
  id: string;
  issue_number: string;
  title: string;
  description: string;
  priority: IssuePriority;
  status: IssueStatus;
  category: IssueCategory;
  robot_type: RobotType | null;
  software_version_id: string | null;
  steps_to_reproduce: string | null;
  expected_behavior: string | null;
  actual_behavior: string | null;
  reporter_id: string | null;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  jira_issue_key?: string | null;
  software_versions?: { id: string; version: string } | null;
}

export interface IssueAttachment {
  id: string;
  issue_id: string;
  file_path: string;
  file_name: string;
  created_at: string;
}

export interface Profile {
  id: string;
  email?: string | null;
  full_name?: string | null;
  created_at?: string;
}

export interface UserRole {
  id: string;
  user_id: string;
  role: AppRole;
}
