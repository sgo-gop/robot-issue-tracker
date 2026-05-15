import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSession } from '@/hooks/useSession';
import { useIssues } from '@/hooks/useIssues';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { StatsCard } from '@/components/dashboard/StatsCard';
import { IssueChart } from '@/components/dashboard/IssueChart';
import { IssueForm } from '@/components/issues/IssueForm';
import { IssueTable } from '@/components/issues/IssueTable';
import { PDFReport } from '@/components/reports/PDFReport';
import { ClearAllIssues } from '@/components/admin/ClearAllIssues';
import { ManageSoftwareVersions } from '@/components/admin/ManageSoftwareVersions';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, CheckCircle2, Clock, AlertTriangle, LayoutDashboard, PlusCircle, Settings, FileText } from 'lucide-react';

const Index = () => {
  const navigate = useNavigate();
  const { user } = useSession();
  const { issues, isLoading: issuesLoading, closeIssue, isClosing } = useIssues();

  useEffect(() => {
    if (!user) {
      navigate('/auth');
    }
  }, [user, navigate]);

  if (!user) return null;

  const openIssues = issues.filter((i) => i.status === 'open');
  const closedIssues = issues.filter((i) => i.status === 'closed');
  const criticalIssues = issues.filter((i) => i.priority === 'critical' && i.status === 'open');
  const highPriorityIssues = issues.filter((i) => (i.priority === 'critical' || i.priority === 'high') && i.status === 'open');

  const priorityData = [
    { name: 'Critical', value: issues.filter((i) => i.priority === 'critical').length, color: 'hsl(0, 84%, 60%)' },
    { name: 'High', value: issues.filter((i) => i.priority === 'high').length, color: 'hsl(25, 95%, 53%)' },
    { name: 'Medium', value: issues.filter((i) => i.priority === 'medium').length, color: 'hsl(48, 96%, 53%)' },
    { name: 'Low', value: issues.filter((i) => i.priority === 'low').length, color: 'hsl(142, 71%, 45%)' },
  ].filter((d) => d.value > 0);

  const statusData = [
    { name: 'Open', value: openIssues.length, color: 'hsl(221, 83%, 53%)' },
    { name: 'Closed', value: closedIssues.length, color: 'hsl(142, 71%, 45%)' },
  ].filter((d) => d.value > 0);

  const categoryData = [
    { name: 'Hardware', value: issues.filter((i) => i.category === 'hardware').length, color: 'hsl(262, 83%, 58%)' },
    { name: 'Software', value: issues.filter((i) => i.category === 'software').length, color: 'hsl(221, 83%, 53%)' },
    { name: 'Mechanical', value: issues.filter((i) => i.category === 'mechanical').length, color: 'hsl(25, 95%, 53%)' },
    { name: 'Electrical', value: issues.filter((i) => i.category === 'electrical').length, color: 'hsl(48, 96%, 53%)' },
    { name: 'Other', value: issues.filter((i) => i.category === 'other').length, color: 'hsl(215, 14%, 34%)' },
  ].filter((d) => d.value > 0);

  return (
    <DashboardLayout>
      <Tabs defaultValue="dashboard" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-grid">
          <TabsTrigger value="dashboard" className="gap-2">
            <LayoutDashboard className="h-4 w-4" />
            <span className="hidden sm:inline">Dashboard</span>
          </TabsTrigger>
          <TabsTrigger value="report" className="gap-2">
            <PlusCircle className="h-4 w-4" />
            <span className="hidden sm:inline">Report Issue</span>
          </TabsTrigger>
          <TabsTrigger value="manage" className="gap-2">
            <Settings className="h-4 w-4" />
            <span className="hidden sm:inline">All Issues</span>
          </TabsTrigger>
          <TabsTrigger value="reports" className="gap-2">
            <FileText className="h-4 w-4" />
            <span className="hidden sm:inline">Reports</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <StatsCard
              title="Open Issues"
              value={issuesLoading ? '-' : openIssues.length}
              icon={AlertCircle}
              description="Requires attention"
              className="border-l-4 border-l-blue-500"
            />
            <StatsCard
              title="Closed Issues"
              value={issuesLoading ? '-' : closedIssues.length}
              icon={CheckCircle2}
              description="Resolved"
              className="border-l-4 border-l-green-500"
            />
            <StatsCard
              title="Critical"
              value={issuesLoading ? '-' : criticalIssues.length}
              icon={AlertTriangle}
              description="Immediate action needed"
              className="border-l-4 border-l-red-500"
            />
            <StatsCard
              title="High Priority"
              value={issuesLoading ? '-' : highPriorityIssues.length}
              icon={Clock}
              description="Critical + High"
              className="border-l-4 border-l-orange-500"
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {priorityData.length > 0 && <IssueChart title="Issues by Priority" data={priorityData} />}
            {statusData.length > 0 && <IssueChart title="Issues by Status" data={statusData} />}
            {categoryData.length > 0 && <IssueChart title="Issues by Category" data={categoryData} />}
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Recent Issues</CardTitle>
              <CardDescription>Latest reported issues from all robots</CardDescription>
            </CardHeader>
            <CardContent>
              {issuesLoading ? (
                <div className="space-y-3">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : (
                <IssueTable issues={issues.slice(0, 10)} />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="report">
          <div className="max-w-3xl mx-auto">
            <IssueForm />
          </div>
        </TabsContent>

        <TabsContent value="manage" className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>All Issues</CardTitle>
                <CardDescription>View and manage all reported issues</CardDescription>
              </div>
              <div className="flex gap-2 flex-wrap">
                <ManageSoftwareVersions />
                <ClearAllIssues />
              </div>
            </CardHeader>
            <CardContent>
              {issuesLoading ? (
                <div className="space-y-3">
                  {[...Array(10)].map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : (
                <IssueTable
                  issues={issues}
                  showActions
                  onCloseIssue={closeIssue}
                  isClosing={isClosing}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reports">
          <div className="max-w-2xl mx-auto">
            <PDFReport issues={issues} />
          </div>
        </TabsContent>
      </Tabs>
    </DashboardLayout>
  );
};

export default Index;
