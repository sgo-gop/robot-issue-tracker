import { IssuePriority, IssueStatus, IssueCategory } from '@/types/database';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface PriorityBadgeProps {
  priority: IssuePriority;
}

export const PriorityBadge = ({ priority }: PriorityBadgeProps) => {
  const styles = {
    low: 'bg-muted text-muted-foreground',
    medium: 'bg-primary/20 text-primary',
    high: 'bg-warning/20 text-warning',
    critical: 'bg-destructive/20 text-destructive',
  };

  return (
    <Badge className={cn('capitalize', styles[priority])}>
      {priority}
    </Badge>
  );
};

interface StatusBadgeProps {
  status: IssueStatus;
}

export const StatusBadge = ({ status }: StatusBadgeProps) => {
  const styles = {
    open: 'bg-warning/20 text-warning',
    closed: 'bg-success/20 text-success',
  };

  return (
    <Badge className={cn('capitalize', styles[status])}>
      {status}
    </Badge>
  );
};

interface CategoryBadgeProps {
  category: IssueCategory;
}

export const CategoryBadge = ({ category }: CategoryBadgeProps) => {
  return (
    <Badge variant="outline" className="capitalize">
      {category}
    </Badge>
  );
};