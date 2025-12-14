import { useState, useRef, useEffect, KeyboardEvent, DragEvent } from 'react';
import { Box, TextField, IconButton, useTheme } from '@mui/material';
import {
  Send as SendIcon,
  Stop as StopIcon,
  Image as ImageIcon,
  Close as CloseIcon,
} from '@mui/icons-material';

interface AttachedImage {
  id: string;
  name: string;
  dataUrl: string;
  file: File;
}

interface InputAreaProps {
  onSend: (text: string, images?: AttachedImage[]) => void;
  onCancel: () => void;
  disabled: boolean;
  isProcessing: boolean;
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 11);
}

export function InputArea({ onSend, onCancel, disabled, isProcessing }: InputAreaProps) {
  const [input, setInput] = useState('');
  const [attachedImages, setAttachedImages] = useState<AttachedImage[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  useEffect(() => {
    if (!disabled && !isProcessing) {
      inputRef.current?.focus();
    }
  }, [disabled, isProcessing]);

  const processFiles = (files: FileList | File[]) => {
    const imageFiles = Array.from(files).filter((file) =>
      file.type.startsWith('image/')
    );

    imageFiles.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        setAttachedImages((prev) => [
          ...prev,
          {
            id: generateId(),
            name: file.name,
            dataUrl,
            file,
          },
        ]);
      };
      reader.readAsDataURL(file);
    });
  };

  const handleDragEnter = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget === e.target) {
      setIsDragging(false);
    }
  };

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files);
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    const imageItems = Array.from(items).filter(
      (item) => item.type.startsWith('image/')
    );

    if (imageItems.length > 0) {
      e.preventDefault();
      const files = imageItems
        .map((item) => item.getAsFile())
        .filter((f): f is File => f !== null);
      processFiles(files);
    }
  };

  const handleFileSelect = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(e.target.files);
      e.target.value = '';
    }
  };

  const removeImage = (id: string) => {
    setAttachedImages((prev) => prev.filter((img) => img.id !== id));
  };

  const handleSend = () => {
    const text = input.trim();
    if ((text || attachedImages.length > 0) && !disabled && !isProcessing) {
      onSend(text, attachedImages.length > 0 ? attachedImages : undefined);
      setInput('');
      setAttachedImages([]);
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
        backgroundColor: theme.palette.background.paper,
        borderTop: `1px solid ${theme.palette.divider}`,
      }}
    >
      {/* Attached images preview */}
      {attachedImages.length > 0 && (
        <Box
          sx={{
            px: 2,
            pt: 1.5,
            display: 'flex',
            flexWrap: 'wrap',
            gap: 1,
          }}
        >
          {attachedImages.map((img) => (
            <Box
              key={img.id}
              sx={{
                position: 'relative',
                width: 80,
                height: 80,
                borderRadius: 1,
                overflow: 'hidden',
                border: `1px solid ${theme.palette.divider}`,
              }}
            >
              <img
                src={img.dataUrl}
                alt={img.name}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                }}
              />
              <IconButton
                size="small"
                onClick={() => removeImage(img.id)}
                sx={{
                  position: 'absolute',
                  top: 2,
                  right: 2,
                  backgroundColor: 'rgba(0,0,0,0.6)',
                  color: 'white',
                  padding: 0.25,
                  '&:hover': {
                    backgroundColor: 'rgba(0,0,0,0.8)',
                  },
                }}
              >
                <CloseIcon sx={{ fontSize: 14 }} />
              </IconButton>
            </Box>
          ))}
        </Box>
      )}

      {/* Input area */}
      <Box
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        sx={{
          p: 2,
          display: 'flex',
          gap: 1.5,
          alignItems: 'flex-end',
          position: 'relative',
          ...(isDragging && {
            '&::after': {
              content: '"Drop images here"',
              position: 'absolute',
              inset: 8,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: isDark ? 'rgba(59, 130, 246, 0.2)' : 'rgba(59, 130, 246, 0.1)',
              border: `2px dashed ${theme.palette.primary.main}`,
              borderRadius: 2,
              color: theme.palette.primary.main,
              fontWeight: 500,
              fontSize: '0.9rem',
              zIndex: 10,
            },
          }),
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleFileChange}
          style={{ display: 'none' }}
        />

        <IconButton
          onClick={handleFileSelect}
          disabled={disabled}
          sx={{
            color: theme.palette.text.secondary,
            '&:hover': {
              color: theme.palette.text.primary,
              backgroundColor: theme.palette.action.hover,
            },
          }}
        >
          <ImageIcon />
        </IconButton>

        <TextField
          inputRef={inputRef}
          fullWidth
          multiline
          maxRows={6}
          placeholder={isProcessing ? 'Processing...' : 'Enter your prompt... (drop images here)'}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          disabled={disabled}
          sx={{
            '& .MuiOutlinedInput-root': {
              backgroundColor: theme.palette.background.default,
              '& textarea': {
                color: theme.palette.text.primary,
              },
            },
          }}
        />

        {isProcessing ? (
          <IconButton
            onClick={onCancel}
            sx={{
              backgroundColor: isDark ? '#7f1d1d' : '#fef2f2',
              color: isDark ? '#fca5a5' : '#dc2626',
              '&:hover': {
                backgroundColor: isDark ? '#991b1b' : '#fee2e2',
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
            disabled={disabled || (!input.trim() && attachedImages.length === 0)}
            sx={{
              backgroundColor: theme.palette.primary.main,
              color: theme.palette.primary.contrastText,
              '&:hover': {
                backgroundColor: theme.palette.primary.dark,
              },
              '&.Mui-disabled': {
                backgroundColor: theme.palette.action.disabledBackground,
                color: theme.palette.action.disabled,
              },
              width: 48,
              height: 48,
            }}
          >
            <SendIcon />
          </IconButton>
        )}
      </Box>
    </Box>
  );
}
