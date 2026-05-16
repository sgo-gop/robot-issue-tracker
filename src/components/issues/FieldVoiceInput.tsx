import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Mic, Square } from 'lucide-react';
import { toast } from 'sonner';

interface FieldVoiceInputProps {
  value: string;
  onChange: (v: string) => void;
  append?: boolean;
}

export const FieldVoiceInput = ({ value, onChange, append = true }: FieldVoiceInputProps) => {
  const [isRecording, setIsRecording] = useState(false);
  const recognitionRef = useRef<any>(null);
  const baseRef = useRef<string>('');

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
    let finalText = '';

    recognition.onresult = (event: any) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) finalText += t + ' ';
        else interim += t;
      }
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
      className="h-7 gap-1 px-2 text-xs"
    >
      {isRecording ? <Square className="h-3 w-3" /> : <Mic className="h-3 w-3" />}
      {isRecording ? 'Stop' : 'Voice'}
    </Button>
  );
};