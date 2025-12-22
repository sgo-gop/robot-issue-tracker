import { useState, useRef } from 'react';
import { useSession } from '@/hooks/useSession';
import { useIssues, useUploadAttachment } from '@/hooks/useIssues';
import { useStations } from '@/hooks/useStations';
import { useSoftwareVersions } from '@/hooks/useSoftwareVersions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { IssuePriority, IssueCategory } from '@/types/database';
import { Camera, Loader2, X, Upload } from 'lucide-react';
import { VoiceAssistant } from './VoiceAssistant';

interface IssueFormProps {
  onSuccess?: () => void;
}

export const IssueForm = ({ onSuccess }: IssueFormProps) => {
  const { user } = useSession();
  const { createIssue, isCreating } = useIssues();
  const { stations } = useStations();
  const { versions } = useSoftwareVersions();
  const uploadAttachment = useUploadAttachment();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<IssuePriority>('medium');
  const [category, setCategory] = useState<IssueCategory>('other');
  const [stationId, setStationId] = useState<string>(user?.stationId || '');
  const [softwareVersionId, setSoftwareVersionId] = useState<string>('');
  const [stepsToReproduce, setStepsToReproduce] = useState('');
  const [expectedBehavior, setExpectedBehavior] = useState('');
  const [actualBehavior, setActualBehavior] = useState('');
  const [files, setFiles] = useState<File[]>([]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles((prev) => [...prev, ...Array.from(e.target.files!)]);
    }
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const issue = await createIssue({
      title: title.trim(),
      description: description.trim(),
      priority,
      category,
      station_id: stationId || null,
      software_version_id: softwareVersionId || null,
      steps_to_reproduce: stepsToReproduce.trim() || undefined,
      expected_behavior: expectedBehavior.trim() || undefined,
      actual_behavior: actualBehavior.trim() || undefined,
      reporter_id: null, // No auth user, just session name
    });

    // Upload attachments
    for (const file of files) {
      await uploadAttachment.mutateAsync({ issueId: issue.id, file });
    }

    // Reset form
    setTitle('');
    setDescription('');
    setPriority('medium');
    setCategory('other');
    setStationId(user?.stationId || '');
    setSoftwareVersionId('');
    setStepsToReproduce('');
    setExpectedBehavior('');
    setActualBehavior('');
    setFiles([]);

    onSuccess?.();
  };

  const handleVoiceParsed = (data: {
    title: string;
    description: string;
    priority: IssuePriority;
    category: IssueCategory;
    steps_to_reproduce: string;
    expected_behavior: string;
    actual_behavior: string;
  }) => {
    if (data.title) setTitle(data.title);
    if (data.description) setDescription(data.description);
    if (data.priority) setPriority(data.priority);
    if (data.category) setCategory(data.category);
    if (data.steps_to_reproduce) setStepsToReproduce(data.steps_to_reproduce);
    if (data.expected_behavior) setExpectedBehavior(data.expected_behavior);
    if (data.actual_behavior) setActualBehavior(data.actual_behavior);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle>Report New Issue</CardTitle>
            <CardDescription>
              Reporting as <span className="font-medium">{user?.name}</span> from <span className="font-medium">{user?.stationName}</span>
            </CardDescription>
          </div>
          <VoiceAssistant onParsed={handleVoiceParsed} />
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="title">Issue Title *</Label>
              <Input
                id="title"
                placeholder="Brief description of the issue"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={200}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="station">Station</Label>
              <Select value={stationId} onValueChange={setStationId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select station" />
                </SelectTrigger>
                <SelectContent>
                  {stations.map((station) => (
                    <SelectItem key={station.id} value={station.id}>
                      {station.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="software-version">Software Version</Label>
              <Select value={softwareVersionId} onValueChange={setSoftwareVersionId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select version" />
                </SelectTrigger>
                <SelectContent>
                  {versions.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.version}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="priority">Priority</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as IssuePriority)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Select value={category} onValueChange={(v) => setCategory(v as IssueCategory)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="hardware">Hardware</SelectItem>
                  <SelectItem value="software">Software</SelectItem>
                  <SelectItem value="mechanical">Mechanical</SelectItem>
                  <SelectItem value="electrical">Electrical</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description *</Label>
            <Textarea
              id="description"
              placeholder="Detailed description of the issue..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              maxLength={2000}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="steps">Steps to Reproduce</Label>
            <Textarea
              id="steps"
              placeholder="1. First step&#10;2. Second step&#10;3. ..."
              value={stepsToReproduce}
              onChange={(e) => setStepsToReproduce(e.target.value)}
              rows={3}
              maxLength={2000}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="expected">Expected Behavior</Label>
              <Textarea
                id="expected"
                placeholder="What should happen?"
                value={expectedBehavior}
                onChange={(e) => setExpectedBehavior(e.target.value)}
                rows={2}
                maxLength={1000}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="actual">Actual Behavior</Label>
              <Textarea
                id="actual"
                placeholder="What actually happened?"
                value={actualBehavior}
                onChange={(e) => setActualBehavior(e.target.value)}
                rows={2}
                maxLength={1000}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Attachments</Label>
            <div className="flex flex-wrap gap-2">
              {files.map((file, index) => (
                <div
                  key={index}
                  className="flex items-center gap-2 rounded-md border bg-muted px-3 py-2 text-sm"
                >
                  <span className="max-w-[150px] truncate">{file.name}</span>
                  <button
                    type="button"
                    onClick={() => removeFile(index)}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleFileChange}
                className="hidden"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="mr-2 h-4 w-4" />
                Upload Photos
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  if (fileInputRef.current) {
                    fileInputRef.current.capture = 'environment';
                    fileInputRef.current.click();
                  }
                }}
              >
                <Camera className="mr-2 h-4 w-4" />
                Take Photo
              </Button>
            </div>
          </div>

          <Button type="submit" className="w-full" disabled={isCreating}>
            {isCreating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Submit Issue
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};
