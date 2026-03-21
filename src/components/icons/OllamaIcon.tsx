import React from 'react';
import ollamaLogo from './ollama.png';

/**
 * Ollama llama mascot icon — uses the official Ollama logo image.
 * Compatible with Lucide icon API (size, className, etc.)
 */
const OllamaIcon = React.forwardRef<
  HTMLImageElement,
  { size?: number | string; className?: string; strokeWidth?: number; [k: string]: any }
>(({ size = 24, className, strokeWidth: _sw, ...rest }, ref) => (
  <img
    ref={ref}
    src={ollamaLogo}
    alt="Ollama"
    width={size}
    height={size}
    className={className}
    style={{ objectFit: 'contain' }}
    {...rest}
  />
));

OllamaIcon.displayName = 'OllamaIcon';

export default OllamaIcon;
