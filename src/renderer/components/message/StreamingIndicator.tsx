import { Box, useTheme } from '@mui/material';
import { keyframes } from '@mui/system';

const pulse = keyframes`
  0%, 80%, 100% {
    transform: scale(0.6);
    opacity: 0.4;
  }
  40% {
    transform: scale(1);
    opacity: 1;
  }
`;

const wave = keyframes`
  0%, 60%, 100% {
    transform: translateY(0);
  }
  30% {
    transform: translateY(-4px);
  }
`;

interface StreamingIndicatorProps {
  variant?: 'dots' | 'wave' | 'pulse';
  color?: string;
  size?: 'small' | 'medium';
}

export function StreamingIndicator({
  variant = 'wave',
  color,
  size = 'medium',
}: StreamingIndicatorProps) {
  const theme = useTheme();
  const dotColor = color || theme.palette.primary.main;
  const dotSize = size === 'small' ? 4 : 6;
  const gap = size === 'small' ? 0.4 : 0.5;

  if (variant === 'pulse') {
    return <PulseIndicator dotColor={dotColor} dotSize={dotSize} gap={gap} />;
  }

  if (variant === 'wave') {
    return <WaveIndicator dotColor={dotColor} dotSize={dotSize} gap={gap} />;
  }

  return <DotsIndicator dotColor={dotColor} dotSize={dotSize} gap={gap} />;
}

interface IndicatorProps {
  dotColor: string;
  dotSize: number;
  gap: number;
}

function WaveIndicator({ dotColor, dotSize, gap }: IndicatorProps) {
  return (
    <Box
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: gap,
        ml: 0.5,
        height: dotSize * 2,
      }}
    >
      {[0, 1, 2].map((i) => (
        <Box
          key={i}
          sx={{
            width: dotSize,
            height: dotSize,
            borderRadius: '50%',
            backgroundColor: dotColor,
            animation: `${wave} 1.2s ease-in-out infinite`,
            animationDelay: `${i * 0.15}s`,
          }}
        />
      ))}
    </Box>
  );
}

function PulseIndicator({ dotColor, dotSize, gap }: IndicatorProps) {
  return (
    <Box
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: gap,
        ml: 0.5,
      }}
    >
      {[0, 1, 2].map((i) => (
        <Box
          key={i}
          sx={{
            width: dotSize,
            height: dotSize,
            borderRadius: '50%',
            backgroundColor: dotColor,
            animation: `${pulse} 1.4s ease-in-out infinite`,
            animationDelay: `${i * 0.16}s`,
          }}
        />
      ))}
    </Box>
  );
}

function DotsIndicator({ dotColor, dotSize, gap }: IndicatorProps) {
  const fadeIn = keyframes`
    0%, 100% { opacity: 0.3; }
    50% { opacity: 1; }
  `;

  return (
    <Box
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: gap,
        ml: 0.5,
      }}
    >
      {[0, 1, 2].map((i) => (
        <Box
          key={i}
          sx={{
            width: dotSize,
            height: dotSize,
            borderRadius: '50%',
            backgroundColor: dotColor,
            animation: `${fadeIn} 1.5s ease-in-out infinite`,
            animationDelay: `${i * 0.2}s`,
          }}
        />
      ))}
    </Box>
  );
}
