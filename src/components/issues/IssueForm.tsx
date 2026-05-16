import { useState, useRef } from 'react';
import { useSession } from '@/hooks/useSession';
import { useIssues, useUploadAttachment } from '@/hooks/useIssues';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { IssuePriority, IssueCategory, RobotType, ROBOT_TYPES, OTHER_EQUIPMENT } from '@/types/database';
import { Camera, Loader2, X, Upload } from 'lucide-react';
import { VersionCombobox } from './VersionCombobox';
import { FieldVoiceInput } from './FieldVoiceInput';
import { useToast } from '@/hooks/use-toast';

interface IssueFormProps {
  onSuccess?: () => void;
}

export const IssueForm = ({ onSuccess }: IssueFormProps) => {
  const { user } = useSession();
  const { createIssue, isCreating } = useIssues();
  const uploadAttachment = useUploadAttachment();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<IssuePriority>('medium');
  const [category, setCategory] = useState<IssueCategory>('other');
  const [robotType, setRobotType] = useState<string>(user?.robotType || '');
  const [softwareVersionId, setSoftwareVersionId] = useState<string>('');
  const [guiVersionId, setGuiVersionId] = useState<string>('');
  const [aiVersionId, setAiVersionId] = useState<string>('');
  const [driveFirmwareVersionId, setDriveFirmwareVersionId] = useState<string>('');
  const [safetyLogicVersionId, setSafetyLogicVersionId] = useState<string>('');
  const [safetyFirmwareVersionId, setSafetyFirmwareVersionId] = useState<string>('');
  const [otherEquipment, setOtherEquipment] = useState<string>('');
  const [stepsToReproduce, setStepsToReproduce] = useState('');
  const [expectedBehavior, setExpectedBehavior] = useState('');
  const [actualBehavior, setActualBehavior] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [errors, setErrors] = useState<Record<string, boolean>>({});

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

    const trimmedTitle = title.trim();
    const trimmedDescription = description.trim();
    const trimmedSteps = stepsToReproduce.trim();
    const trimmedExpected = expectedBehavior.trim();
    const trimmedActual = actualBehavior.trim();

    const newErrors: Record<string, boolean> = {};

    if (!trimmedTitle) newErrors.title = true;
    if (!trimmedDescription) newErrors.description = true;
    if (!trimmedSteps) newErrors.steps = true;
    if (!trimmedExpected) newErrors.expected = true;
    if (!trimmedActual) newErrors.actual = true;

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      toast({ title: 'Missing required fields', description: 'Please fill in all highlighted fields before submitting.', variant: 'destructive' });
      return;
    }

    setErrors({});

    const issue = await createIssue({
      title: trimmedTitle,
      description: trimmedDescription,
      priority,
      category,
      robot_type: (robotType || null) as RobotType | null,
      software_version_id: softwareVersionId || null,
      gui_version_id: guiVersionId || null,
      ai_version_id: aiVersionId || null,
      drive_firmware_version_id: driveFirmwareVersionId || null,
      safety_logic_version_id: safetyLogicVersionId || null,
      safety_firmware_version_id: safetyFirmwareVersionId || null,
      other_equipment: otherEquipment || null,
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
    setRobotType(user?.robotType || '');
    setSoftwareVersionId('');
    setGuiVersionId('');
    setAiVersionId('');
    setDriveFirmwareVersionId('');
    setSafetyLogicVersionId('');
    setSafetyFirmwareVersionId('');
    setOtherEquipment('');
    setStepsToReproduce('');
    setExpectedBehavior('');
    setActualBehavior('');
    setFiles([]);

    onSuccess?.();
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle>Report New Issue</CardTitle>
            <CardDescription>
              Reporting as <span className="font-medium">{user?.name}</span> on <span className="font-medium">{user?.robotType}</span>
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="title" className={errors.title ? 'text-destructive' : ''}>Issue Title *</Label>
              <Input
                id="title"
                placeholder="Brief description of the issue"
                value={title}
                onChange={(e) => { setTitle(e.target.value); if (errors.title) setErrors((prev) => ({ ...prev, title: false })); }}
                maxLength={200}
                className={errors.title ? 'border-destructive focus-visible:ring-destructive' : ''}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="robot-type">Robot Type</Label>
              <Select value={robotType} onValueChange={setRobotType}>
                <SelectTrigger>
                  <SelectValue placeholder="Select robot type" />
                </SelectTrigger>
                <SelectContent>
                  {ROBOT_TYPES.map((rt) => (
                    <SelectItem key={rt} value={rt}>
                      {rt}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="other-equipment">Others</Label>
              <Select value={otherEquipment} onValueChange={setOtherEquipment}>
                <SelectTrigger>
                  <SelectValue placeholder="Select other equipment" />
                </SelectTrigger>
                <SelectContent>
                  {OTHER_EQUIPMENT.map((oe) => (
                    <SelectItem key={oe} value={oe}>
                      {oe}
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

          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Software Version</Label>
              <VersionCombobox versionType="software" value={softwareVersionId} onChange={setSoftwareVersionId} placeholder="Select or type Software version" />
            </div>
            <div className="space-y-2">
              <Label>GUI Version</Label>
              <VersionCombobox versionType="gui" value={guiVersionId} onChange={setGuiVersionId} placeholder="Select or type GUI version" />
            </div>
            <div className="space-y-2">
              <Label>AI Version</Label>
              <VersionCombobox versionType="ai" value={aiVersionId} onChange={setAiVersionId} placeholder="Select or type AI version" />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Drive Firmware</Label>
              <VersionCombobox versionType="drive_firmware" value={driveFirmwareVersionId} onChange={setDriveFirmwareVersionId} placeholder="Select or type Drive Firmware" />
            </div>
            <div className="space-y-2">
              <Label>Safety-Logic</Label>
              <VersionCombobox versionType="safety_logic" value={safetyLogicVersionId} onChange={setSafetyLogicVersionId} placeholder="Select or type Safety-Logic" />
            </div>
            <div className="space-y-2">
              <Label>Safety-Firmware</Label>
              <VersionCombobox versionType="safety_firmware" value={safetyFirmwareVersionId} onChange={setSafetyFirmwareVersionId} placeholder="Select or type Safety-Firmware" />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="description">Description *</Label>
              <FieldVoiceInput field="description" value={description} onChange={setDescription} />
            </div>
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
            <div className="flex items-center justify-between">
              <Label htmlFor="steps">Steps to Reproduce</Label>
              <FieldVoiceInput field="steps_to_reproduce" value={stepsToReproduce} onChange={setStepsToReproduce} />
            </div>
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
              <div className="flex items-center justify-between">
                <Label htmlFor="expected">Expected Behavior</Label>
                <FieldVoiceInput field="expected_behavior" value={expectedBehavior} onChange={setExpectedBehavior} />
              </div>
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
              <div className="flex items-center justify-between">
                <Label htmlFor="actual">Actual Behavior</Label>
                <FieldVoiceInput field="actual_behavior" value={actualBehavior} onChange={setActualBehavior} />
              </div>
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
