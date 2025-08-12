import React from 'react';
import Svg, { Path, Rect, Circle, G } from 'react-native-svg';

interface SettingsIconProps {
  width?: number;
  height?: number;
  primaryColor?: string;
  secondaryColor?: string;
  accentColor?: string;
  backgroundColor?: string;
}

const SettingsIcon: React.FC<SettingsIconProps> = ({
  width = 64,
  height = 64,
  primaryColor = '#6200EE',
  secondaryColor = '#BB86FC',
  accentColor = '#3700B3',
  backgroundColor = '#FFFFFF'
}) => {
  // Rectangular-tooth gear parameters
  const center = 512;
  const teethAngles = [0,45,90,135,180,225,270,315]; // 8 teeth
  const baseRadius = 340;  // radius of circular body (up to tooth base)
  const toothOut = 140;    // outward extension past base circle (taller)
  const toothOverlap = 90; // overlap to keep joint thick after extension
  const toothWidth = 190;  // width of each tooth (wider)
  const toothHeight = toothOut + toothOverlap; // total rect height
  const toothX = center - toothWidth / 2;
  const toothY = center - baseRadius - toothOut; // top outside
  const holeRadius = 180;  // inner hole radius (reduced for thicker ring)

  return (
    <Svg width={width} height={height} viewBox="0 0 1024 1024" fill="none">
      <G>
        {teethAngles.map(a => (
          <Rect
            key={a}
            x={toothX}
            y={toothY}
            width={toothWidth}
            height={toothHeight}
            fill={primaryColor}
            stroke="#322E63"
            strokeWidth={32}
            transform={`rotate(${a} ${center} ${center})`}
          />
        ))}
        <Circle
          cx={center}
          cy={center}
          r={baseRadius}
          fill={primaryColor}
          stroke="#322E63"
          strokeWidth={40}
        />
        <Circle
          cx={center}
          cy={center}
          r={holeRadius}
          fill={backgroundColor}
          stroke="#322E63"
          strokeWidth={32}
        />
      </G>
    </Svg>
  );
};

export default SettingsIcon;
