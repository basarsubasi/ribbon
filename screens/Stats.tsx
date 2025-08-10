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
  type: 'general' | 'specific';
  query: string;
  column: string;
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
    
    { key: 'categories-header', label: 'Categories', type: 'general', query: '', column: '' },
    { key: 'categories', label: 'All Categories', type: 'specific',
      query: `SELECT c.name, COALESCE(SUM(pl.total_page_read), 0) as pages_read
               FROM categories c 
               LEFT JOIN book_categories bc ON c.category_id = bc.category_id
               LEFT JOIN books b ON bc.book_id = b.book_id
               LEFT JOIN page_logs pl ON b.book_id = pl.book_id
               WHERE 1=1`, 
      column: 'c.name' },

    { key: 'publishers-header', label: 'Publishers', type: 'general', query: '', column: '' },
    { key: 'publishers', label: 'All Publishers', type: 'specific',
      query: `SELECT COALESCE(b.publisher, 'Unknown') as name, COALESCE(SUM(pl.total_page_read), 0) as pages_read
               FROM books b 
               LEFT JOIN page_logs pl ON b.book_id = pl.book_id
               WHERE 1=1`, 
      column: 'b.publisher' }
  ];

  const timeframeOptions: TimeframeOption[] = [
    { key: 'today', label: 'Today', filter: `AND pl.read_date = '${new Date().toISOString().split('T')[0]}'` },
    { key: 'week', label: 'This Week', filter: `AND pl.read_date >= '${new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}'` },
    { key: 'month', label: 'This Month', filter: `AND pl.read_date >= '${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-01'` },
    { key: 'year', label: 'This Year', filter: `AND pl.read_date >= '${new Date().getFullYear()}-01-01'` },
    { key: 'all', label: 'All Time', filter: '' }
  ];

  const [selectedChart, setSelectedChart] = useState<ChartOption>(chartOptions[1]);
  const [selectedTimeframe, setSelectedTimeframe] = useState<TimeframeOption>(timeframeOptions[2]);

  const loadData = useCallback(async () => {
    if (selectedChart.type === 'general') return;

    setLoading(true);
    try {
      const query = selectedChart.query + ' ' + selectedTimeframe.filter + ` GROUP BY ${selectedChart.column} HAVING pages_read > 0 ORDER BY pages_read DESC LIMIT 10`;
      const result = await db.getAllAsync<{ name: string; pages_read: number }>(query);
      
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
  }, [selectedChart, selectedTimeframe, db]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

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
      backgroundGradientFrom: "transparent",
      backgroundGradientTo: "transparent",
      color: (opacity = 1) => `rgba(${theme.colors.secondaryContainer}, ${opacity})`,
      strokeWidth: 2,
      barPercentage: 0.7,
      useShadowColorFromDataset: false,
      decimalPlaces: 0,
      propsForLabels: {
        fontSize: scale(10),
        fill: theme.colors.onSurface,
      },
    };

    const data = {
      labels: chartData.map(item => 
        item.name.length > 8 ? `${item.name.substring(0, 8)}...` : item.name
      ),
      datasets: [{
        data: chartData.map(item => item.value),
      }]
    };

    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chartScrollView}>
        <BarChart
          data={data}
          width={Math.max(screenWidth - scale(80), chartData.length * scale(60))}
          height={verticalScale(220)}
          chartConfig={chartConfig}
          style={styles.chart}
          yAxisLabel=""
          yAxisSuffix=""
          fromZero
          showValuesOnTopOfBars
        />
      </ScrollView>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View>
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
                    {selectedChart.label}
                  </Button>
                }
              >
                {chartOptions.map((option) => (
                  <Menu.Item
                    key={option.key}
                    onPress={() => {
                      if (option.type === 'specific') {
                        setSelectedChart(option);
                        setChartMenuVisible(false);
                      }
                    }}
                    title={option.label}
                    titleStyle={{ 
                      color: theme.colors.onSurface,
                      fontWeight: option.type === 'general' ? '600' : '400',
                      fontSize: scale(14),
                      marginLeft: option.type === 'specific' ? scale(20) : 0
                    }}
                    style={option.type === 'general' ? { backgroundColor: theme.colors.surfaceVariant, opacity: 0.7 } : {}}
                  />
                ))}
              </Menu>
            </View>

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
                    style={[styles.menuButton, { borderColor: theme.colors.outline }]}
                    contentStyle={styles.menuButtonContent}
                    labelStyle={{ color: theme.colors.surface }}
                    icon="chevron-down"
                  >
                    {selectedTimeframe.label}
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
      </View>
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
    marginTop: verticalScale(16),
    paddingHorizontal: scale(20),
    marginBottom: verticalScale(16),
  },
  // Controls
  controlsRow: {
    flexDirection: 'row',
    gap: scale(16),
  },
  controlItem: {
    flex: 1,
  },
  controlLabel: {
    marginBottom: verticalScale(8),
    opacity: 0.7,
  },
  menuButton: {
    borderRadius: scale(8),
    justifyContent: 'center',
  },
  menuButtonContent: {
    paddingVertical: verticalScale(8),
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
  chartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: verticalScale(16),
    flexWrap: 'wrap',
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
    minHeight: verticalScale(280),
    justifyContent: 'center',
  },
  chartScrollView: {
    marginTop: verticalScale(8),
  },
  chart: {
    borderRadius: scale(8),
  },
  // Summary
  summaryContainer: {
    marginTop: verticalScale(16),
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
