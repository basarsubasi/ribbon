import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, FlatList, TouchableOpacity, Dimensions } from 'react-native';
import { Text, Surface, FAB, IconButton, Divider, Modal, Portal, Card, Chip, Button } from 'react-native-paper';
import { useTheme } from '../../context/ThemeContext';
import { useTranslation } from 'react-i18next';
import CalendarIcon from '../../components/CalendarIcon';
import { scale, verticalScale, moderateScale } from 'react-native-size-matters';
import { useSQLiteContext } from 'expo-sqlite';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';

interface PageLogItem {
  page_log_id: number;
  book_id: number;
  title: string;
  start_page: number;
  end_page: number;
  total_page_read: number;
  read_time: string;
  page_notes?: string;
}

const { width: screenWidth } = Dimensions.get('window');
const DAYS_TO_SHOW = 7;

// Local date key (avoids timezone shifting that happens with toISOString)
const formatDateKey = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export default function Calendar() {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const db = useSQLiteContext();
  const navigation = useNavigation<StackNavigationProp<any>>();

  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [dateStrip, setDateStrip] = useState<Date[]>([]);
  const [logs, setLogs] = useState<PageLogItem[]>([]);
  const [showPicker, setShowPicker] = useState(false);
  const [pickerMonth, setPickerMonth] = useState<Date>(new Date());
  const [loading, setLoading] = useState(false);
  const [logPresence, setLogPresence] = useState<Record<string, boolean>>({});

  const buildStrip = useCallback((center: Date) => {
    const days: Date[] = [];
    for (let i = -Math.floor(DAYS_TO_SHOW/2); i <= Math.floor(DAYS_TO_SHOW/2); i++) {
      const d = new Date(center);
      d.setDate(center.getDate() + i);
      days.push(d);
    }
    setDateStrip(days);
  }, []);

  const loadLogs = useCallback(async () => {
    const key = formatDateKey(selectedDate);
    setLoading(true);
    try {
      const result = await db.getAllAsync<any>(`
        SELECT pl.*, b.title FROM page_logs pl
        JOIN books b ON b.book_id = pl.book_id
        WHERE pl.read_date = ?
        ORDER BY pl.read_time DESC
      `, [key]);
      setLogs(result.map(r => ({
        page_log_id: r.page_log_id,
        book_id: r.book_id,
        title: r.title,
        start_page: r.start_page,
        end_page: r.end_page,
        total_page_read: r.total_page_read,
        read_time: r.read_time,
        page_notes: r.page_notes,
      })));
    } catch (e) {
      console.warn('Failed loading logs', e);
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, [db, selectedDate]);

  useFocusEffect(
    useCallback(() => {
      loadLogs();
    }, [loadLogs])
  );

  useEffect(() => { buildStrip(selectedDate); }, [selectedDate, buildStrip]);

  // Load log presence for visible strip dates
  useEffect(() => {
    const loadPresence = async () => {
      if (!dateStrip.length) return;
      try {
        const keys = dateStrip.map(formatDateKey);
        const placeholders = keys.map(() => '?').join(',');
        const rows = await db.getAllAsync<any>(
          `SELECT read_date, COUNT(*) cnt FROM page_logs WHERE read_date IN (${placeholders}) GROUP BY read_date`,
          keys
        );
        const map: Record<string, boolean> = {};
        rows.forEach(r => { map[r.read_date] = r.cnt > 0; });
        setLogPresence(map);
      } catch (e) {
        console.warn('Failed loading presence', e);
      }
    };
    loadPresence();
  }, [dateStrip, db]);

  const changeDay = (offset: number) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + offset);
    setSelectedDate(d);
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return formatDateKey(date) === formatDateKey(today);
  };

  const renderDay = ({ item }: { item: Date }) => {
    const key = formatDateKey(item);
    const isSelected = key === formatDateKey(selectedDate);
    const todayFlag = isToday(item);
    const hasLogs = !!logPresence[key];
    const baseBg = hasLogs
      ? theme.colors.primary
      : todayFlag
        ? (theme.colors.secondaryContainer || theme.colors.primaryContainer)
        : 'transparent';
    
    return (
      <TouchableOpacity 
        onPress={() => {
          // Only rebuild strip if the selected date is not in the current visible strip
          const currentStripKeys = dateStrip.map(d => formatDateKey(d));
          const selectedKey = formatDateKey(item);
          
          if (!currentStripKeys.includes(selectedKey)) {
            buildStrip(item);
          }
          
          setSelectedDate(item);
        }} 
        style={[
          styles.dayItem,
          { backgroundColor: baseBg },
          isSelected && {
            borderWidth: scale(2),
            borderColor: hasLogs ? theme.colors.onPrimary : theme.colors.primary,
          }
        ]}
        activeOpacity={0.8}
      >        
        <Text style={[
          styles.dayDow, 
          { 
            color: hasLogs
              ? theme.colors.onPrimary
              : todayFlag
                ? (theme.colors.onSecondaryContainer || theme.colors.onPrimaryContainer)
                : theme.colors.onSurfaceVariant 
          }
        ]}>
          {item.toLocaleDateString(undefined, { weekday: 'short' })}
        </Text>
        <Text style={[
          styles.dayNum, 
          { 
            color: hasLogs
              ? theme.colors.onPrimary
              : todayFlag
                ? (theme.colors.onSecondaryContainer || theme.colors.onPrimaryContainer)
                : theme.colors.onSurface 
          }
        ]}>
          {item.getDate()}
        </Text>
      </TouchableOpacity>
    );
  };

  const renderLogCard = ({ item }: { item: PageLogItem }) => (
    <Card style={[styles.logCard, { backgroundColor: theme.colors.surface }]} mode="outlined">
      <Card.Content>
        <View style={styles.logHeader}>
          <Text variant="titleMedium" style={[styles.bookTitle, { color: theme.colors.onSurface }]}>
            {item.title}
          </Text>
          <Chip 
            compact
            textStyle={styles.timeChipText}
            style={[styles.timeChip, { backgroundColor: theme.colors.primaryContainer }]}
          >
            {item.read_time}
          </Chip>
        </View>
        <Text variant="bodyMedium" style={[styles.pageInfo, { color: theme.colors.onSurfaceVariant }]}>
          Pages {item.start_page}–{item.end_page} · {item.total_page_read} pages read
        </Text>
        {item.page_notes && (
          <Text variant="bodySmall" style={[styles.notePreview, { color: theme.colors.onSurfaceVariant }]}>
            {item.page_notes.length > 80 ? item.page_notes.substring(0, 80) + '…' : item.page_notes}
          </Text>
        )}
      </Card.Content>
    </Card>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.colors.surface }]}>
        <View style={styles.headerContent}>
          <CalendarIcon 
            width={scale(28)} 
            height={scale(28)} 
            primaryColor={theme.colors.primary} 
            accentColor={theme.colors.onSurface}
          />
          <Text variant="headlineSmall" style={[styles.headerTitle, { color: theme.colors.primary }]}>
            calendar
          </Text>
        </View>
      </View>

      <Divider />

      {/* Date Navigation Strip */}
      <Surface style={[styles.stripContainer, { backgroundColor: theme.colors.surface }]} elevation={0}>
        <View style={styles.monthSection}>
          <Text variant="labelLarge" style={[styles.monthText, { color: theme.colors.onSurface }]}>
            {selectedDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
          </Text>
          <TouchableOpacity 
            style={[styles.jumpButton, { backgroundColor: theme.colors.primary }]}
            onPress={() => {
              setPickerMonth(new Date(selectedDate));
              setShowPicker(true);
            }}
            activeOpacity={0.8}
          >
            <Ionicons name="calendar" size={18} color={theme.colors.surface} />
          </TouchableOpacity>
        </View>
        
        <View style={styles.datesContainer}>
          <FlatList
            data={dateStrip}
            horizontal
            showsHorizontalScrollIndicator={false}
            keyExtractor={item => formatDateKey(item)}
            renderItem={renderDay}
            style={styles.dateList}
            contentContainerStyle={styles.dateListContent}
          />
        </View>
      </Surface>

      <Divider />

      {/* Reading Logs */}
      <FlatList
        data={logs}
        keyExtractor={item => `${item.page_log_id}`}
        renderItem={renderLogCard}
        style={styles.logList}
        contentContainerStyle={[
          styles.logListContent, 
          logs.length === 0 && styles.emptyListContent
        ]}
        refreshing={loading}
        onRefresh={loadLogs}
        ListEmptyComponent={() => (
          <View style={styles.emptyState}>
            <Text variant="bodyLarge" style={[styles.emptyText, { color: theme.colors.onSurfaceVariant }]}>
              No reading sessions on {selectedDate.toLocaleDateString()}
            </Text>
            <Text variant="bodySmall" style={[styles.emptySubtext, { color: theme.colors.onSurfaceVariant }]}>
              Start reading!
            </Text>
          </View>
        )}
      />

      {/* Floating Action Button */}
      <FAB
        icon="book-plus"
        style={[styles.fab, { backgroundColor: theme.colors.primary }]}
        onPress={() => navigation.navigate('ChooseBook')}
        mode="elevated"
        color={theme.colors.surface}
      />

      {/* Date Picker Modal */}
      <Portal>
        <Modal 
          visible={showPicker} 
          onDismiss={() => setShowPicker(false)}
          contentContainerStyle={styles.modalContainer}
        >
          <Surface style={[styles.modalSurface, { backgroundColor: theme.colors.surface }]} elevation={3}>
            <Text variant="headlineSmall" style={[styles.modalTitle, { color: theme.colors.onSurface }]}>
              Select Date
            </Text>
            
            {/* Month Navigation */}
            <View style={styles.monthNavigation}>
              <TouchableOpacity
                style={[styles.monthNavButton, { backgroundColor: theme.colors.background }]}
                onPress={() => {
                  const newMonth = new Date(pickerMonth);
                  newMonth.setMonth(pickerMonth.getMonth() - 1);
                  setPickerMonth(newMonth);
                }}
                activeOpacity={0.8}
              >
                <Text style={{ color: theme.colors.onPrimaryContainer, fontWeight: '600', fontSize: scale(16) }}>‹</Text>
              </TouchableOpacity>
              
              <Text variant="titleMedium" style={[styles.monthYearText, { color: theme.colors.onSurface }]}>
                {pickerMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
              </Text>
              
              <TouchableOpacity
                style={[styles.monthNavButton, { backgroundColor: theme.colors.background }]}
                onPress={() => {
                  const newMonth = new Date(pickerMonth);
                  newMonth.setMonth(pickerMonth.getMonth() + 1);
                  setPickerMonth(newMonth);
                }}
                activeOpacity={0.8}
              >
                <Text style={{ color: theme.colors.onPrimaryContainer, fontWeight: '600', fontSize: scale(16) }}>›</Text>
              </TouchableOpacity>
            </View>
            
            {/* Calendar Grid */}
            <View style={styles.calendarGrid}>
              {Array.from({ length: 42 }, (_, index) => {
                const startOfMonth = new Date(pickerMonth.getFullYear(), pickerMonth.getMonth(), 1);
                const startOfWeek = new Date(startOfMonth);
                startOfWeek.setDate(startOfMonth.getDate() - startOfMonth.getDay());
                
                const currentDate = new Date(startOfWeek);
                currentDate.setDate(startOfWeek.getDate() + index);
                
                const isCurrentMonth = currentDate.getMonth() === pickerMonth.getMonth();
                const key = formatDateKey(currentDate);
                const isSelected = key === formatDateKey(selectedDate);
                const isToday = key === formatDateKey(new Date());
                const hasLogs = !!logPresence[key];
                const bg = hasLogs
                  ? theme.colors.primary
                  : isToday
                    ? (theme.colors.secondaryContainer || theme.colors.primaryContainer)
                    : 'transparent';
                
                return (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.calendarDay,
                      { backgroundColor: bg },
                      isSelected && {
                        borderWidth: scale(2),
                        borderColor: hasLogs ? theme.colors.onPrimary : theme.colors.primary,
                        borderRadius: scale(8),
                      }
                    ]}
                    onPress={() => {
                      setSelectedDate(currentDate);
                      buildStrip(currentDate);
                      setShowPicker(false);
                    }}
                    activeOpacity={0.8}
                  >
                    <Text
                      variant="bodyMedium"
                      style={{
                        color: hasLogs
                          ? theme.colors.onPrimary
                          : isToday
                            ? (theme.colors.onSecondaryContainer || theme.colors.onPrimaryContainer)
                            : isCurrentMonth
                              ? theme.colors.onSurface
                              : theme.colors.onSurfaceVariant,
                        opacity: isCurrentMonth ? 1 : 0.4,
                        fontWeight: (isSelected || isToday || hasLogs) ? '600' : '400',
                      }}
                    >
                      {currentDate.getDate()}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            
            <View style={styles.modalActions}>

               <Button 
                mode="outlined" 
                onPress={() => setShowPicker(false)}
                style={{ flex: 1, marginLeft: scale(8) }}
                labelStyle={{ color: theme.colors.onSurface }}
              >
                Cancel
              </Button>

              <Button 
                mode="contained" 
                onPress={() => {
                  const today = new Date();
                  setSelectedDate(today);
                  buildStrip(today);
                  setShowPicker(false);
                }}
                style={{ flex: 1, marginRight: scale(8) }}
                labelStyle={{ color: theme.colors.surface }}
              >
                Today
              </Button>

            </View>
          </Surface>
        </Modal>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1 
  },
  header: {
    paddingHorizontal: scale(20),
    paddingTop: verticalScale(24),
    paddingBottom: verticalScale(16),
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    marginLeft: scale(12),
    fontWeight: '300',
    letterSpacing: scale(1),
    textTransform: 'lowercase',
  },
  stripContainer: {
    flexDirection: 'column',
    paddingVertical: verticalScale(12),
    paddingHorizontal: scale(8),
  },
  navButton: {
    marginHorizontal: scale(4),
  },
  jumpButton: {
    paddingHorizontal: scale(12),
    paddingVertical: verticalScale(8),
    borderRadius: scale(8),
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: scale(50),
  },
  monthSection: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: scale(8),
    flexDirection: 'row',
    marginBottom: verticalScale(8),
  },
  monthText: {
    fontWeight: '600',
    fontSize: scale(11),
    textTransform: 'uppercase',
    letterSpacing: scale(0.5),
  },
  datesContainer: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginVertical: verticalScale(16),
    paddingHorizontal: scale(8),
  },
  monthNavigation: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: scale(16),
    paddingVertical: verticalScale(12),
  },
  monthNavButton: {
    width: scale(40),
    height: scale(40),
    borderRadius: scale(20),
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthYearText: {
    fontWeight: '600',
    textAlign: 'center',
    flex: 1,
  },
  calendarDay: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: scale(8),
    marginBottom: scale(4),
  },
  modalActions: {
    flexDirection: 'row',
    marginTop: verticalScale(16),
    gap: scale(8),
  },
  dateList: {
    flexGrow: 1,
  },
  dateListContent: {
    paddingHorizontal: scale(8),
  },
  dayItem: {
    minWidth: scale(55),
    height: scale(55),
    borderRadius: scale(12),
    paddingVertical: verticalScale(8),
    paddingHorizontal: scale(6),
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: scale(3),
    position: 'relative',
  },
  dayDow: { 
    fontSize: scale(10), 
    fontWeight: '600',
    marginBottom: scale(2),
  },
  dayNum: { 
    fontSize: scale(16), 
    fontWeight: '700' 
  },
  todayDot: {
    width: scale(4),
    height: scale(4),
    borderRadius: scale(2),
    position: 'absolute',
    bottom: scale(6),
  },
  logList: {
    flex: 1,
  },
  logListContent: {
    padding: scale(16),
  },
  emptyListContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: verticalScale(40),
  },
  emptyText: {
    marginTop: verticalScale(16),
    textAlign: 'center',
    fontWeight: '500',
  },
  emptySubtext: {
    marginTop: verticalScale(4),
    textAlign: 'center',
    opacity: 0.7,
  },
  logCard: {
    marginBottom: verticalScale(12),
    borderRadius: scale(12),
  },
  logHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: verticalScale(8),
  },
  bookTitle: {
    flex: 1,
    fontWeight: '600',
  },
  timeChip: {
    marginLeft: scale(8),
  },
  timeChipText: {
    fontSize: scale(10),
    fontWeight: '600',
  },
  pageInfo: {
    fontWeight: '500',
    marginBottom: verticalScale(4),
  },
  notePreview: {
    marginTop: verticalScale(6),
    fontStyle: 'italic',
    lineHeight: scale(16),
  },
  fab: {
    position: 'absolute',
    bottom: verticalScale(20),
    right: scale(20),
  },
  modalContainer: {
    margin: scale(20),
  },
  modalSurface: {
    borderRadius: scale(16),
    padding: scale(20),
  },
  modalTitle: {
    marginBottom: verticalScale(20),
    textAlign: 'center',
    fontWeight: '600',
  },
  quickDates: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: scale(8),
    marginBottom: verticalScale(20),
  },
  quickDateBtn: {
    paddingHorizontal: scale(16),
    paddingVertical: verticalScale(10),
    borderRadius: scale(8),
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: scale(60),
  },
  modalCloseBtn: {
    paddingVertical: verticalScale(12),
    borderRadius: scale(8),
    alignItems: 'center',
    justifyContent: 'center',
  },
});
