import React from 'react';
import Svg, { Rect, Path, G, Circle } from 'react-native-svg';

interface StatisticsIconProps {
  width?: number;
  height?: number;
  primaryColor?: string;
  secondaryColor?: string;
  accentColor?: string;
}

const StatisticsIcon: React.FC<StatisticsIconProps> = ({
  width = 64,
  height = 64,
  primaryColor = '#6200EE',
  secondaryColor = '#BB86FC',
  accentColor = '#3700B3'
}) => {
  return (
    <Svg width={width} height={height} viewBox="0 0 1024 1024" fill="none">
      <G>
        {/* Chart background */}
        <Rect x={120} y={120} width={784} height={584} rx={48} fill={secondaryColor} stroke="#322E63" strokeWidth={28} />
        
        {/* Chart bars - ascending height pattern */}
        <Rect x={200} y={480} width={100} height={160} rx={16} fill={primaryColor} stroke="#322E63" strokeWidth={18} />
        <Rect x={340} y={400} width={100} height={240} rx={16} fill={accentColor} stroke="#322E63" strokeWidth={18} />
        <Rect x={480} y={320} width={100} height={320} rx={16} fill={primaryColor} stroke="#322E63" strokeWidth={18} />
        <Rect x={620} y={280} width={100} height={360} rx={16} fill={accentColor} stroke="#322E63" strokeWidth={18} />
        <Rect x={760} y={240} width={100} height={400} rx={16} fill={primaryColor} stroke="#322E63" strokeWidth={18} />
        
        {/* Trend line/arrow indicator */}
        <Path 
          d="M180 550 L240 500 L380 420 L520 340 L660 300 L800 260" 
          stroke="#322E63" 
          strokeWidth={24} 
          strokeLinecap="round" 
          strokeLinejoin="round"
          fill="none"
        />
        
        {/* Arrow tip */}
        <Path 
          d="M780 240 L820 260 L780 280" 
          stroke="#322E63" 
          strokeWidth={24} 
          strokeLinecap="round" 
          strokeLinejoin="round"
          fill="none"
        />
        
        {/* Data points on trend line */}
        <Circle cx={240} cy={500} r={12} fill="#322E63" />
        <Circle cx={380} cy={420} r={12} fill="#322E63" />
        <Circle cx={520} cy={340} r={12} fill="#322E63" />
        <Circle cx={660} cy={300} r={12} fill="#322E63" />
        <Circle cx={800} cy={260} r={12} fill="#322E63" />
        
        {/* Base line */}
        <Path d="M140 680 L884 680" stroke="#322E63" strokeWidth={20} strokeLinecap="round" />
        
        {/* Y-axis */}
        <Path d="M160 160 L160 680" stroke="#322E63" strokeWidth={20} strokeLinecap="round" />
        
        {/* Tablet/device frame for modern look */}
        <Rect x={80} y={80} width={864} height={664} rx={68} fill="none" stroke="#322E63" strokeWidth={32} />
        
        {/* Screen reflection highlight */}
        <Path 
          d="M120 120 Q200 100 300 120 Q400 110 500 120 Q600 110 700 120 Q800 110 904 120 L904 200 Q800 180 700 200 Q600 180 500 200 Q400 180 300 200 Q200 180 120 200 Z" 
          fill="#FFFFFF" 
          opacity={0.1}
        />
        
        {/* Home indicator (modern touch) */}
        <Rect x={462} y={780} width={100} height={8} rx={4} fill="#322E63" opacity={0.3} />
      </G>
    </Svg>
  );
};

export default StatisticsIcon;
