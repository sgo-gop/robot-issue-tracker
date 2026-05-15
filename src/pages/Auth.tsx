import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSession } from '@/hooks/useSession';
import { ROBOT_TYPES } from '@/types/database';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Bot, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const Auth = () => {
  const navigate = useNavigate();
  const { setSession } = useSession();
  const { toast } = useToast();
  
  const [name, setName] = useState('');
  const [robotType, setRobotType] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const trimmedName = name.trim();
    if (!trimmedName) {
      toast({ title: 'Please enter your name', variant: 'destructive' });
      return;
    }
    
    if (trimmedName.length > 100) {
      toast({ title: 'Name must be less than 100 characters', variant: 'destructive' });
      return;
    }
    
    if (!robotType) {
      toast({ title: 'Please select your robot type', variant: 'destructive' });
      return;
    }

    setIsSubmitting(true);

    setSession(trimmedName, robotType);
    toast({ title: `Welcome, ${trimmedName}!` });
    navigate('/');

    setIsSubmitting(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md animate-fade-in">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Bot className="h-8 w-8" />
          </div>
          <CardTitle className="text-2xl">Robot Testing Tracker</CardTitle>
          <CardDescription>Enter your name and select your robot type to begin</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Your Name</Label>
              <Input
                id="name"
                placeholder="Enter your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={100}
                required
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="robot-type">Robot Type</Label>
              <Select value={robotType} onValueChange={setRobotType} required>
                <SelectTrigger id="robot-type">
                  <SelectValue placeholder="Select your robot type" />
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

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Start Session
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;
