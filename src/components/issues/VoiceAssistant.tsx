import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Mic, MicOff, Loader2, Info } from 'lucide-react';
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
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(track => track.stop());
        await processAudio();
      };

      mediaRecorder.start();
      setIsRecording(true);
      toast.info('Recording started. Speak your issue description...');
    } catch (error) {
      console.error('Error accessing microphone:', error);
      toast.error('Could not access microphone. Please check permissions.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const processAudio = async () => {
    setIsProcessing(true);
    try {
      const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
      
      // Use Web Speech API for transcription
      const transcript = await transcribeWithWebSpeech();
      
      if (!transcript) {
        toast.error('Could not transcribe audio. Please try again.');
        return;
      }

      toast.info('Processing your input...');
      
      // Send to AI for parsing
      const { data, error } = await supabase.functions.invoke('parse-issue-voice', {
        body: { transcript },
      });

      if (error) {
        throw error;
      }

      if (data.error) {
        throw new Error(data.error);
      }

      onParsed(data);
      toast.success('Form fields populated from your voice input!');
    } catch (error) {
      console.error('Error processing audio:', error);
      toast.error('Failed to process voice input. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const transcribeWithWebSpeech = (): Promise<string | null> => {
    return new Promise((resolve) => {
      if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
        toast.error('Speech recognition not supported in this browser.');
        resolve(null);
        return;
      }

      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      let fullTranscript = '';
      let timeoutId: NodeJS.Timeout;

      recognition.onresult = (event: any) => {
        for (let i = event.resultIndex; i < event.results.length; i++) {
          if (event.results[i].isFinal) {
            fullTranscript += event.results[i][0].transcript + ' ';
          }
        }
        // Reset timeout on new results
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
          recognition.stop();
        }, 2000); // Stop after 2 seconds of silence
      };

      recognition.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        clearTimeout(timeoutId);
        resolve(null);
      };

      recognition.onend = () => {
        clearTimeout(timeoutId);
        resolve(fullTranscript.trim() || null);
      };

      recognition.start();

      // Auto-stop after 60 seconds max
      timeoutId = setTimeout(() => {
        recognition.stop();
      }, 60000);
    });
  };

  const handleClick = () => {
    if (isRecording) {
      stopRecording();
    } else {
      // Start speech recognition directly
      startSpeechRecognition();
    }
  };

  const startSpeechRecognition = async () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      toast.error('Speech recognition not supported. Try Chrome or Edge.');
      return;
    }

    setIsRecording(true);
    toast.info('Listening... Speak your issue description.');

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    let fullTranscript = '';
    let silenceTimeout: NodeJS.Timeout;

    const resetSilenceTimeout = () => {
      clearTimeout(silenceTimeout);
      silenceTimeout = setTimeout(() => {
        recognition.stop();
      }, 3000); // Stop after 3 seconds of silence
    };

    recognition.onstart = () => {
      resetSilenceTimeout();
    };

    recognition.onresult = (event: any) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          fullTranscript += event.results[i][0].transcript + ' ';
        }
      }
      resetSilenceTimeout();
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      clearTimeout(silenceTimeout);
      setIsRecording(false);
      if (event.error !== 'aborted') {
        toast.error('Speech recognition error. Please try again.');
      }
    };

    recognition.onend = async () => {
      clearTimeout(silenceTimeout);
      setIsRecording(false);

      if (fullTranscript.trim()) {
        setIsProcessing(true);
        toast.info('Processing your input...');

        try {
          const { data, error } = await supabase.functions.invoke('parse-issue-voice', {
            body: { transcript: fullTranscript.trim() },
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
      } else {
        toast.warning('No speech detected. Please try again.');
      }
    };

    recognition.start();

    // Store reference to stop manually
    mediaRecorderRef.current = { stop: () => recognition.stop() } as any;
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
            <MicOff className="h-4 w-4" />
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
              Recording stops automatically after 3 seconds of silence.
            </p>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
};
