import React from 'react';
import Svg, { Rect, Path, G } from 'react-native-svg';

interface Props {
  width?: number;
  height?: number;
  primaryColor?: string;
  secondaryColor?: string;
  accentColor?: string;
}

// StackedBooksIcon: outlined multi-book motif styled to match BookIcon's heavier outline aesthetic.
const StackedBooksIcon: React.FC<Props> = ({
  width = 64,
  height = 64,
  primaryColor = '#6200EE',
  secondaryColor = '#BB86FC',
  accentColor = '#3700B3'
}) => {
  // Use a larger viewBox for smoother outline scaling (same proportion logic as BookIcon)
  return (
    <Svg width={width} height={height} viewBox="0 0 1024 1024" fill="none">
      <G>
        {/* Rear book */}
        <Rect x={170} y={180} width={360} height={620} rx={38} fill={secondaryColor} stroke="#322E63" strokeWidth={28} />
        {/* Middle book (slightly higher) */}
        <Rect x={310} y={140} width={360} height={640} rx={38} fill={primaryColor} stroke="#322E63" strokeWidth={28} />
        {/* Front narrow book */}
        <Rect x={560} y={200} width={240} height={560} rx={32} fill={accentColor} stroke="#322E63" strokeWidth={28} />

       

        {/* Subtle base shadow line to ground the stack */}
        <Path d="M150 818c0 28 22 50 50 50h600" stroke="#322E63" strokeOpacity={0.2} strokeWidth={32} strokeLinecap="round" />
      </G>
    </Svg>
  );
};

export default StackedBooksIcon;
