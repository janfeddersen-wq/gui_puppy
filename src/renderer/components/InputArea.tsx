import { useState, useRef, useEffect, KeyboardEvent } from 'react';
import { Box, TextField, IconButton, CircularProgress } from '@mui/material';
import { Send as SendIcon, Stop as StopIcon } from '@mui/icons-material';
import { zinc } from '../theme';

interface InputAreaProps {
  onSend: (text: string) => void;
  onCancel: () => void;
  disabled: boolean;
  isProcessing: boolean;
}

export function InputArea({ onSend, onCancel, disabled, isProcessing }: InputAreaProps) {
  const [input, setInput] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!disabled && !isProcessing) {
      inputRef.current?.focus();
    }
  }, [disabled, isProcessing]);

  const handleSend = () => {
    const text = input.trim();
    if (text && !disabled && !isProcessing) {
      onSend(text);
      setInput('');
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <Box
      sx={{
        p: 2,
        backgroundColor: zinc[900],
        borderTop: `1px solid ${zinc[800]}`,
        display: 'flex',
        gap: 1.5,
        alignItems: 'flex-end',
      }}
    >
      <TextField
        inputRef={inputRef}
        fullWidth
        multiline
        maxRows={6}
        placeholder={isProcessing ? 'Processing...' : 'Enter your prompt...'}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        sx={{
          '& .MuiOutlinedInput-root': {
            backgroundColor: zinc[950],
            '& textarea': {
              color: zinc[100],
            },
          },
        }}
      />
      {isProcessing ? (
        <IconButton
          onClick={onCancel}
          sx={{
            backgroundColor: '#7f1d1d',
            color: '#fca5a5',
            '&:hover': {
              backgroundColor: '#991b1b',
            },
            width: 48,
            height: 48,
          }}
        >
          <StopIcon />
        </IconButton>
      ) : (
        <IconButton
          onClick={handleSend}
          disabled={disabled || !input.trim()}
          sx={{
            backgroundColor: zinc[100],
            color: zinc[900],
            '&:hover': {
              backgroundColor: zinc[200],
            },
            '&.Mui-disabled': {
              backgroundColor: zinc[700],
              color: zinc[500],
            },
            width: 48,
            height: 48,
          }}
        >
          <SendIcon />
        </IconButton>
      )}
    </Box>
  );
}
