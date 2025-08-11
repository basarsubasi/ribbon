import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, ScrollView, Dimensions } from 'react-native';
import {
  Text,
  Surface,
  Menu,
  Button,
  ActivityIndicator,
  Chip,
  Divider,
  Card
} from 'react-native-paper';
import { BarChart } from 'react-native-chart-kit';
import { useTheme } from '../context/ThemeContext';
import { useTranslation } from 'react-i18next';
import { scale, verticalScale, moderateScale } from 'react-native-size-matters';
import { useSQLiteContext } from 'expo-sqlite';
import { useFocusEffect } from '@react-navigation/native';
import StatisticsIcon from '../components/StatisticsIcon';

const { width: screenWidth } = Dimensions.get('window');

interface ChartData {
  name: string;
  value: number;
}

interface ChartOption {
  key: string;
  label: string;
  type: 'general' | 'specific' | 'detailed';
  query: string;
  column: string;
  detailQuery?: string;
  detailColumn?: string;
}

interface TimeframeOption {
  key: string;
  label: string;
  filter: string;
}

const Stats = () => {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const db = useSQLiteContext();
  
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [loading, setLoading] = useState(true);
  const [chartMenuVisible, setChartMenuVisible] = useState(false);
  const [timeframeMenuVisible, setTimeframeMenuVisible] = useState(false);
  const [itemMenuVisible, setItemMenuVisible] = useState(false);
  const [availableItems, setAvailableItems] = useState<{name: string, id: string}[]>([]);
  const [selectedItem, setSelectedItem] = useState<{name: string, id: string} | null>(null);

  const chartOptions: ChartOption[] = [
    { key: 'authors-header', label: 'Authors', type: 'general', query: '', column: '' },
    { key: 'authors', label: 'All Authors', type: 'specific', 
      query: `SELECT a.name, COALESCE(SUM(pl.total_page_read), 0) as pages_read
               FROM authors a 
               LEFT JOIN book_authors ba ON a.author_id = ba.author_id
               LEFT JOIN books b ON ba.book_id = b.book_id
               LEFT JOIN page_logs pl ON b.book_id = pl.book_id
               WHERE 1=1`, 
      column: 'a.name' },
    { key: 'specific-author', label: 'Select Author', type: 'detailed',
      query: `SELECT a.name, a.author_id as id FROM authors a 
               JOIN book_authors ba ON a.author_id = ba.author_id
               JOIN books b ON ba.book_id = b.book_id
               JOIN page_logs pl ON b.book_id = pl.book_id
               WHERE 1=1`,
      column: 'a.name',
      detailQuery: `SELECT b.title as name, COALESCE(SUM(pl.total_page_read), 0) as pages_read
                    FROM books b
                    JOIN book_authors ba ON b.book_id = ba.book_id
                    LEFT JOIN page_logs pl ON b.book_id = pl.book_id
                    WHERE ba.author_id = ?`,
      detailColumn: 'b.title' },
    
    { key: 'categories-header', label: 'Categories', type: 'general', query: '', column: '' },
    { key: 'categories', label: 'All Categories', type: 'specific',
      query: `SELECT c.name, COALESCE(SUM(pl.total_page_read), 0) as pages_read
               FROM categories c 
               LEFT JOIN book_categories bc ON c.category_id = bc.category_id
               LEFT JOIN books b ON bc.book_id = b.book_id
               LEFT JOIN page_logs pl ON b.book_id = pl.book_id
               WHERE 1=1`, 
      column: 'c.name' },
    { key: 'specific-category', label: 'Select Category', type: 'detailed',
      query: `SELECT c.name, c.category_id as id FROM categories c 
               JOIN book_categories bc ON c.category_id = bc.category_id
               JOIN books b ON bc.book_id = b.book_id
               JOIN page_logs pl ON b.book_id = pl.book_id
               WHERE 1=1`,
      column: 'c.name',
      detailQuery: `SELECT b.title as name, COALESCE(SUM(pl.total_page_read), 0) as pages_read
                    FROM books b
                    JOIN book_categories bc ON b.book_id = bc.book_id
                    LEFT JOIN page_logs pl ON b.book_id = pl.book_id
                    WHERE bc.category_id = ?`,
      detailColumn: 'b.title' },

    { key: 'publishers-header', label: 'Publishers', type: 'general', query: '', column: '' },
    { key: 'publishers', label: 'All Publishers', type: 'specific',
      query: `SELECT COALESCE(p.name, 'Unknown') as name, COALESCE(SUM(pl.total_page_read), 0) as pages_read
               FROM publishers p 
               LEFT JOIN book_publishers bp ON p.publisher_id = bp.publisher_id
               LEFT JOIN books b ON bp.book_id = b.book_id
               LEFT JOIN page_logs pl ON b.book_id = pl.book_id
               WHERE 1=1`, 
      column: 'p.name' },
    { key: 'specific-publisher', label: 'Select Publisher', type: 'detailed',
      query: `SELECT p.name, p.publisher_id as id
               FROM publishers p 
               JOIN book_publishers bp ON p.publisher_id = bp.publisher_id
               JOIN books b ON bp.book_id = b.book_id
               JOIN page_logs pl ON b.book_id = pl.book_id
               WHERE 1=1`,
      column: 'p.name',
      detailQuery: `SELECT b.title as name, COALESCE(SUM(pl.total_page_read), 0) as pages_read
                    FROM books b
                    JOIN book_publishers bp ON b.book_id = bp.book_id
                    LEFT JOIN page_logs pl ON b.book_id = pl.book_id
                    WHERE bp.publisher_id = ?`,
      detailColumn: 'b.title' }
  ];

  const timeframeOptions: TimeframeOption[] = [
    { key: 'today', label: 'Today', filter: `AND pl.read_date = '${new Date().toISOString().split('T')[0]}'` },
    { key: 'week', label: 'This Week', filter: `AND pl.read_date >= '${new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}'` },
    { key: 'month', label: 'This Month', filter: `AND pl.read_date >= '${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-01'` },
    { key: 'year', label: 'This Year', filter: `AND pl.read_date >= '${new Date().getFullYear()}-01-01'` },
    { key: 'all', label: 'All Time', filter: '' }
  ];

  // Function to get shorter button labels for timeframes
  const getTimeframeButtonLabel = (label: string): string => {
    const shortLabels: { [key: string]: string } = {
      'Today': 'Today',
      'This Week': 'This Week',
      'This Month': 'This Month',
      'This Year': 'This Year',
      'All Time': 'All Time'
    };
    return shortLabels[label] || label;
  };

  const [selectedChart, setSelectedChart] = useState<ChartOption>(chartOptions[1]);
  const [selectedTimeframe, setSelectedTimeframe] = useState<TimeframeOption>(timeframeOptions[2]);

  const loadAvailableItems = useCallback(async () => {
    if (selectedChart.type !== 'detailed') {
      setAvailableItems([]);
      setSelectedItem(null);
      return;
    }

    try {
      const query = selectedChart.query + ' ' + selectedTimeframe.filter + ` GROUP BY ${selectedChart.column} HAVING COUNT(*) > 0 ORDER BY ${selectedChart.column}`;
      const result = await db.getAllAsync<{ name: string; id: string }>(query);
      setAvailableItems(result);
      if (result.length > 0 && !selectedItem) {
        setSelectedItem(result[0]);
      }
    } catch (error) {
      console.error('Error loading available items:', error);
      setAvailableItems([]);
    }
  }, [selectedChart, selectedTimeframe, db, selectedItem]);

  const loadData = useCallback(async () => {
    if (selectedChart.type === 'general') return;

    setLoading(true);
    try {
      let query = '';
      let result: any[] = [];

      if (selectedChart.type === 'specific') {
        query = selectedChart.query + ' ' + selectedTimeframe.filter + ` GROUP BY ${selectedChart.column} HAVING pages_read > 0 ORDER BY pages_read DESC LIMIT 10`;
        result = await db.getAllAsync<{ name: string; pages_read: number }>(query);
      } else if (selectedChart.type === 'detailed' && selectedChart.detailQuery && selectedItem) {
        query = selectedChart.detailQuery + ' ' + selectedTimeframe.filter + ` GROUP BY ${selectedChart.detailColumn} HAVING pages_read > 0 ORDER BY pages_read DESC LIMIT 10`;
        result = await db.getAllAsync<{ name: string; pages_read: number }>(query, [selectedItem.id]);
      }
      
      const data: ChartData[] = result.map(row => ({
        name: row.name || 'Unknown',
        value: row.pages_read || 0
      }));

      setChartData(data);
    } catch (error) {
      console.error('Error loading chart data:', error);
      setChartData([]);
    }
    setLoading(false);
  }, [selectedChart, selectedTimeframe, selectedItem, db]);

  useFocusEffect(
    useCallback(() => {
      loadAvailableItems();
      loadData();
    }, [loadAvailableItems, loadData])
  );

  const wrapText = (text: string, maxLength: number = 10): string[] => {
    if (text.length <= maxLength) return [text];
    
    const words = text.split(' ').filter(word => word.length > 0); // Remove empty strings
    const lines: string[] = [];
    let currentLine = '';
    
    for (const word of words) {
      const proposedLine = currentLine ? `${currentLine} ${word}` : word;
      
      if (proposedLine.length <= maxLength) {
        currentLine = proposedLine;
      } else {
        if (currentLine) {
          lines.push(currentLine);
          currentLine = word.length <= maxLength ? word : word.substring(0, maxLength);
        } else {
          // Single word is too long, break it at maxLength
          lines.push(word.substring(0, maxLength));
          currentLine = word.length > maxLength ? word.substring(maxLength) : '';
        }
      }
    }
    
    if (currentLine) {
      lines.push(currentLine);
    }
    
    return lines.slice(0, 3); // Max 3 lines for better readability
  };

  const wrapButtonText = (text: string, maxLength: number = 12): string => {
    if (text.length <= maxLength) return text;
    
    const words = text.split(' ').filter(word => word.length > 0);
    if (words.length <= 1) {
      // Single word - truncate intelligently
      return text.length > maxLength ? text.substring(0, maxLength - 3) + '...' : text;
    }
    
    const lines: string[] = [];
    let currentLine = '';
    
    for (const word of words) {
      const proposedLine = currentLine ? `${currentLine} ${word}` : word;
      
      if (proposedLine.length <= maxLength) {
        currentLine = proposedLine;
      } else {
        if (currentLine) {
          lines.push(currentLine);
          currentLine = word.length <= maxLength ? word : word.substring(0, maxLength - 3) + '...';
        } else {
          // Single word is too long, break it
          lines.push(word.substring(0, maxLength - 3) + '...');
          currentLine = '';
        }
      }
    }
    
    if (currentLine) {
      lines.push(currentLine);
    }
    
    // For buttons, prefer single line with ellipsis over multi-line
    if (lines.length > 1 && lines.join('\n').length > maxLength * 1.5) {
      const fullText = lines.join(' ');
      return fullText.length > maxLength ? fullText.substring(0, maxLength - 3) + '...' : fullText;
    }
    
    return lines.slice(0, 2).join('\n'); // Max 2 lines for buttons
  };

  const renderChart = () => {
    if (loading) {
      return (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={[styles.loadingText, { color: theme.colors.onSurface }]}>Loading...</Text>
        </View>
      );
    }

    if (chartData.length === 0) {
      return (
        <View style={styles.centered}>
          <Text style={[styles.emptyText, { color: theme.colors.onSurfaceVariant }]}>
            No data available
          </Text>
        </View>
      );
    }

    const chartConfig = {
      backgroundGradientFrom: theme.colors.surface,
      backgroundGradientTo: theme.colors.surface,
      color: (opacity = 1) => theme.colors.onSurface,
      strokeWidth: 2,
      barPercentage: 0.6,
      useShadowColorFromDataset: false,
      decimalPlaces: 0,

      fillShadowGradientFrom: theme.colors.primary,
      fillShadowGradientTo: theme.colors.primary,
      fillShadowGradientFromOpacity: 1,
      fillShadowGradientToOpacity: 1,
    };

    const data = {
      labels: chartData.map(item => {
        // Smart truncation that preserves meaningful words and spaces
        if (item.name.length <= 14) {
          return item.name;
        }
        
        const words = item.name.split(' ').filter(word => word.length > 0);
        if (words.length === 1) {
          // Single long word - truncate but keep it readable
          return words[0].length > 12 ? words[0].substring(0, 12) + '...' : words[0];
        }
        
        // Multiple words - try to fit meaningful parts
        let result = '';
        let totalLength = 0;
        
        for (let i = 0; i < words.length; i++) {
          const word = words[i];
          const nextLength = totalLength + (result ? 1 : 0) + word.length; // +1 for space
          
          if (nextLength <= 14) {
            result += (result ? ' ' : '') + word;
            totalLength = nextLength;
          } else {
            // If we can't fit the whole word, try to fit part of it
            if (result === '' && word.length > 14) {
              result = word.substring(0, 11) + '...';
            } else if (result !== '') {
              result += '...';
            }
            break;
          }
        }
        
        return result || item.name.substring(0, 11) + '...';
      }),
      datasets: [{
        data: chartData.map(item => item.value),
      }]
    };

    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chartScrollView}>
        <BarChart
          data={data}
          width={Math.max(screenWidth - scale(60), chartData.length * scale(90))}
          height={verticalScale(320)}
          chartConfig={chartConfig}
          style={styles.chart}
          yAxisLabel=""
          yAxisSuffix=""
          fromZero={false}
          showValuesOnTopOfBars
        />
      </ScrollView>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView>
        {/* Header - Matching Home Style Exactly */}
        <Surface style={[styles.header, { backgroundColor: theme.colors.surface }]} elevation={1}>
          <View style={styles.headerContent}>
            <View style={styles.logoContainer}>
              <StatisticsIcon 
                width={scale(40)} 
                height={scale(40)} 
                primaryColor={theme.colors.primary}
                secondaryColor={theme.colors.primaryContainer}
                accentColor={theme.colors.primary}
              />
              <Text variant="headlineLarge" style={[styles.appName, { color: theme.colors.primary }]}>
                statistics
              </Text>
            </View>
            <Text variant="bodyLarge" style={[styles.tagline, { color: theme.colors.onSurface }]}>
              {t('stats.subtitle')}
            </Text>
          </View>
        </Surface>

        {/* Chart Section with Green Background Card */}
        <View style={styles.section}>
          {/* Green Background Card */}
          <Card style={[styles.backgroundCard, { backgroundColor: theme.colors.primary }]} elevation={2}>
            <Card.Content style={styles.backgroundCardContent}>
              {/* White Chart Card */}
              <Card style={[styles.chartCard, { backgroundColor: theme.colors.surface }]} elevation={4}>
                <Card.Content>
                  {/* Informational Chips */}
                  {!loading && chartData.length > 0 && (
                    <View style={styles.chipsContainer}>
                      <Chip 
                        mode="outlined" 
                        style={[styles.infoChip, { borderColor: 'transparent', backgroundColor: theme.colors.primary }]}
                        textStyle={{ color: theme.colors.surface, fontSize: scale(11) }}
                      >
                        {selectedChart.type === 'detailed' && selectedItem ? 
                          `${selectedChart.key.includes('author') ? selectedItem.name : 
                             selectedChart.key.includes('category') ? selectedItem.name : selectedItem.name}` :
                          selectedChart.label
                        }
                      </Chip>
                      <Chip 
                        mode="outlined" 
                        style={[styles.infoChip, { backgroundColor: theme.colors.secondaryContainer, borderColor: 'transparent' }]}
                        textStyle={{ color: theme.colors.surface, fontSize: scale(11) }}
                      >
                        {selectedTimeframe.label}
                      </Chip>
                    </View>
                  )}
                  
                  <View style={styles.chartContainer}>
                    {renderChart()}
                  </View>
                  
                  {/* Summary */}
                  {!loading && chartData.length > 0 && (
                    <View style={styles.summaryContainer}>
                      <Divider style={[styles.divider, { backgroundColor: theme.colors.outline }]} />
                      <View style={styles.summaryGrid}>
                        <View style={styles.summaryItem}>
                          <Text variant="titleMedium" style={[styles.summaryValue, { color: theme.colors.primary }]}>
                            {chartData.length}
                          </Text>
                          <Text variant="bodySmall" style={[styles.summaryLabel, { color: theme.colors.onSurfaceVariant }]}>
                            Items
                          </Text>
                        </View>
                        <View style={styles.summaryItem}>
                          <Text variant="titleMedium" style={[styles.summaryValue, { color: theme.colors.primary }]}>
                            {chartData.reduce((sum, item) => sum + item.value, 0).toLocaleString()}
                          </Text>
                          <Text variant="bodySmall" style={[styles.summaryLabel, { color: theme.colors.onSurfaceVariant }]}>
                            Total Pages
                          </Text>
                        </View>
                        <View style={styles.summaryItem}>
                          <Text variant="titleMedium" style={[styles.summaryValue, { color: theme.colors.primary }]}>
                            {chartData.length > 0 ? Math.round(chartData.reduce((sum, item) => sum + item.value, 0) / chartData.length).toLocaleString() : '0'}
                          </Text>
                          <Text variant="bodySmall" style={[styles.summaryLabel, { color: theme.colors.onSurfaceVariant }]}>
                            Average
                          </Text>
                        </View>
                      </View>
                    </View>
                  )}
                </Card.Content>
              </Card>
            </Card.Content>
          </Card>
        </View>

        {/* Controls - Moved to Bottom */}
        <View style={styles.section}>
          <View style={styles.controlsRow}>
            <View style={styles.controlItem}>
              <Text variant="labelMedium" style={[styles.controlLabel, { color: theme.colors.onSurface }]}>
                {t('stats.chartType')}
              </Text>
              <Menu
                visible={chartMenuVisible}
                onDismiss={() => setChartMenuVisible(false)}
                anchor={
                  <Button 
                    mode="contained" 
                    onPress={() => setChartMenuVisible(true)}
                    style={[styles.menuButton, { borderColor: theme.colors.outline, backgroundColor: theme.colors.primary }]}
                    contentStyle={styles.menuButtonContent}
                    labelStyle={{ color: theme.colors.surface }}
                    icon="chevron-down"
                  >
                    {wrapButtonText(selectedChart.label)}
                  </Button>
                }
              >
                {chartOptions.map((option) => (
                  <Menu.Item
                    key={option.key}
                    onPress={() => {
                      if (option.type === 'specific' || option.type === 'detailed') {
                        setSelectedChart(option);
                        setSelectedItem(null);
                        setChartMenuVisible(false);
                      }
                    }}
                    title={option.label}
                    titleStyle={{ 
                      color: theme.colors.onSurface,
                      fontWeight: option.type === 'general' ? '600' : '400',
                      fontSize: scale(14),
                      marginLeft: (option.type === 'specific' || option.type === 'detailed') ? scale(20) : 0
                    }}
                    style={option.type === 'general' ? { backgroundColor: theme.colors.surfaceVariant, opacity: 0.7 } : {}}
                  />
                ))}
              </Menu>
            </View>

            {selectedChart.type === 'detailed' && availableItems.length > 0 && (
              <View style={styles.controlItem}>
                <Text variant="labelMedium" style={[styles.controlLabel, { color: theme.colors.onSurface }]}>
                  {selectedChart.key.includes('author') ? 'Author' : 
                   selectedChart.key.includes('category') ? 'Category' : 'Publisher'}
                </Text>
                <Menu
                  visible={itemMenuVisible}
                  onDismiss={() => setItemMenuVisible(false)}
                  anchor={
                    <Button 
                      mode="contained" 
                      onPress={() => setItemMenuVisible(true)}
                      style={[styles.menuButton, { borderColor: theme.colors.outline }]}
                      contentStyle={styles.menuButtonContent}
                      labelStyle={{ color: theme.colors.surface }}
                      icon="chevron-down"
                    >
                      {wrapButtonText(selectedItem?.name || 'Select...')}
                    </Button>
                  }
                >
                  {availableItems.map((item) => (
                    <Menu.Item
                      key={item.id}
                      onPress={() => {
                        setSelectedItem(item);
                        setItemMenuVisible(false);
                      }}
                      title={item.name}
                      titleStyle={{ color: theme.colors.onSurface, fontSize: scale(14) }}
                    />
                  ))}
                </Menu>
              </View>
            )}

            <View style={styles.controlItem}>
              <Text variant="labelMedium" style={[styles.controlLabel, { color: theme.colors.onSurface }]}>
                {t('stats.timeframe')}
              </Text>
              <Menu
                visible={timeframeMenuVisible}
                onDismiss={() => setTimeframeMenuVisible(false)}
                anchor={
                  <Button 
                    mode="contained" 
                    onPress={() => setTimeframeMenuVisible(true)}
                    style={[styles.menuButton, { borderColor: theme.colors.outline, backgroundColor: theme.colors.primary }]}
                    contentStyle={styles.menuButtonContent}
                    labelStyle={{ color: theme.colors.surface }}
                    icon="chevron-down"
                  >
                    {getTimeframeButtonLabel(selectedTimeframe.label)}
                  </Button>
                }
              >
                {timeframeOptions.map((option) => (
                  <Menu.Item
                    key={option.key}
                    onPress={() => {
                      setSelectedTimeframe(option);
                      setTimeframeMenuVisible(false);
                    }}
                    title={option.label}
                    titleStyle={{ color: theme.colors.onSurface, fontSize: scale(14) }}
                  />
                ))}
              </Menu>
            </View>
          </View>
        </View>

        <View style={styles.bottomSpacing} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  // Header - Exactly matching Home.tsx
  header: {
    paddingHorizontal: scale(20),
    paddingVertical: verticalScale(24),
    marginBottom: verticalScale(8),
  },
  headerContent: {
    alignItems: 'center',
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: verticalScale(8),
  },
  appName: {
    marginLeft: scale(12),
    fontWeight: '300',
    letterSpacing: moderateScale(2),
  },
  tagline: {
    opacity: 0.7,
  },
  // Section styling
  section: {
    paddingHorizontal: scale(20),
    marginBottom: verticalScale(16),
  },
  // Controls
  controlsRow: {
    flexDirection: 'row',
    gap: scale(12),
    flexWrap: 'wrap',
    alignItems: 'flex-start',
  },
  controlItem: {
    flex: 1,
    minWidth: scale(100),
  },
  controlLabel: {
    marginBottom: verticalScale(8),
    opacity: 0.7,
  },
  menuButton: {
    borderRadius: scale(8),
    justifyContent: 'center',
    minHeight: verticalScale(40),
  },
  menuButtonContent: {
    paddingVertical: verticalScale(10),
    minHeight: verticalScale(40),
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Green Background Card
  backgroundCard: {
    borderRadius: scale(20),
    elevation: 2,
    shadowOpacity: 0.1,
  },
  backgroundCardContent: {
    padding: scale(16),
  },
  // Chart Card (white card inside green) - scaled down
  chartCard: {
    borderRadius: scale(16),
    elevation: 4,
    shadowOpacity: 0.15,
    marginHorizontal: scale(8),
    marginVertical: scale(6),
  },
  chartTitle: {
    fontWeight: '600',
    flex: 1,
  },
  timeframeChip: {
    marginLeft: scale(8),
  },
  timeframeChipText: {
    fontSize: scale(12),
  },
  chartContainer: {
    minHeight: verticalScale(320),
    justifyContent: 'center',
  },
  chartScrollView: {
    marginTop: verticalScale(8),
  },
  chart: {
    borderRadius: scale(8),
    marginTop: verticalScale(20),
  },
  // Informational Chips
  chipsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: verticalScale(16),
    gap: scale(12),
    flexWrap: 'wrap',
  },
  infoChip: {
    borderRadius: scale(16),
    borderColor: 'transparent',
  },
  // Summary
  summaryContainer: {
    marginTop: verticalScale(2),
  },
  divider: {
    marginVertical: verticalScale(16),
  },
  summaryGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  summaryItem: {
    alignItems: 'center',
  },
  summaryValue: {
    fontWeight: '600',
    marginBottom: verticalScale(4),
  },
  summaryLabel: {
    fontSize: scale(12),
  },
  // States
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: verticalScale(40),
  },
  loadingText: {
    marginTop: verticalScale(16),
  },
  emptyText: {
    textAlign: 'center',
  },
  bottomSpacing: {
    height: verticalScale(60),
  },
});

export default Stats;
