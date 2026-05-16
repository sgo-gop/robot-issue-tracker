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
  
  const [emailPrefix, setEmailPrefix] = useState('');
  const [robotType, setRobotType] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const EMAIL_DOMAIN = '@neura-robotics.com';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedPrefix = emailPrefix.trim().toLowerCase().replace(/@.*$/, '');
    if (!trimmedPrefix) {
      toast({ title: 'Please enter your email', variant: 'destructive' });
      return;
    }

    if (!/^[a-z0-9._-]+$/.test(trimmedPrefix)) {
      toast({ title: 'Invalid email format', description: 'Use letters, numbers, dots, hyphens or underscores only.', variant: 'destructive' });
      return;
    }

    const fullEmail = `${trimmedPrefix}${EMAIL_DOMAIN}`;

    if (fullEmail.length > 100) {
      toast({ title: 'Email must be less than 100 characters', variant: 'destructive' });
      return;
    }

    if (!robotType) {
      toast({ title: 'Please select your robot type', variant: 'destructive' });
      return;
    }

    setIsSubmitting(true);

    setSession(fullEmail, robotType);
    toast({ title: `Welcome, ${fullEmail}!` });
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
          <CardDescription>Enter your email and select your robot type to begin</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Your Email</Label>
              <div className="flex items-stretch rounded-md border border-input bg-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 focus-within:ring-offset-background overflow-hidden">
                <Input
                  id="email"
                  placeholder="firstname.lastname"
                  value={emailPrefix}
                  onChange={(e) => setEmailPrefix(e.target.value)}
                  maxLength={80}
                  required
                  autoFocus
                  className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0 rounded-none"
                />
                <span className="flex items-center px-3 text-sm text-muted-foreground bg-muted border-l border-input whitespace-nowrap">
                  {EMAIL_DOMAIN}
                </span>
              </div>
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
