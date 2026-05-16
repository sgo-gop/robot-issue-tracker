import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Mic, Square, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

type FieldKind = 'description' | 'steps_to_reproduce' | 'expected_behavior' | 'actual_behavior';

interface FieldVoiceInputProps {
  value: string;
  onChange: (v: string) => void;
  field: FieldKind;
  append?: boolean;
}

export const FieldVoiceInput = ({ value, onChange, field, append = true }: FieldVoiceInputProps) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isRefining, setIsRefining] = useState(false);
  const recognitionRef = useRef<any>(null);
  const baseRef = useRef<string>('');
  const transcriptRef = useRef<string>('');

  const refine = async (rawTranscript: string, existing: string) => {
    if (!rawTranscript.trim()) return;
    setIsRefining(true);
    try {
      const { data, error } = await supabase.functions.invoke('refine-field-voice', {
        body: { transcript: rawTranscript, field, existing },
      });
      if (error) throw error;
      if (data?.text) onChange(data.text);
    } catch (e) {
      console.error('refine error', e);
      toast.error('Could not refine voice input — kept raw transcript.');
    } finally {
      setIsRefining(false);
    }
  };

  const start = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      toast.error('Speech recognition not supported. Try Chrome or Edge.');
      return;
    }
    const recognition = new SR();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    baseRef.current = append && value ? value.trimEnd() + ' ' : '';
    transcriptRef.current = '';
    let finalText = '';

    recognition.onresult = (event: any) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) finalText += t + ' ';
        else interim += t;
      }
      transcriptRef.current = finalText;
      onChange(baseRef.current + finalText + interim);
    };
    recognition.onerror = (e: any) => {
      setIsRecording(false);
      recognitionRef.current = null;
      if (e.error !== 'aborted') toast.error('Speech recognition error.');
    };
    recognition.onend = () => {
      setIsRecording(false);
      recognitionRef.current = null;
      const raw = transcriptRef.current.trim();
      if (raw) {
        const existing = append ? (value ? value.trimEnd() : '') : '';
        refine(raw, existing);
      }
    };
    recognition.start();
    recognitionRef.current = recognition;
    setIsRecording(true);
  };

  const stop = () => recognitionRef.current?.stop();

  return (
    <Button
      type="button"
      size="sm"
      variant={isRecording ? 'destructive' : 'outline'}
      onClick={isRecording ? stop : start}
      disabled={isRefining}
      className="h-7 gap-1 px-2 text-xs"
    >
      {isRefining ? <Loader2 className="h-3 w-3 animate-spin" /> : isRecording ? <Square className="h-3 w-3" /> : <Mic className="h-3 w-3" />}
      {isRefining ? 'Refining' : isRecording ? 'Stop' : 'Voice'}
    </Button>
  );
};