import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Mic, Square, Loader2, Info } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { IssuePriority, IssueCategory } from '@/types/database';

interface ParsedIssueData {
  title: string;
  description: string;
  priority: IssuePriority;
  category: IssueCategory;
  steps_to_reproduce: string;
  expected_behavior: string;
  actual_behavior: string;
}

interface VoiceAssistantProps {
  onParsed: (data: ParsedIssueData) => void;
}

export const VoiceAssistant = ({ onParsed }: VoiceAssistantProps) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const recognitionRef = useRef<any>(null);
  const transcriptRef = useRef<string>('');

  const processTranscript = async (transcript: string) => {
    if (!transcript.trim()) {
      toast.warning('No speech detected. Please try again.');
      return;
    }

    setIsProcessing(true);
    toast.info('Processing your input...');

    try {
      const { data, error } = await supabase.functions.invoke('parse-issue-voice', {
        body: { transcript: transcript.trim() },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      onParsed(data);
      toast.success('Form populated from voice input!');
    } catch (error) {
      console.error('Error processing:', error);
      toast.error('Failed to process. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const startRecording = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      toast.error('Speech recognition not supported. Try Chrome or Edge.');
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    transcriptRef.current = '';
    recognitionRef.current = recognition;

    recognition.onresult = (event: any) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          transcriptRef.current += event.results[i][0].transcript + ' ';
        }
      }
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      setIsRecording(false);
      recognitionRef.current = null;
      if (event.error !== 'aborted') {
        toast.error('Speech recognition error. Please try again.');
      }
    };

    recognition.onend = () => {
      setIsRecording(false);
      recognitionRef.current = null;
      processTranscript(transcriptRef.current);
    };

    recognition.start();
    setIsRecording(true);
    toast.info('Listening... Click Stop when finished.');
  };

  const stopRecording = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
  };

  const handleClick = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Button
        type="button"
        variant={isRecording ? 'destructive' : 'secondary'}
        onClick={handleClick}
        disabled={isProcessing}
        className="gap-2"
      >
        {isProcessing ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Processing...
          </>
        ) : isRecording ? (
          <>
            <Square className="h-4 w-4" />
            Stop Recording
          </>
        ) : (
          <>
            <Mic className="h-4 w-4" />
            Voice Input
          </>
        )}
      </Button>

      <Popover>
        <PopoverTrigger asChild>
          <Button type="button" variant="ghost" size="icon">
            <Info className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80">
          <div className="space-y-3">
            <h4 className="font-semibold">Voice Input Keywords</h4>
            <p className="text-sm text-muted-foreground">
              Speak naturally about your issue. The AI will extract the relevant information. Try including:
            </p>
            <ul className="text-sm space-y-2">
              <li><strong>Title:</strong> "The issue is..." or "Problem with..."</li>
              <li><strong>Priority:</strong> "This is critical/high/medium/low priority"</li>
              <li><strong>Category:</strong> "This is a hardware/software/mechanical/electrical issue"</li>
              <li><strong>Steps:</strong> "To reproduce: first..., then..., finally..."</li>
              <li><strong>Expected:</strong> "I expected..." or "It should..."</li>
              <li><strong>Actual:</strong> "But instead..." or "What happened was..."</li>
            </ul>
            <p className="text-xs text-muted-foreground mt-2">
              Click "Stop Recording" when you're done speaking.
            </p>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
};
